---
id: m4cw
kind: task
state: open
when: start:ui
tags: [perf]
created: 2026-11-20
updated: 2026-11-20
due: 2026-11-20
---
# Measure Oak on very large repositories

Known: 13,800 refs on one commit waits ~0.6 s on git log decorations; pickers wait ~2 s for branch details.
Not measured: thousands of files in a commit, very large status, huge diffs (commits5k, hugeDiff), expanding context in big files, a real large repo.
Focus refresh and an external git commit not driven by hand.
