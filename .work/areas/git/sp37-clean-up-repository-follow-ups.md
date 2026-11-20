---
id: sp37
kind: task
state: open
when: someday
tags: []
created: 2026-11-20
updated: 2026-11-20
---
# Clean up repository follow-ups

Stale stashes (older than ~30 days or from a deleted branch, unticked) as a group.
A status bar item only when the check finds something (cheap background check after fetch).
Later, opt-in: git maintenance start, git fsck, git lfs prune.
Not wanted: one-click boost, health score, reflog expiry, gc --prune=now, bulk remote deletes, automatic cleanup.
Open: should gone branches with unmerged commits start ticked (they do); detect squash merges?
