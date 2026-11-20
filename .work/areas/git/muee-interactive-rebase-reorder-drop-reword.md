---
id: muee
kind: task
state: open
when: someday
tags: []
created: 2026-11-20
updated: 2026-11-20
---
# Interactive rebase: reorder, drop, reword, merge-aware

Reuse the squash planner (src/shared/rewrite.ts) and scripted-todo engine (src/main/rewrite.ts).
Squashing around a skipped commit is a reorder, so it belongs here (Ctrl+click compares).
2,000 selected commits: 200 ms to summary, 350 ms to dialog, rows not virtualised; revisit near 10,000.
