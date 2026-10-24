# Oak website

The public site for Oak. Astro with Tailwind and daisyUI, one page (`src/pages/index.astro`), published to `gh-pages` by the `website` workflow when a push to `main` touches `website/`.

## Commands

Install once with `npm ci --prefix website`, then from the repository root:

- `npm run site:dev` serves the site with hot reload.
- `npm run site:check` runs `astro check`.
- `npm run site:build` builds to `website/dist`.

## Layout

- `src/pages/index.astro`: the page. A short hero, the system map, the planned lines and the download section.
- `src/components/SystemMap.astro`: the map. Each feature is a station on one of four lines; selecting a station shows its panel. Without JavaScript every panel is listed and the stations are links. With it the stations become tabs: Left and Right move along a line, Up and Down change line, Home and End jump to the ends, and the URL hash deep-links to a stop (for example `#stage-lines`).
- `src/data/lines.ts`: the lines, stops, copy, shortcuts and screenshots the map shows, plus the planned ideas. Add a feature here, not in markup. A stop needs `shots` or `points` so its panel is not empty.
- `src/components/`: also the screenshot viewer and the theme toggle.
- `src/data/release.json`: the version and download links the page shows. It is pinned to a released version and changes with a release, not with a feature.
- `public/`: screenshots (light and dark pairs) and the icon.

## Rules

- Factual copy only: no sales language and no unsupported "only", "unique" or "fastest" claims. Be honest about platform support (Windows 11 primary, Linux experimental, macOS untested).
- Screenshots are real captures of the app showing a synthetic repository, never a real one. Regenerate them with the dev helper described in `AGENTS.md` rather than editing them. Capture light and dark pairs at the same size (2160x1383, and 2160x761 for diff strips).
- No live demo or simulator.
- Colours, spacing and type come from the site's own tokens in `src/styles/site.css`, which mirror the app's paper, ink and line colours (`DESIGN.md`). Do not add raw values in components. Line colours are signage: use them for lines and stations, not as decoration.
- Keep the station and line grammar consistent with the app's commit graph: hollow ring for a stop, filled ring with a halo for the selected one.
