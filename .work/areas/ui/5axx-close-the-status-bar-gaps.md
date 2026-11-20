---
id: "5axx"
kind: task
state: done
when: start:ui
tags: []
created: 2026-11-20
updated: 2026-11-20
done_on: 2026-11-20
checked: [typecheck, lint, format pass, "unit (status, notice, watch, map): 19 pass", "UI status-items, status-bar, zoom: 18 pass", "3 new UI tests fail without the fix"]
---
# Close the status bar gaps

Test: Repo with a remote added but never fetched: bar says Not fetched yet, Fetch works; bar facts appear at once; Ctrl+= on Welcome shows the zoom bubble

No bar on Welcome, so zoom shows no feedback there; a late item (identity, latest commit) shifts neighbours for about a frame.
Decided: no global key for git output for now.
