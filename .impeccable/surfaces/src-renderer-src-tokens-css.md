---
version: 1
slug: "src-renderer-src-tokens-css"
primary_target: "src/renderer/src/tokens.css"
related_targets: []
---

## Scope
Operate surface: the whole Oak app UI (renderer). Layout, behaviour, keyboard model, focus system and token architecture are fixed. Redesign is a spike; the website is out of scope.

## Direction contract
THESIS: Oak is a transit diagram of your repository. Branches are coloured lines, commits are stations, and the whole app speaks that signage language instead of the grey developer-tool default. It refuses the neutral grey panel plus single blue accent.
OWN-WORLD: Warm off-white paper ground with black ink type in Segoe UI (the user chose to keep the platform font), tight 2px radii like cut signage, saturated line colours (red, blue, green, orange, purple, yellow, lime, brown), thicker 3px lines. Dark theme is a deep ink ground with the same lines lifted. Recognisable with no content: warm paper, ink black, crisp corners, bold line colours.
STORY: A developer sees at a glance which line they are on and where each commit sits, and finishes stage, commit, merge without learning anything new.
FIRST VIEWPORT: Unchanged shell: toolbar on top, branch sidebar left, History graph and Changes in the main area, diff below. The graph is the signature: thick line-coloured routes, commit stations as white-filled ringed dots, merges as interchanges.
FORM: Pick card B, transit map, from the operate roll; seed: 30fe167871016c3b.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
