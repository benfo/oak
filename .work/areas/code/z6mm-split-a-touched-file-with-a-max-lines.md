---
id: z6mm
kind: principle
created: 2026-11-20
updated: 2026-11-20
instead: leaving the warning, or splitting files the task does not touch
because: warnings are worked down gradually, only in files already being changed, so diffs stay focused.
test: npm run lint (ESLint max-lines 300)
---
# Split a touched file with a max-lines warning by responsibility
