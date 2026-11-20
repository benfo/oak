---
id: ppkd
kind: task
state: review
when: queue
tags: []
rank: 1
created: 2026-11-20
updated: 2026-11-20
checked: [typecheck, lint, format pass, both comparison tests pass 3/3 (failed before)]
---
# Fix focus in the comparison Escape and F6 tests

Test: Review escape.test.ts wait and fixtures.ts cleanup order

escape.test.ts: "comparison banner Escape dismisses..." and "F6 reaches an empty comparison result..." fail most runs; focus is not where expected. Likely one cause.
