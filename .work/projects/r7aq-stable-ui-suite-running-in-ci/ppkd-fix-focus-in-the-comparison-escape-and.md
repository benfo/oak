---
id: ppkd
kind: task
state: open
when: queue
tags: []
rank: 1
created: 2026-11-20
updated: 2026-11-20
---
# Fix focus in the comparison Escape and F6 tests

escape.test.ts: "comparison banner Escape dismisses..." and "F6 reaches an empty comparison result..." fail most runs; focus is not where expected. Likely one cause.
