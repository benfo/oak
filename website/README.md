# Oak website

The public site for Oak. Astro with Tailwind and daisyUI, one page (`src/pages/index.astro`), published to `gh-pages` by the `website` workflow when a push to `main` touches `website/`.

## Commands

Install once with `npm ci --prefix website`, then from the repository root:

- `npm run site:dev` serves the site with hot reload.
- `npm run site:check` runs `astro check`.
- `npm run site:build` builds to `website/dist`.

## Layout

- `src/pages/index.astro`: the page. Sections alternate between a plain block and a `section-band`, strictly, so adding or removing a section means re-flipping every section after it.
- `src/components/`: screenshot viewer, diff showcase and theme toggle.
- `src/data/release.json`: the version and download links the page shows. It is pinned to a released version and changes with a release, not with a feature.
- `public/`: screenshots (light and dark pairs) and the icon.

## Rules

- Factual copy only: no sales language and no unsupported "only", "unique" or "fastest" claims. Be honest about platform support (Windows 11 primary, Linux experimental, macOS untested).
- Screenshots are real captures of the app showing a synthetic repository, never a real one. Regenerate them with the dev helper described in `AGENTS.md` rather than editing them.
- No live demo or simulator.
- Colours, spacing and type come from the site's own tokens in `src/styles/site.css`. Do not add raw values in components.

## Revamp (starting)

A fresh pass over the whole site. Nothing is decided yet; the first step is agreeing what the page should do before changing any markup. Questions to settle, one at a time:

- Who lands here and what should they do next (download, read about a feature, check platform support)?
- Which sections earn their place, and in what order?
- What does the page claim today that the current app no longer matches (for example the transit-map themes and hidden branches)?
- Do the screenshots need regenerating for the current themes?
- Does the "planned" section still reflect `ROADMAP.md`?

Work happens on `website/` branches, one topic per branch, as described in `CONTRIBUTING.md`.
