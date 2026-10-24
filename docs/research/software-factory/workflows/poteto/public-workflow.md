# Lauren Tan (poteto): the public record of her "agents merge while I sleep" workflow

**Date:** 2026-10-24
**Question:** From what Lauren Tan has said and published herself, how does her hands-off, autonomous ("coding while sleeping") development workflow work, how did it evolve, and why does it work?
**Scope:** Her public statements: talks, livestreams, interviews, X posts and X articles, GitHub repos, plus Cursor and SpaceXAI product docs for the features she relies on. pstack's file contents are covered in [pstack-mechanics.md](pstack-mechanics.md) and are not repeated here. This goes beyond [verification-loop-research.md](../../../verification-loop-research.md), which had no transcript of the Pocock livestream.
**Method:** The English auto-captions for six YouTube videos were pulled directly from YouTube's caption endpoint. Five of the six are recordings of her speaking; the sixth is a third-party read-aloud of one of her articles. Her X posts and X articles were read through the public fxtwitter API, because x.com itself blocks fetches. Her GitHub repos were read with `gh`. Quotes from videos come from machine captions, lightly cleaned of filler words ("uh", "um") and obvious mishearings: the captions render "pstack" as "PAC" and "Grok Bot" as "graphbot".

**Source labels:**
- **[P]** is primary: her own words, as a post, article, repo, or video of her speaking.
- **[P, re-upload]** is a recording of her speaking, but on a third-party channel.
- **[S]** is secondary: someone else's summary.
- **[V]** is vendor product documentation.

---

## Summary

Tan's autonomy does not come from a clever orchestrator. It is the end state of a trust curve, which she climbed in this order:

1. She gave agents the same instruments she uses, so they can verify their own work. For an Electron app that means a CLI over the Chrome DevTools Protocol, plus a "feature map" of the app.
2. She made the codebase so constrained that the easy path is the correct one. Her framework, "Dune", bans code comments, bans `useEffect`, and enforces process boundaries through the import graph.
3. She wired in an "outer loop" of event sources (Slack, X, Linear, Sentry and similar) that feeds work into an "inner loop" of coordinator agents. In Cursor these are Automations and Projects; in Grok Bot they are routines and bots.
4. She turned on self-merge, so pull requests (PRs) land without her. She now does code review "by looking at what they landed on main when i was away or asleep" ([P, X, 2026-08-11](https://x.com/poteto/status/2087244771849089270)).

**Why it works, in her words:**
- Verification is the "limiting step" of the whole loop.
- The codebase is the agents' memory, so agents copy whatever patterns it contains.
- Every recurring correction should become a lint rule, an architectural constraint or a skill, not a reminder.

The famous numbers are self-reported and unaudited:
- 2,500 PRs in a month, per her post.
- 2,000, per the talk audio and the pstack guide.
- About 20 PRs merged overnight.
- More than 600 PRs to refactor Grok Bot onto Dune.

She works at an AI lab with, in her words, "unlimited tokens". That is the largest caveat for anyone copying the setup.

**The "SpaceX" framing.** Pocock's stream title says "SpaceX". More precisely, she works at SpaceXAI:
- SpaceX agreed to acquire Cursor's maker, Anysphere ([S, techzine](https://www.techzine.eu/news/devops/142197/spacex-acquires-cursor-for-60-billion/)).
- xAI had already merged into SpaceX ([S, datanorth](https://datanorth.ai/news/spacex-acquires-cursor-maker-anysphere)).
- Her GitHub bio reads "Software Engineer @xai-org & @react compiler core team" ([P, GitHub API `users/poteto`](https://github.com/poteto)).
- Her X bio reads "grok @bot at @SpaceXSI. react compiler core team, prev cursor, meta, netflix" ([P, X profile via fxtwitter](https://api.fxtwitter.com/poteto/status/2102050467505430555)).

**Correction to the brief.** She no longer describes herself as "at Cursor". She now works on Grok Bot, and the PRs are mostly into the Grok Bot and Cursor codebases. Nothing points to SpaceX rocket software.

---

## Timeline of how the workflow evolved

| When | What | Source |
|---|---|---|
| Apr 2025 | Builds a toy MCP server for React Compiler. Her hypothesis: "agents should get the same signals human engineers use … compiler diagnostics, lints, static analysis." She later called MCP "the wrong medium". | [P, "Loops You Can Trust"](https://x.com/poteto/status/2069824386283319343) |
| Oct 2025 | At React Conf she is still the cautious voice: AI is best "as a pair … not a tool to just replace the act of writing code". | [S, mvanhorn profile quoting React Conf 2025](https://x.com/mvanhorn/status/2111481455906103390) |
| Jan–Feb 2026 | Burnt out after Meta, she takes a month off and builds a side project. Micromanaging one agent leads her into orchestration and skills. This becomes `poteto/noodle` (repo created 2026-02-22) and `poteto/brainmaxxing` (created 2026-02-27), which she later calls "the basis of pstack". | [P, Pocock stream 3:08–4:12](https://www.youtube.com/watch?v=MN9dGgmLyso&t=188s); GitHub repo metadata |
| Mar 2026 | Joins Cursor; she says "March", and a secondary source gives the week of March 24. On day 2 she is asked to fix the performance of "glass", the Agents Window, which launches within days. Working by hand she is "the meat proxy between my agent and Chrome DevTools". | [P, stream 4:43–5:16](https://www.youtube.com/watch?v=MN9dGgmLyso&t=283s); [P, Loops article](https://x.com/poteto/status/2069824386283319343) |
| Mar–Apr 2026 | Builds `/control-glass`, a skill that launches a dev build with the Chrome DevTools Protocol (CDP) enabled. Agents can click and type, read the accessibility tree, take screenshots and video, throttle CPU and network, and capture CPU profiles and heap snapshots. She adds worktree isolation so parallel agents don't collide, then finds that parallel agents just produce "more to review and discard". | [P, Loops article](https://x.com/poteto/status/2069824386283319343) |
| Mar 2026 onward | Cursor ships Automations: "That was the missing piece!" She builds a Slack-fed chain of automations: triage, then reproduce, then fix. She also builds "Benny", a Slack bot that reproduces bug reports on its own cloud computer, motivated by "how would I make it so my agents could just automatically fix bugs for me while I sleep". | [P, Loops article](https://x.com/poteto/status/2069824386283319343); [P, MTS interview 11:54](https://www.youtube.com/watch?v=A63sedG-p5Q&t=714s); [P, Maven workshop 27:49, re-upload](https://www.youtube.com/watch?v=ONeM6YDmvqA&t=1669s) |
| Jun 2026 | Commits the `orchestrate` plugin to `cursor/plugins`. It fans a task out over Cursor cloud agents through the SDK, with planner, subplanner, worker and verifier roles and Slack mirroring. On 2026-06-24 she publishes "Loops You Can Trust". | [P, cursor/plugins/orchestrate](https://github.com/cursor/plugins/tree/main/orchestrate); [P, poteto/benny-avatars](https://github.com/poteto/benny-avatars) |
| ~Jul 2026 | Starts on Grok Bot "about 2 months ago" (counting back from Aug 31). Secondary sources put her July PR count at about 1,000. | [P, pstack guide Pt 1](https://x.com/poteto/status/2094457600259842065); [S, mvanhorn](https://x.com/mvanhorn/status/2111481455906103390) |
| Aug 11, 2026 | Grok Bot launches. She has refactored its client onto "Dune", an "agent friendly framework" that lets agents with "very little context" write "high quality code by default". The same day she posts that agents now merge their own PRs. | [P, launch post](https://x.com/poteto/status/2087227636590465030); [P, reply](https://x.com/poteto/status/2087244771849089270) |
| Aug 12–13, 2026 | Maven workshop with Colin Matthews ("woke up today and there were like 20 PRs landed"), then the MTS interview. | [P, re-upload](https://www.youtube.com/watch?v=ONeM6YDmvqA); [P, MTS](https://www.youtube.com/watch?v=A63sedG-p5Q) |
| Aug 31, 2026 | Publishes "The Complete Guide to pstack Pt. 1 – Verification is all you need". | [P](https://x.com/poteto/status/2094457600259842065) |
| Sep 10, 2026 | Cursor launches Projects (coordinator agents), which later becomes her "inner loop". | [V, Cursor blog](https://cursor.com/blog/projects) |
| Sep 21, 2026 | Posts the talk prepared for Cursor Compile London: "here's how i shipped 2,500 PRs last month to production". It reaches about 4.07M views. | [P, X](https://x.com/poteto/status/2102050467505430555); [P, re-upload with captions](https://www.youtube.com/watch?v=NjoZoUm85x0) |
| Sep 27, 2026 | Peter Yang interview: a demo of her bot hierarchy (chief of staff, engineering lead, engineer bots that spawn cloud agents). | [P, Peter Yang](https://www.youtube.com/watch?v=xZ5TEaleUdg) |
| Oct 2, 2026 | Matt Pocock livestream. She describes the "dark factory", more than 10 chiefs of staff, and Grok Bot as the outer loop with Cursor Projects as the inner loop. | [P, Pocock stream](https://www.youtube.com/watch?v=MN9dGgmLyso) |

---

## Stated principles and quotes

All quotes are primary unless marked otherwise.

### 1. Trust is the bottleneck, not agent count

- "you can't go to a 100 agents … spawn 100 agents when you don't even trust the output of one agent" ([Maven 4:48](https://www.youtube.com/watch?v=ONeM6YDmvqA&t=288s), P re-upload).
- "if you don't have trust and you try to spawn 100 sub agents or cloud agents you're going to quickly find that you're just going to get a ton of slop pull requests" ([Compile talk 6:13](https://www.youtube.com/watch?v=NjoZoUm85x0&t=373s)).
- The one-to-five agent "babysitting" phase "is actually the hardest to get out of" ([Compile talk 5:42](https://www.youtube.com/watch?v=NjoZoUm85x0&t=342s)).
- "Make loops autonomous only after it earns your trust." This is the last of five rules closing the [Loops article](https://x.com/poteto/status/2069824386283319343). The first four:
  1. "Do the work by hand first, so you know what good looks like."
  2. "Give agents the same tools and signals you use."
  3. "Make every stage prove its work and stop when it doesn't meet the bar."
  4. "Read the transcripts and turn recurring failures into tools, skills, or evals."

### 2. Verification is the limiting step, and the definition of a loop

- "Verification has become the limiting step, or long pole of software development: it's the stage that constrains the output of the whole loop." This sits on top of Andy Grove's *High Output Management* breakfast-factory analogy ([Loops article](https://x.com/poteto/status/2069824386283319343)).
- "if the agent can't actually see the result of its work there's no way it can actually iterate … the most important part of a loop that allows it to be a loop is the verification part" ([Pocock stream 17:05–17:36](https://www.youtube.com/watch?v=MN9dGgmLyso&t=1025s)).
  - **Correction:** the earlier research doc marked "most important part of the loop" as an unverified paraphrase. It is close to her actual wording.
- "the single most important skill that should be in your toolkit is verification" ([stream 16:03](https://www.youtube.com/watch?v=MN9dGgmLyso&t=963s)).
- "I think of it more like critical infrastructure rather than 'just' a skill … You may even want to put an oncall rotation on it" ([pstack guide Pt 1](https://x.com/poteto/status/2094457600259842065)).
- "I would unironically suggest building your own rich debugging tools, or even choosing a different tech stack" so that agents can verify their work ([pstack guide Pt 1](https://x.com/poteto/status/2094457600259842065)).
- **Artifacts over claims.** "'I fixed it' isn't good enough. Show me the failing test and the passing test. Show me the before and after video … If the fix merged, run it again on main and show me that too" ([Loops article](https://x.com/poteto/status/2069824386283319343)).

### 3. Every stage can stop the line

"One key aspect of building trustworthy loops is that every stage can stop the line."
- Triage can decide a report is not a bug.
- Repro can fail to reproduce it.
- The fixer can decide the change is too risky.

"Those are all useful outcomes because they keep bad work from flowing into the next stage." A related rule: "catch defects at the lowest value stage" ([Loops article](https://x.com/poteto/status/2069824386283319343)).

### 4. Determinism for mechanical parts, judgment for fuzzy parts ("Build the Lever")

- She moved the verification CLI into the skill because, without it, "every agent … would basically rebuild the world each time and then every agent did it differently" ([stream 22:49–23:19](https://www.youtube.com/watch?v=MN9dGgmLyso&t=1369s)).
- "I try to extract out the deterministic parts and turn that into code and just leave only the parts that actually require judgment to the agent" ([stream 21:47](https://www.youtube.com/watch?v=MN9dGgmLyso&t=1307s)).
- For migrations: "Do the first unit by hand to learn the recipe, then have the agent write a codemod for the mechanical parts and a checker that proves the output" ([Loops article](https://x.com/poteto/status/2069824386283319343)).
- Agent-friendly CLI properties ([pstack guide Pt 1](https://x.com/poteto/status/2094457600259842065)):
  - deep, composable modules
  - `--dry-run` on anything destructive
  - subcommands that disclose functionality gradually
  - error messages that say what to do instead
  - rich `--help`
  - JSON output

### 5. The codebase is the memory, so lock it down ("Michelin kitchen", "gardener")

- "the code base is really like the best form of memory because agents love to extend existing patterns that they see" ([Compile talk 15:34](https://www.youtube.com/watch?v=NjoZoUm85x0&t=934s)).
- Anti-patterns "spread like a virus": "one small workaround or a comment that explains a workaround … in a matter of a few days or a few weeks … has become like a de facto pattern for all agents" ([Compile talk 20:47–21:18](https://www.youtube.com/watch?v=NjoZoUm85x0&t=1247s)).
- **Comments banned in Dune.** Agents "were just using the comments around the code as justification for why it wasn't going to solve the actual problem" ([Compile talk 23:22–23:54](https://www.youtube.com/watch?v=NjoZoUm85x0&t=1402s)).
- **Dune rules:**
  - Delete existing tech debt.
  - Keep "a single paved path" for blessed patterns.
  - "whenever you see tech debt or bad patterns, your instinct should be I need to write a lint rule against it … you can at least stop the bleeding" ([Compile talk 25:26–25:58](https://www.youtube.com/watch?v=NjoZoUm85x0&t=1526s)).
  - Electron main-process and renderer code is kept apart through import-graph enforcement, a lesson from Cursor Agents Window performance regressions ([Compile talk 27:32–29:06](https://www.youtube.com/watch?v=NjoZoUm85x0&t=1652s)).
  - Dune is "kind of like an internal Next.js for our Electron apps"; it is not open source ([stream 30:07](https://www.youtube.com/watch?v=MN9dGgmLyso&t=1807s)).
  - Features are discovered through a registry. The early Grok Bot was "like eight god files which were like at least 10,000 lines long" ([stream 30:38–31:09](https://www.youtube.com/watch?v=MN9dGgmLyso&t=1838s)).
- **Agents absorb the friction.** "It's actually very annoying to write code in Grok Bot but like agents absorb all of that annoyance" ([Maven 37:43](https://www.youtube.com/watch?v=ONeM6YDmvqA&t=2263s)).
- **Correction order** when an agent errs, strongest first: make it categorically impossible in code or architecture, then static analysis (lint, CI, compiler), then rules, Bugbot and skills, then a human style guide as the last resort ([Compile talk 15:34–18:12, 35:55–37:00](https://www.youtube.com/watch?v=NjoZoUm85x0&t=2155s)). The earlier research doc covers this hierarchy from secondary sources; the talk confirms it.
- Every team needs "a role that I'm calling a gardener" ([Compile talk 24:25](https://www.youtube.com/watch?v=NjoZoUm85x0&t=1465s)). She calls herself "Grok Bot's gardener and maintainer", keeping quality high while "the team … [lands] hundreds of PRs a day" ([pstack guide Pt 1](https://x.com/poteto/status/2094457600259842065)).

### 6. Context, not control; remove yourself as the proxy

- She brings the Netflix management maxim "context not control" to agents ([stream 40:45–41:48](https://www.youtube.com/watch?v=MN9dGgmLyso&t=2445s)).
- "always thinking about … where am I the bottleneck in this process? Why do my agents need me … to answer this question?" ([stream 37:31–38:04](https://www.youtube.com/watch?v=MN9dGgmLyso&t=2251s)).
- The noodle "brain" principle "Never Block on the Human": "Design workflows for review-after-the-fact, not approval-before-the-fact … Irreversible actions … still require confirmation" ([P, noodle/brain/principles/never-block-on-the-human.md](https://github.com/poteto/noodle/blob/main/brain/principles/never-block-on-the-human.md)).

### 7. Learn from transcripts; turn corrections into structure

- "observe the bot or agent doing the work and then you course correct it. But then at the end of the conversation, you turn that into a skill" ([Peter Yang 39:48](https://www.youtube.com/watch?v=xZ5TEaleUdg&t=2388s)).
- "The past chats … are a treasure trove of context … it's the process materialized" ([stream 1:02:00–1:02:31](https://www.youtube.com/watch?v=MN9dGgmLyso&t=3720s)).
- noodle's "Encode Lessons in Structure" principle: "The instruction IS the symptom — if you're writing 'don't do X' in a prompt, ask whether you can make X impossible instead" ([P, noodle principle](https://github.com/poteto/noodle/blob/main/brain/principles/encode-lessons-in-structure.md)).
- She evaluates skill changes before merging them. An eval playbook spawns subagents running different models in directories "cleverly named to not let the sub agent know that it's being evaluated", and a judge from a different model scores them ([Maven 20:29–24:05](https://www.youtube.com/watch?v=ONeM6YDmvqA&t=1229s); [Peter Yang 17:14](https://www.youtube.com/watch?v=xZ5TEaleUdg&t=1034s)).

### 8. Sample, don't block

"you cannot be tasting every single dish … it becomes more about sampling". When several agents take the same shortcut, "that's a sign that you should go off and think about how to amend your kitchen … not that single agent" ([stream 49:34–50:35](https://www.youtube.com/watch?v=MN9dGgmLyso&t=2974s)).

---

## Tooling and infrastructure she relies on

| Layer | What she uses | Notes and source |
|---|---|---|
| Verification | A per-app "control" skill: a CLI over CDP and Playwright plus a `references/features/` feature map. Examples are `/control-glass` (Cursor) and `/control-app`. | "It's just a bunch of glue" ([stream 22:17](https://www.youtube.com/watch?v=MN9dGgmLyso&t=1337s)). Every Cursor and SpaceXAI app now has one, "automaintained" ([stream 19:09](https://www.youtube.com/watch?v=MN9dGgmLyso&t=1149s)). A fictional example is in [poteto/verification-skill-example](https://github.com/poteto/verification-skill-example). She runs `/maintain-verification-skill` daily, and an automation maintains the feature map ([Compile talk 11:25](https://www.youtube.com/watch?v=NjoZoUm85x0&t=685s)). |
| Parallelism | Cursor cloud agents rather than local worktrees | "I would recommend against [worktrees] … you may be able to get away with running up to 10 agents" locally. Cloud agents have "a real computer" with a snapshot of the environment after the first build ([pstack guide Pt 1](https://x.com/poteto/status/2094457600259842065)). |
| Fan-out | `/swarm` (pstack) and `orchestrate` (cursor/plugins) | `/swarm` "fans out any number of cloud agents to run your verification skill", for example to confirm a performance win "with a big enough sample size, or fuzz your app" ([guide Pt 1](https://x.com/poteto/status/2094457600259842065)). [`orchestrate`](https://github.com/cursor/plugins/tree/main/orchestrate) runs a planner/worker tree over the Cursor SDK, reconciled "from disk and git", with an Andon `:rotating_light:` reaction to stop a run. |
| Inner loop | Cursor Projects: a coordinator agent on its own cloud computer that "doesn't write code itself but directs other agents". It can watch Slack, run on a schedule, or follow PRs and fix CI. | [V, Cursor blog](https://cursor.com/blog/projects). She says: "cursor projects are my inner loop and Grok Bot is my outer loop" ([stream 43:52](https://www.youtube.com/watch?v=MN9dGgmLyso&t=2632s)). |
| Event-driven automation | Cursor Automations: cloud agents triggered by a schedule or cron, GitHub, GitLab, Bitbucket, Slack, webhooks, Linear, Sentry or PagerDuty. They open PRs by default and keep a `MEMORIES.md` across runs. | [V, Cursor docs](https://cursor.com/docs/cloud-agent/automations). Her Slack-to-triage-to-repro-to-fix chain is built on these ([Loops article](https://x.com/poteto/status/2069824386283319343)). |
| Outer loop | Grok Bot bots with connectors (Slack, X, email, calendar, Linear, Datadog, Sentry, PlanetScale) and **routines** (subscriptions or schedules) | Bots can start Cursor cloud agents ([MTS 15:01](https://www.youtube.com/watch?v=A63sedG-p5Q&t=901s); [Compile talk 32:46–34:20](https://www.youtube.com/watch?v=NjoZoUm85x0&t=1966s)). She calls the "company brain" idea "unnecessarily complex": "agents are really good at using tools." |
| Bot hierarchy | Chief of staff, then an engineering lead ("matcha"), then engineer bots that "never do work on your own and always delegate", each spawning cloud agents. Also a social bot ("Potato") that checks X mentions every ~30 minutes and aggregates bug reports, and "Dr. Eggbot", which designs bots and audits existing ones through a routine. | [Peter Yang 18:50–27:15, 33:03](https://www.youtube.com/watch?v=xZ5TEaleUdg&t=1130s). On the stream: "more than 10 chiefs of staff, each working on a different area" ([stream 52:09](https://www.youtube.com/watch?v=MN9dGgmLyso&t=3129s)). |
| Review | Bugbot on CI; pstack verifier agents; `/show-me-your-work` decision log, cross-checked by a model from a different family | [Compile talk 17:07](https://www.youtube.com/watch?v=NjoZoUm85x0&t=1027s); [Loops article](https://x.com/poteto/status/2069824386283319343) |
| Models | Picked per task through cloud agents, adjusting reasoning level for speed or depth. She says "I love Opus 5.5". Skills are evaluated across models. She cites Grok 4.6's "same cost per token as 4.5". | [Peter Yang 26:42](https://www.youtube.com/watch?v=xZ5TEaleUdg&t=1602s); [stream 6:47](https://www.youtube.com/watch?v=MN9dGgmLyso&t=407s); [Maven 22:03, 54:32](https://www.youtube.com/watch?v=ONeM6YDmvqA&t=1323s). There is no public statement of which model writes most of her PRs. |
| Per-person modes | Internally "everyone has … their own mode skills". `poteto-mode` is called "lauren mode" internally, and there is also a "peng mode". Plugins interoperate between Cursor and Grok Bot. | [Peter Yang 30:24–31:29](https://www.youtube.com/watch?v=xZ5TEaleUdg&t=1824s) |

---

## The "while sleeping" loop as she describes it

This is assembled from her own descriptions. Step numbers are this doc's, not hers.

1. **Intake (outer loop).** Grok Bot routines and Cursor Automations watch Slack feedback channels, X mentions, email, Linear, Sentry and similar. She tells them, for example, to "watch for issues with bugs in the Grok Bot desktop app … and whenever you find that send it to my cursor project" ([stream 42:19–42:49](https://www.youtube.com/watch?v=MN9dGgmLyso&t=2539s)).
2. **Triage.** An automation downloads screenshots and videos and uses the feature map to work out which feature a vague report is about. It checks the reporter's version, de-duplicates, and searches code and history. It "leaves behind a ticket and a handoff", or stops if the report is not a bug ([Loops article](https://x.com/poteto/status/2069824386283319343)).
3. **Reproduce.** A cloud agent opens a real build, follows the reporter's path, and "has to hit the exact broken state twice and capture screenshots and video". Sometimes it finds the bug is "already fixed on main", which saves an hour of human checking ([Loops article](https://x.com/poteto/status/2069824386283319343); [Maven 28:20](https://www.youtube.com/watch?v=ONeM6YDmvqA&t=1700s)).
4. **Human veto window.** "Before the fix starts, the thread stays open for humans to correct or reject the repro" ([Loops article](https://x.com/poteto/status/2069824386283319343)).
5. **Coordinate.** Related reports go to one Cursor Project coordinator rather than one agent per bug. "When I looked at this one report, I thought the bug was here, but actually when I see the other multitude of bugs it's actually up here" ([stream 44:23–44:54](https://www.youtube.com/watch?v=MN9dGgmLyso&t=2663s)).
6. **Fix.** The fixer picks up "the warm build and all the evidence". It writes a test where it can, makes "the smallest fix it can prove", and runs before and after. In the June version of the chain, this step opened a *draft* PR ([Loops article](https://x.com/poteto/status/2069824386283319343)).
7. **Verify and land.** In pstack's "full autopilot" mode, "it will spawn a bunch of verifier agents for every pull request and it will fuzz … run the application … click around … look for regressions … then it will fix it itself … and eventually get the PR to a state where it can land." She adds: "It is quite token intensive. You can tune this … instead of like 10 verifier agents you might do like one" ([stream 52:41–53:44](https://www.youtube.com/watch?v=MN9dGgmLyso&t=3161s)).
   - **Correction:** the earlier research doc said, from secondary sources, that she "cut from ten verifiers to one". The transcript shows she offers this as a tuning option, not as something she did.
8. **Morning review on main.** "I'll review it in the morning by looking at my commit history and if I see problems, I go and course correct … revert or modify, add new lint rules" ([stream 53:44–54:17](https://www.youtube.com/watch?v=MN9dGgmLyso&t=3224s)).
9. **Buffered gardening.** Not every finding becomes a PR straight away. "I have an agent that's just constantly looking for banned patterns … I don't actually tell it to fix the issue first. I tell it to append it to a document. And then every couple of days I look at it", because a queue "forces you to think about the big picture" ([stream 47:27–48:31](https://www.youtube.com/watch?v=MN9dGgmLyso&t=2847s)).
10. **Incremental migrations.** The StyleX automation "migrates one leaf component in Cursor at a time". It captures computed styles across themes and states, and "a failed build or parity check ends the run". This came out of a failed ~400K-line big-bang PR ([Loops article](https://x.com/poteto/status/2069824386283319343)).

**Is it really "dark"?** Asked whether it is a dark factory, she said "It kind of is … if my agents are merging their own pull requests it's sort of become dark where I go to sleep my agents now work 24/7." On switching it on: "the very first day I turned on the sort of dark factory was very scary … it took a lot of bravery" ([stream 51:38–54:48](https://www.youtube.com/watch?v=MN9dGgmLyso&t=3098s)).

**Where it does not apply.** One-way-door domains: "it all comes back to … the quality of the verification … for domains where the work is verifiable … the one-way doors become two-way doors … I don't really have the answer." She points to proof-carrying languages (Bend, Lean, TLA+) as the long-term route ([stream 56:21–59:24](https://www.youtube.com/watch?v=MN9dGgmLyso&t=3381s)).

---

## Numbers and claims, and how well they are verified

| Claim | Source type | Verification status |
|---|---|---|
| 2,500 PRs to production "last month" (posted Sep 21, so August) | P, [X post](https://x.com/poteto/status/2102050467505430555) | Self-reported. The talk audio in the same video says "2,000" ([0:00:01](https://www.youtube.com/watch?v=NjoZoUm85x0)). The Aug 31 guide says "2,000 PRs a month". The two figures probably reflect different counting windows; unaudited either way. |
| About 1,000 PRs in July | S, [mvanhorn](https://x.com/mvanhorn/status/2111481455906103390) | Not found in her own words |
| About 20 PRs merged overnight, reviewed on main the next morning | P, [Maven 5:20](https://www.youtube.com/watch?v=ONeM6YDmvqA&t=320s) | A single anecdote |
| More than 600 PRs to refactor Grok Bot onto Dune | P, [Maven 36:41](https://www.youtube.com/watch?v=ONeM6YDmvqA&t=2201s) | Self-counted |
| The Grok Bot team lands "hundreds of PRs a day" | P, [guide Pt 1](https://x.com/poteto/status/2094457600259842065) | Self-reported; covers the whole team |
| More than 10 "chiefs of staff" running concurrently | P, [stream 52:09](https://www.youtube.com/watch?v=MN9dGgmLyso&t=3129s) | Self-reported |
| A verification skill done well means "you will 100-1000x your whole team's output" | P, [guide Pt 1](https://x.com/poteto/status/2094457600259842065) | Rhetorical; no measurement offered |
| "I work at an AI lab where we have unlimited tokens" | P, [Maven 51:23](https://www.youtube.com/watch?v=ONeM6YDmvqA&t=3083s) | Her own caveat on cost. She frames the up-front token spend on refactoring as an ROI decision. |
| Cursor Projects users "merge six times as many" PRs | V, [Cursor blog](https://cursor.com/blog/projects) | Vendor-reported |
| 30–40% of PRs "in Cursor's ecosystem now merge without human review" | S, Cursor's John Gilhuly via [Arize](https://arize.com/blog/inside-cursors-agent-factory-how-it-verifies-ai-written-code/) | An estimate by a Cursor field engineer, not by Tan |
| A >5,000 PRs over six months slide | S, [webreactiva](https://www.webreactiva.com/blog/confianza-agentes-2500-prs) | Not checked against the slide |

No source independently counts her merged PRs. No public GitHub data could confirm them either, because the Grok Bot and Cursor repos are private (`anysphere/everysphere` is named as private in [benny-avatars](https://github.com/poteto/benny-avatars)). Nobody has reported defect or revert rates for the self-merged PRs.

---

## Relevant repos

| Repo | One line |
|---|---|
| [cursor/plugins/pstack](https://github.com/cursor/plugins/tree/main/pstack) | Her daily skill pack: `/poteto-mode`, verification, swarm, eval playbook. Covered in doc 02. |
| [cursor/plugins/orchestrate](https://github.com/cursor/plugins/tree/main/orchestrate) | Fans a large task across Cursor cloud agents through the SDK: planner, worker and verifier tree, reconciled from disk and git, with Slack mirroring and an Andon stop. Commits by "lauren", June 2026. |
| [poteto/noodle](https://github.com/poteto/noodle) | Her pre-Cursor (Feb 2026) Go orchestrator. Skills carry a natural-language `schedule:` field; a scheduler agent writes `orders.json`; workers run in worktrees and merge serially. Has `auto`, `supervised` and `manual` modes ("a trust dial, not a capability switch"). Includes a `brain/` of principles. |
| [poteto/brainmaxxing](https://github.com/poteto/brainmaxxing) | A persistent memory vault (Obsidian markdown) with `/reflect`, `/ruminate` (mines past transcripts), `/meditate` (prunes notes and feeds them back into skills), `/plan` and `/review`. |
| [poteto/verification-skill-example](https://github.com/poteto/verification-skill-example) | A fictionalized verification skill with ~30 feature-map files. It shows the shape: launch, doctor, drive, prove, clean up. |
| [poteto/how](https://github.com/poteto/how) | `/how`: explains an architecture through parallel explorer subagents and a synthesizer, with an optional multi-model critique. |
| [poteto/benny-avatars](https://github.com/poteto/benny-avatars) | Avatars for the internal `orchestrate` Slack bot. Confirms the roles kickoff, planner, subplanner, worker and verifier, and that the source repo is the private `anysphere/everysphere`. |
| [poteto/stylex](https://github.com/poteto/stylex) | A fork. It relates to the StyleX migration automation described in the Loops article. |
| [potetoai/lodestar-harness](https://github.com/potetoai/lodestar-harness) | **Probably not hers.** It belongs to an account named "Poteto" created 2026-08-26, with no link to her. Do not cite it as her work. |

She has no personal blog; [poteto.github.io](https://github.com/poteto/poteto.github.io) only redirects to the noodle docs. Her long-form writing is in X articles:
- "Loops You Can Trust" (2026-06-24)
- "The Complete Guide to pstack Pt. 1" (2026-08-31)

---

## Gaps and unverified claims

- **Earlier verification post.** "Loops You Can Trust" refers back to a "previous post" saying the bottleneck with agents is verification. It was not located.
- **Later pstack guide parts.** Part 2 and later of "The Complete Guide to pstack" were not found. They may not be published yet.
- **Example automation skills.** The open-sourced example automation skills promised in "Loops You Can Trust" were not located by URL. `cursor/plugins/pstack/automations/` contains only `benny/`, which is the likely candidate but was not opened, since pstack is out of scope here.
- **Transcript quality.** The transcripts are YouTube auto-captions, not human transcripts. Quotes were lightly cleaned. Timestamps are accurate to about 30 seconds, because captions were bucketed in 30-second chunks.
- **Maven workshop.** The original Maven page ([maven.com/p/e23d9c](https://maven.com/p/e23d9c/how-cursor-turned-ai-agents-into-better-engineers)) was not opened. The workshop's content comes from a third-party YouTube re-upload, though that recording is her speaking.
- **Peter Yang newsletter.** The paid Behind the Craft write-up was not read; the free YouTube interview was used instead. The "20+ agent team (chief of staff, three managers, 16 workers)" figure comes only from a secondary search summary.
- **Biographical details.** Details from Matt Van Horn's long X profile are secondary, though it quotes her: Singapore, finance at Monash, ThePriceGeek, DockYard, Netflix, joining Cursor the week of March 24, about 1,000 PRs in July, Grok Bot Galaxy.
- **Merge gate.** The exact merge gate (required CI, number of verifiers, which PR classes are exempt) was never stated publicly beyond "a bunch of verifier agents for every pull request". Doc 02 covers what pstack itself encodes.
- **Models.** Which model or models write most of her PRs, and her per-PR token cost, are not stated anywhere.
- **Dune.** Dune is closed source; its rules are known only from her descriptions.
- **Track record.** No independent data exists on regression or revert rates for the self-merged PRs. Her own one-way-door caveat stands.
