# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

## Workflow labels

Outside the triage roles, one label marks a Ticket as claimed:

| Label         | Meaning                                    |
| ------------- | ------------------------------------------ |
| `in-progress` | Claimed: a run or session is working on it |

A Ticket run adds it when it starts; an interactive session adds it as its first write. It sits
alongside `ready-for-agent` rather than replacing it, and only a human removes it. See
[Claiming a Ticket](issue-tracker.md#claiming-a-ticket-in-progress).

Edit the right-hand column to match whatever vocabulary you actually use.
