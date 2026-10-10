# progress-log glossary

The canonical vocabulary for the build-spine progress view. Terms only — no implementation. Kept in the skill dir so it travels with the skill.

- **Build spine** — the rendered page (`index.html`): a vertical timeline of milestone **nodes** answering "where are we, where are we going?" at a glance. The characterful name for the whole view.
- **Rendered view** — the page is *derived*, never authoritative. Every fact on it comes from the log, the roadmap, or git. Opposed to a **source of truth**; the page must never become a sixth one.
- **The log** (`log.jsonl`) — the append-only record of shipped **facts**, one JSON object per task. The only file this skill writes. Never rewritten or reordered.
- **Roadmap framing** (`roadmap.toml`) — the human-authored story: the project header, the milestone list, the active milestone's declared task list, and the horizon. Edited as reviewed diffs, never by the renderer.
- **Node** — one milestone on the spine. Its status (`done` / `active` / `planned`) is hand-set in the roadmap. A `next` node is a look-ahead card (dashed, not counted as a real milestone).
- **Task track** — the nested list of tasks rendered under the *active* milestone's node. Tasks group into labeled sub-tracks by their `group` field.
- **Fact** — one logged task outcome: `{task, title, status, date, summary?, commit?, pr?, evidence?}`. The unit a ship appends.
- **Evidence** — short strings kept with a fact at ship time (a metric line, an ADR ref) — worth recording then rather than re-deriving later.
- **You are here** / **next** — the first active-milestone task with no `done` entry. *Derived*, never written down, so it cannot go stale. Also drives the "Up next" readout tile.
- **Last shipped** — the newest `done` fact (by date, then log order). Drives its readout tile and the footer's "after" stamp.
- **Horizon** — the ordered "where we're going" look-ahead list at the foot of the page, from the roadmap.
- **Structural error** — malformed input (bad JSON line, unparseable roadmap, a logged task the roadmap doesn't declare). The renderer exits non-zero and writes nothing; a ship gate must block. The inputs disagree; fix the fact, not the HTML.
- **Referential drift** — a logged commit sha that no longer resolves (a rebase/squash after the fact). The renderer warns, marks the card ⚠, and still renders. A later history rewrite must never brick shipping.
