"""Ticket resolver: turn a Ticket reference into a runnable Ticket or a refusal.

One entry point, resolve_ticket(ref, working_dir, client), shared by every
orchestrator that accepts a Ticket (ADR-0001). It never creates a worktree,
state, agent call or PR, so a refusal costs nothing: callers resolve first
and only then start the run.

GitHub access goes through an injected client (GitHubClient) so tests run
without the network; GhClient is the gh-CLI implementation.

Accepted reference forms, all resolving to the same Ticket:
  https://github.com/owner/repo/issues/N   owner/repo#N   N   #N
The bare forms take the repo from the working dir's origin. A reference to
any other repo is refused, as is an issue not labelled ready-for-agent, and
(on a fresh run) one already labelled in-progress: another run or session has
claimed it. A --resume of the claiming run passes resuming=True.

A Ready Ticket with an open Blocker is refused too, listing every open one.
Blockers are the union of GitHub's native issue dependencies and the issue
references in the body's `## Blocked by` section (any heading level, or a
`Blocked by: #n, #n` line). A section that is empty or starts with "None"
means no Blockers. Where the Blockers cannot be known the run fails closed
rather than starting early: a listed Blocker that cannot be fetched counts
as open, and unreadable native dependencies refuse the Ticket.

claim_ticket(ticket, client) marks a resolved Ticket in-progress, creating
the label if the repo lacks it. It is the only label a run ever writes.

resolve_spec(ticket, working_dir, client) then finds the Ticket's parent Spec:
the sub-issue parent, else a `## Parent` section or `Part of #N` line, else a
`Spec:` line naming a file in the repo. It never refuses; a doubtful Spec
comes back with a warning for the run summary and PR body.
"""

import json
import os
import re
import subprocess
from dataclasses import dataclass
from typing import Callable, Optional, Protocol, Union

from adw_modules.github import extract_repo_path, get_github_env

READY_LABEL = "ready-for-agent"
IN_PROGRESS_LABEL = "in-progress"
IN_PROGRESS_DESCRIPTION = "Claimed: a run or session is working on it"
IN_PROGRESS_COLOR = "fbca04"
PLAN_TYPE_LABELS = ("bug", "chore", "feature")

_URL_RE = re.compile(r"^https?://github\.com/([\w.-]+/[\w.-]+)/issues/(\d+)/?(?:[?#].*)?$")
_QUALIFIED_RE = re.compile(r"^([\w.-]+/[\w.-]+)#(\d+)$")
_BARE_RE = re.compile(r"^#?(\d+)$")

_HEADING_RE = re.compile(r"^(#{1,6})[ \t]+(.*?)[ \t#]*$")
_BLOCKED_BY_HEADING_RE = re.compile(r"^blocked by:?$", re.IGNORECASE)
_CRITERIA_HEADING_RE = re.compile(r"^acceptance criteria\b", re.IGNORECASE)
_BLOCKED_BY_LINE_RE = re.compile(r"^[ \t]*\**blocked by:\**[ \t]*(.*)$", re.IGNORECASE)
_NONE_RE = re.compile(r"^(?:[-*][ \t]+)?none\b", re.IGNORECASE)
# A #N glued to a word (C#1, foo#2) is not a reference.
_ISSUE_REF_RE = re.compile(
    r"https?://github\.com/([\w.-]+/[\w.-]+)/issues/(\d+)"
    r"|(?<![\w.#/-])(?:([\w.-]+/[\w.-]+))?#(\d+)")

_PARENT_HEADING_RE = re.compile(r"^parent:?$", re.IGNORECASE)
# "Part of" counts only when an issue reference follows it, not in prose.
_PART_OF_LINE_RE = re.compile(
    r"^[ \t]*\**part of:?\**:?[ \t]*((?:https?://github\.com/|[\w.-]+/[\w.-]+#|#)\S.*)$",
    re.IGNORECASE)
_SPEC_LINE_RE = re.compile(r"^[ \t]*\**spec:\**[ \t]*(.*)$", re.IGNORECASE)
# The path a `Spec:` line names: backticked, else its first whitespace-free token.
_SPEC_PATH_RE = re.compile(r"^`([^`]+)`|^(\S+)")


@dataclass(frozen=True)
class Ticket:
    """A Ready Ticket: title and body only. Comments are never part of it."""
    repo: str
    number: int
    title: str
    body: str
    labels: tuple
    url: str

    @property
    def ref(self) -> str:
        return f"{self.repo}#{self.number}"

    def as_plan_input(self) -> str:
        return f"# {self.title}\n\n{self.body}".rstrip() + "\n"

    @property
    def acceptance_criteria(self) -> Optional[str]:
        """The `Acceptance criteria` section's text, stripped, or None if the
        body has no such section (or it is empty)."""
        return (_section_text(self.body, _CRITERIA_HEADING_RE) or "").strip() or None


@dataclass(frozen=True)
class Blocker:
    """A Ticket that must close before the Ticket it blocks may start."""
    repo: str
    number: int
    title: str

    def ref_from(self, repo: str) -> str:
        return f"#{self.number}" if self.repo.lower() == repo.lower() else f"{self.repo}#{self.number}"


@dataclass(frozen=True)
class Refusal:
    """Why a reference cannot run. reason is a stable code for callers/tests:
    bad_reference | no_origin | repo_mismatch | not_found | not_ready |
    in_progress | blockers_unavailable | open_blockers, and claim_failed
    from callers whose claim_ticket fails, and target_not_installed from
    callers whose target lacks the pipeline's slash commands."""
    reason: str
    message: str
    labels: tuple = ()
    blockers: tuple = ()  # of Blocker, for open_blockers
    missing: tuple = ()  # slash command names, for target_not_installed


@dataclass(frozen=True)
class SpecResolution:
    """The Ticket's parent Spec, as a pointer. ref is `owner/repo#N` for a Spec
    issue or a working-dir-relative path for a Spec file, None when no Spec was
    found. warning is set whenever the run should flag its Spec to a human; it
    never stops the run. source says which step of the resolution order hit:
    sub_issue | parent_section | spec_line."""
    ref: Optional[str]
    kind: Optional[str] = None  # issue | file
    warning: Optional[str] = None
    source: Optional[str] = None

    @classmethod
    def from_state(cls, ref: Optional[str], warning: Optional[str]) -> "SpecResolution":
        """Rebuild from the spec_ref and spec_warning a run recorded in state."""
        kind = None if not ref else ("issue" if _QUALIFIED_RE.match(ref) else "file")
        return cls(ref=ref, kind=kind, warning=warning)

    def issue_coordinates(self) -> tuple:
        """(repo, number) of a Spec issue. Only for kind == "issue"."""
        repo, number = self.ref.split("#")
        return repo, int(number)

    def pointer(self) -> str:
        """One line for the planner naming the Spec and when to read it. The
        Spec body is never inlined: the Ticket's acceptance criteria come first."""
        if not self.ref:
            return ""
        if self.kind == "issue":
            repo, number = self.issue_coordinates()
            where = f"GitHub issue https://github.com/{repo}/issues/{number}"
        else:
            where = f"`{self.ref}` in the repo"
        return (f"Parent Spec: {where}. The Ticket above is the work; read the Spec only "
                "when the Ticket is ambiguous about scope or intent, or to check a "
                "decision you are about to contradict.")


class GitHubClient(Protocol):
    def origin_repo(self, working_dir: str) -> Optional[str]: ...
    def get_issue(self, repo: str, number: int) -> Optional[dict]: ...
    def blocked_by(self, repo: str, number: int) -> Optional[list]: ...
    def parent_issue(self, repo: str, number: int) -> Optional[dict]: ...
    def comment(self, repo: str, number: int, body: str) -> bool: ...
    def ensure_label(self, repo: str, name: str, description: str, color: str) -> bool: ...
    def add_label(self, repo: str, number: int, name: str) -> bool: ...


class GhClient:
    """GitHubClient over git + the gh CLI."""

    def _gh(self, args: list) -> subprocess.CompletedProcess:
        env = get_github_env() or {**os.environ}
        return subprocess.run(["gh", *args], capture_output=True, text=True, env=env)

    def origin_repo(self, working_dir: str) -> Optional[str]:
        r = subprocess.run(["git", "-C", working_dir, "remote", "get-url", "origin"],
                           capture_output=True, text=True)
        if r.returncode != 0 or not r.stdout.strip():
            return None
        return extract_repo_path(r.stdout.strip())

    def get_issue(self, repo: str, number: int) -> Optional[dict]:
        # comments deliberately not requested: the Ticket is title + body only.
        r = self._gh(["issue", "view", str(number), "-R", repo,
                      "--json", "number,title,body,labels,url,state"])
        if r.returncode != 0:
            return None
        return json.loads(r.stdout)

    def blocked_by(self, repo: str, number: int) -> Optional[list]:
        # Native issue dependencies. A 404 means the API is unavailable, so the
        # `## Blocked by` section is the only source (issue-tracker.md); any
        # other failure is None: the Blockers are unknown.
        r = self._gh(["api", "--paginate", "--slurp",
                      f"repos/{repo}/issues/{number}/dependencies/blocked_by"])
        if r.returncode != 0:
            return [] if "HTTP 404" in r.stderr else None
        return [dep for page in json.loads(r.stdout) for dep in page]

    def parent_issue(self, repo: str, number: int) -> Optional[dict]:
        # The sub-issue parent. No parent (404) and an unreadable API alike
        # mean "no answer here"; the body is the next source either way.
        r = self._gh(["api", f"repos/{repo}/issues/{number}/parent"])
        if r.returncode != 0 or not r.stdout.strip():
            return None
        return json.loads(r.stdout)

    def comment(self, repo: str, number: int, body: str) -> bool:
        r = self._gh(["issue", "comment", str(number), "-R", repo, "--body", body])
        return r.returncode == 0

    def ensure_label(self, repo: str, name: str, description: str, color: str) -> bool:
        # No --force: an existing label (however a human has styled it) is kept.
        r = self._gh(["label", "create", name, "-R", repo,
                      "--description", description, "--color", color])
        return r.returncode == 0 or "already exists" in r.stderr

    def add_label(self, repo: str, number: int, name: str) -> bool:
        r = self._gh(["issue", "edit", str(number), "-R", repo, "--add-label", name])
        return r.returncode == 0


def parse_reference(ref: str) -> Optional[tuple]:
    """(repo or None, number) for a well-formed reference, else None."""
    ref = (ref or "").strip()
    for pattern in (_URL_RE, _QUALIFIED_RE):
        m = pattern.match(ref)
        if m:
            return m.group(1), int(m.group(2))
    m = _BARE_RE.match(ref)
    return (None, int(m.group(1))) if m else None


def _label_names(raw) -> tuple:
    return tuple(l["name"] if isinstance(l, dict) else str(l) for l in raw or ())


def _section_text(body: str, heading_re: Optional[re.Pattern],
                  line_re: Optional[re.Pattern] = None) -> Optional[str]:
    """The text of the first section whose heading matches heading_re (up to
    the next heading of the same or a higher level, ignoring code fences) or of
    the first line matching line_re, whichever comes first; else None."""
    section, level, fenced = None, 0, False
    for line in (body or "").replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if line.lstrip().startswith(("```", "~~~")):
            fenced = not fenced
        heading = None if fenced else _HEADING_RE.match(line)
        if section is not None:
            if heading and len(heading.group(1)) <= level:
                break
            section.append(line)
        elif heading and heading_re is not None and heading_re.match(heading.group(2)):
            section, level = [], len(heading.group(1))
        elif not fenced and line_re is not None:
            inline = line_re.match(line)
            if inline:
                return inline.group(1)
    return None if section is None else "\n".join(section)


def _issue_refs(text: str, repo: str) -> list:
    """(repo, number) for each issue referenced in text, in order, deduplicated."""
    refs = []
    for url_repo, url_n, qual_repo, n in _ISSUE_REF_RE.findall(text or ""):
        ref = (url_repo or qual_repo or repo, int(url_n or n))
        if ref not in refs:
            refs.append(ref)
    return refs


def blocked_by_section_refs(body: str, repo: str) -> list:
    """(repo, number) for each issue referenced in the `Blocked by` section.
    No section, an empty one, or one starting with "None" means no Blockers."""
    section = (_section_text(body, _BLOCKED_BY_HEADING_RE, _BLOCKED_BY_LINE_RE) or "").strip()
    if _NONE_RE.match(section):
        return []
    return _issue_refs(section, repo)


def _blocker(raw: dict, repo: str, number: int) -> tuple:
    """(Blocker, is_open) from an issue payload (native or `gh issue view`)."""
    return (Blocker(repo, number, raw.get("title", "")),
            str(raw.get("state", "")).lower() == "open")


def open_blockers(repo: str, number: int, body: str,
                  client: GitHubClient) -> Optional[tuple]:
    """Every open Blocker of repo#number: native dependencies ∪ `Blocked by`.
    None when the native dependencies cannot be read."""
    native = client.blocked_by(repo, number)
    if native is None:
        return None
    known = {}  # (repo lowercased, number) -> (Blocker, is_open)
    for dep in native:
        url = _URL_RE.match(dep.get("html_url") or "")
        dep_repo = url.group(1) if url else repo
        known[(dep_repo.lower(), dep["number"])] = _blocker(dep, dep_repo, dep["number"])
    for ref_repo, n in blocked_by_section_refs(body, repo):
        key = (ref_repo.lower(), n)
        if key in known:
            continue
        issue = client.get_issue(ref_repo, n)
        # A Blocker whose state is unknown counts as open: fail closed.
        known[key] = _blocker(issue or {"title": "(could not be fetched)", "state": "open"},
                              ref_repo, n)
    return tuple(b for b, is_open in known.values() if is_open)


def resolve_ticket(ref: str, working_dir: str, client: Optional[GitHubClient] = None,
                   resuming: bool = False) -> Union[Ticket, Refusal]:
    """The Ready Ticket ref names, or why it cannot run. resuming=True is a
    --resume of the run that claimed the Ticket, so its in-progress label is
    that run's own claim, not someone else's."""
    client = client or GhClient()
    parsed = parse_reference(ref)
    if parsed is None:
        return Refusal("bad_reference",
                       f"{ref!r} is not a Ticket reference (URL, owner/repo#N, N or #N)")
    repo, number = parsed

    origin = client.origin_repo(working_dir)
    if not origin:
        return Refusal("no_origin", f"{working_dir} has no GitHub origin remote to run a Ticket against")
    if repo is None:
        repo = origin
    elif repo.lower() != origin.lower():
        return Refusal("repo_mismatch",
                       f"Ticket {repo}#{number} is not in the working dir's repo ({origin})")

    issue = client.get_issue(repo, number)
    if issue is None:
        return Refusal("not_found", f"could not fetch {repo}#{number}")

    labels = _label_names(issue.get("labels"))
    if READY_LABEL not in labels:
        found = ", ".join(labels) or "none"
        return Refusal("not_ready",
                       f"{repo}#{number} is not labelled {READY_LABEL} (labels: {found})",
                       labels=labels)
    if IN_PROGRESS_LABEL in labels and not resuming:
        return Refusal("in_progress",
                       f"{repo}#{number} is labelled {IN_PROGRESS_LABEL}: another run or session "
                       "has claimed it. Remove the label once nobody is working on it.",
                       labels=labels)

    blockers = open_blockers(repo, number, issue.get("body") or "", client)
    if blockers is None:
        return Refusal("blockers_unavailable",
                       f"could not read the issue dependencies of {repo}#{number}")
    if blockers:
        listed = "; ".join(f"{b.ref_from(repo)} {b.title}" for b in blockers)
        return Refusal("open_blockers",
                       f"{repo}#{number} has {len(blockers)} open Blocker(s): {listed}",
                       blockers=blockers)

    return Ticket(repo=repo, number=number, title=issue.get("title", ""),
                  body=issue.get("body") or "", labels=labels,
                  url=issue.get("url") or f"https://github.com/{repo}/issues/{number}")


def _spec_issue(repo: str, number: int, issue: Optional[dict], source: str) -> SpecResolution:
    ref = f"{repo}#{number}"
    warning = None
    if issue is None:
        warning = f"Spec {ref} could not be fetched; its state is unknown"
    elif str(issue.get("state", "")).lower() == "closed":
        warning = (f"Spec {ref} is closed; this Ticket may have missed a reroute "
                   "to a newer Spec")
    return SpecResolution(ref=ref, kind="issue", warning=warning, source=source)


def _spec_file(path: str, working_dir: str) -> SpecResolution:
    root = os.path.realpath(working_dir)
    full = os.path.realpath(os.path.join(root, path))
    inside = full == root or full.startswith(root + os.sep)
    warning = (None if inside and os.path.isfile(full)
               else f"Spec file {path} named by the Ticket's `Spec:` line does not exist "
                    f"in {working_dir}")
    return SpecResolution(ref=path, kind="file", warning=warning, source="spec_line")


def resolve_spec(ticket: Ticket, working_dir: str,
                 client: Optional[GitHubClient] = None) -> SpecResolution:
    """The Ticket's parent Spec. First match wins: the GitHub sub-issue parent,
    then a `## Parent` section or `Part of #N` line, then a `Spec:` line naming
    a file in the repo. Never refuses: a missing Spec, a closed Spec issue or
    a missing Spec file each resolve with a warning and the run goes ahead."""
    client = client or GhClient()

    parent = client.parent_issue(ticket.repo, ticket.number)
    if parent and parent.get("number"):
        url = _URL_RE.match(parent.get("html_url") or "")
        return _spec_issue(url.group(1) if url else ticket.repo, parent["number"],
                           parent, "sub_issue")

    refs = _issue_refs(_section_text(ticket.body, _PARENT_HEADING_RE, _PART_OF_LINE_RE),
                       ticket.repo)
    if refs:
        repo, number = refs[0]
        return _spec_issue(repo, number, client.get_issue(repo, number), "parent_section")

    line = (_section_text(ticket.body, None, _SPEC_LINE_RE) or "").strip()
    m = _SPEC_PATH_RE.match(line)
    if m:
        return _spec_file((m.group(1) or m.group(2)).strip(), working_dir)

    return SpecResolution(ref=None, warning=(
        f"Ticket {ticket.ref} has no parent Spec (no sub-issue parent, `## Parent` "
        "section, `Part of #N` line or `Spec:` line); the run has only the Ticket "
        "to judge scope against"))


def plan_type_for(ticket: Ticket, flag: Optional[str], detect: Callable[[str], str]) -> str:
    """--plan-type wins, then a bug/chore/feature label, then keyword detection."""
    if flag:
        return flag
    for label in PLAN_TYPE_LABELS:
        if label in ticket.labels:
            return label
    return detect(ticket.as_plan_input())


def claim_ticket(ticket: Ticket, client: Optional[GitHubClient] = None) -> bool:
    """Mark the Ticket in-progress so no other run or session picks it up.
    Adds that one label and nothing else; ready-for-agent stays. Nothing ever
    removes it: a merged PR closes the Ticket, and a failed run leaves the
    label for a human to clear. False if the label could not be written."""
    if IN_PROGRESS_LABEL in ticket.labels:
        return True
    client = client or GhClient()
    return (client.ensure_label(ticket.repo, IN_PROGRESS_LABEL, IN_PROGRESS_DESCRIPTION,
                                IN_PROGRESS_COLOR)
            and client.add_label(ticket.repo, ticket.number, IN_PROGRESS_LABEL))


def post_run_comment(ticket: Ticket, pr_url: str, run_id: str,
                     client: Optional[GitHubClient] = None) -> bool:
    """The run's one comment on its Ticket. It touches no labels."""
    client = client or GhClient()
    body = f"Draft PR opened for this Ticket: {pr_url}\n\nRun id: `{run_id}`"
    return client.comment(ticket.repo, ticket.number, body)
