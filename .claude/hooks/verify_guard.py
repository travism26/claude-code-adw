#!/usr/bin/env python3
"""PreToolUse write guard for the `verifier` subagent (.claude/agents/verifier.md).

The verifier may write only evidence: paths inside a `.verify/` directory, or the
system temp dir when that is outside the project (a repo or worktree that lives
under the temp dir gets no temp allowance). Everything else (source, tests, probes, journey specs, config)
is the oracle or the artifact under test, and stays read-only.

Reads the hook JSON on stdin. Exit 0 allows; exit 2 blocks, with the reason on
stderr. Anything it cannot classify is blocked: the hook fails closed.

The Bash check is a tripwire for the ordinary ways a shell writes files, not a
sandbox: a determined process (a script file that writes, a compiled binary)
can still get past it.
"""

import json
import os
import re
import shlex
import sys
import tempfile

TEMP_ROOTS = {
    os.path.realpath(p)
    for p in ("/tmp", "/private/tmp", "/var/tmp", tempfile.gettempdir())
}
SPECIAL_TARGETS = {"/dev/null", "/dev/stdout", "/dev/stderr", "/dev/tty"}

# Commands whose non-flag arguments are all write targets.
WRITE_ALL_ARGS = {"rm", "rmdir", "mv", "touch", "truncate", "mkdir", "chmod", "chown", "unlink", "shred"}
# Commands whose last argument is the write target.
WRITE_LAST_ARG = {"cp", "ln", "install", "rsync"}
# Prefixes that run the next word as the real command.
WRAPPERS = {"sudo", "nohup", "time", "command", "exec", "env", "xargs", "nice", "timeout"}
INTERPRETERS = re.compile(r"^(python[0-9.]*|node|deno|bun|perl|ruby|php)$")
SHELLS = {"bash", "sh", "zsh", "dash"}
# Inline interpreter code containing any of these is treated as a file write.
CODE_WRITE_TOKENS = re.compile(
    r"open\s*\(|write_text|write_bytes|writeFile|appendFile|createWriteStream|"
    r"unlink|rmtree|os\.remove|os\.rename|os\.replace|\.rename\(|shutil\.|truncate|"
    r"File\.write|IO\.write|fopen|file_put_contents|mkdir"
)
GIT_READ_ONLY = {
    "status", "diff", "log", "show", "rev-parse", "ls-files", "ls-tree", "grep",
    "blame", "cat-file", "describe", "shortlog", "rev-list", "merge-base", "config",
}
SEPARATORS = {";", "&&", "||", "|", "&", "\n", "(", ")", "|&"}
REDIRECTS = re.compile(r"^(\d*|&)(>>?|>\|)$")
REDIRECT_ATTACHED = re.compile(r"^(\d*|&)(>>?|>\|)(.+)$")


HEREDOC_TAG = re.compile(r"<<-?\s*['\"]?(\w+)['\"]?")


class Blocked(Exception):
    pass


PROJECT_ROOTS = []  # set in main(): the hook's cwd and $CLAUDE_PROJECT_DIR


def under(path, root):
    return path == root or path.startswith(root + os.sep)


def is_allowed(path, base):
    if path in SPECIAL_TARGETS:
        return True
    if "$" in path or "`" in path:
        raise Blocked(f"cannot resolve write target {path!r}; use a literal path under .verify/")
    full = os.path.realpath(os.path.join(base, os.path.expanduser(path)))
    if ".verify" in full.split(os.sep):
        return True
    if any(under(full, root) for root in PROJECT_ROOTS):
        return False
    return any(under(full, root) for root in TEMP_ROOTS)


def require(path, base, why):
    if not is_allowed(path, base):
        raise Blocked(f"{why} writes {path!r}, outside .verify/")


def split_commands(command):
    lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|()<>")
    lexer.whitespace_split = True
    lexer.commenters = ""
    tokens = list(lexer)
    commands, current = [], []
    for tok in tokens:
        if tok in SEPARATORS:
            if current:
                commands.append(current)
            current = []
        else:
            current.append(tok)
    if current:
        commands.append(current)
    return commands


def strip_redirects(words, base):
    """Check every output redirect in one simple command; return the remaining words."""
    rest, i = [], 0
    while i < len(words):
        w = words[i]
        if REDIRECTS.match(w):
            if i + 1 >= len(words):
                raise Blocked("redirect with no target")
            require(words[i + 1], base, "output redirect")
            i += 2
            continue
        m = REDIRECT_ATTACHED.match(w)
        if m and not m.group(3).startswith("&"):
            require(m.group(3), base, "output redirect")
        elif not (m and m.group(3).startswith("&")):
            rest.append(w)
        i += 1
    return rest


def unwrap(words):
    """Drop prefixes that run the next word as the real command (nohup, env, uv run)."""
    words = list(words)
    while words:
        if words[0] in WRAPPERS:
            words.pop(0)
        elif words[:2] == ["uv", "run"]:
            del words[:2]
        else:
            break
        while words and (words[0].startswith("-") or re.match(r"^\d+[smh]?$", words[0]) or "=" in words[0]):
            words.pop(0)
    return words


def expand(word, env):
    """Expand $VAR / ${VAR} from same-command assignments, then the environment.
    Unknown variables are left in place, and is_allowed refuses them."""
    def sub(m):
        name = m.group(1) or m.group(2)
        return env.get(name, os.environ.get(name, m.group(0)))
    return re.sub(r"\$\{(\w+)\}|\$(\w+)", sub, word)


def check_simple(words, base, env):
    """Check one simple command; return the new base dir if it is a `cd`."""
    while words and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", words[0]):
        name, _, value = words.pop(0).partition("=")
        env[name] = expand(value, env)
    words = strip_redirects([expand(w, env) for w in words], base)
    words = unwrap(words)
    if not words:
        return base

    prog, args = os.path.basename(words[0]), words[1:]
    operands = [a for a in args if not a.startswith("-")]

    if prog == "cd":
        target = operands[0] if operands else os.path.expanduser("~")
        return os.path.realpath(os.path.join(base, target))
    if prog in WRITE_ALL_ARGS:
        for a in operands:
            require(a, base, prog)
    elif prog in WRITE_LAST_ARG:
        if operands:
            require(operands[-1], base, prog)
    elif prog == "tee":
        for a in operands:
            require(a, base, "tee")
    elif prog == "dd":
        for a in args:
            if a.startswith("of="):
                require(a[3:], base, "dd")
    elif prog in {"sed", "gsed", "perl"} and any(a.startswith("--in-place") or (a.startswith("-") and not a.startswith("--") and "i" in a[1:]) for a in args):
        raise Blocked(f"{prog} -i edits files in place; the verifier writes only under .verify/ (use the Write tool)")
    elif prog in {"curl", "wget"}:
        for i, a in enumerate(args):
            if a in {"-o", "--output", "-O", "--output-document"} and i + 1 < len(args):
                if prog == "curl" and a == "-O":
                    raise Blocked("curl -O writes to the current directory; use -o .verify/<file>")
                require(args[i + 1], base, prog)
            elif a.startswith("--output=") or a.startswith("--output-document="):
                require(a.split("=", 1)[1], base, prog)
    elif prog == "git":
        sub = next((a for a in args if not a.startswith("-") and a not in {"-C", "-c"}), None)
        rest = args[args.index(sub) + 1:] if sub else []
        if sub == "branch" and any(a.startswith("-") and a not in {"-a", "-r", "-v", "-vv", "--list", "--show-current"} for a in rest):
            raise Blocked("git branch with a mutating flag")
        if sub == "stash" and rest[:1] not in (["list"], ["show"]):
            raise Blocked("git stash changes the working tree")
        if sub == "worktree" and rest[:1] != ["list"]:
            raise Blocked("git worktree changes the repo")
        if sub and sub not in GIT_READ_ONLY | {"branch", "stash", "worktree"}:
            raise Blocked(f"git {sub} changes the repo; the verifier runs read-only git only")
    elif prog == "find":
        if "-delete" in args or any(a in {"-exec", "-execdir", "-ok"} for a in args):
            raise Blocked("find -delete/-exec can modify files")
    elif INTERPRETERS.match(prog) or prog in SHELLS:
        flag = {"-c"} if prog in SHELLS else {"-c", "-e", "-E", "--eval", "-r"}
        for i, a in enumerate(args):
            if a in flag and i + 1 < len(args):
                code = args[i + 1]
                if prog in SHELLS:
                    check_bash(code, base)
                elif CODE_WRITE_TOKENS.search(code):
                    raise Blocked(f"inline {prog} code that writes files; write evidence with the Write tool under .verify/")
    return base


def extract_heredocs(command):
    """Split heredoc bodies out of a command. Returns the command with bodies and
    `<<TAG` markers removed (so each head line's redirects are still checked), and
    a list of (head line, body) pairs."""
    kept, heredocs = [], []
    lines = command.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        m = HEREDOC_TAG.search(line)
        if not m:
            kept.append(line)
            i += 1
            continue
        tag, body = m.group(1), []
        i += 1
        while i < len(lines) and lines[i].strip() != tag:
            body.append(lines[i])
            i += 1
        i += 1  # skip the terminator
        head = line[: m.start()] + line[m.end():]
        kept.append(head)
        heredocs.append((line[: m.start()].split("|")[-1].split(";")[-1].split("&&")[-1].strip(), "\n".join(body)))
    return "\n".join(kept), heredocs


def check_bash(command, base):
    command, heredocs = extract_heredocs(command)
    for head, body in heredocs:
        words = unwrap(head.split())
        prog = os.path.basename(words[0]) if words else ""
        if prog in SHELLS:
            check_bash(body, base)
        elif INTERPRETERS.match(prog) and CODE_WRITE_TOKENS.search(body):
            raise Blocked(f"heredoc-fed {prog} code that writes files; write evidence with the Write tool under .verify/")
    try:
        commands = split_commands(command)
    except ValueError as exc:
        raise Blocked(f"could not parse command ({exc})")
    env = {}
    for words in commands:
        base = check_simple(words, base, env)


def main():
    try:
        data = json.load(sys.stdin)
        tool, tool_input = data.get("tool_name", ""), data.get("tool_input") or {}
        base = data.get("cwd") or os.getcwd()
        PROJECT_ROOTS.extend(os.path.realpath(p) for p in (base, os.environ.get("CLAUDE_PROJECT_DIR")) if p)
        if tool in {"Write", "Edit", "NotebookEdit"}:
            path = tool_input.get("file_path") or tool_input.get("notebook_path")
            if not path:
                raise Blocked(f"{tool} call with no file path")
            require(path, base, tool)
        elif tool == "Bash":
            check_bash(tool_input.get("command", ""), base)
    except Blocked as exc:
        print(f"verify-guard: blocked. {exc}. The verifier writes evidence only under .verify/ "
              "(or the temp dir); tests, probes, specs and source are read-only. If the oracle "
              "looks wrong, report FLAG with the proposed change.", file=sys.stderr)
        sys.exit(2)
    except Exception as exc:  # fail closed on anything unexpected
        print(f"verify-guard: internal error ({exc!r}); blocking", file=sys.stderr)
        sys.exit(2)
    sys.exit(0)


if __name__ == "__main__":
    main()
