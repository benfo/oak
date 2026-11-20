---
id: dqyp
kind: task
state: review
when: next
tags: []
rank: 0
created: 2026-11-20
updated: 2026-11-20
checked: [typecheck, lint, format:check pass; no menu tests, app not driven]
---
# Show in Explorer for files listed in History

Test: npm run dev, History, right-click a file in a commit: Show in Explorer selects it in Explorer; greyed out for a file the commit deleted; a file since removed from disk shows an error toast
