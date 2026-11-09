# Marketing plan

How Oak reaches developers. Copy rules from `ROADMAP.md` apply: factual, no sales language, no unsupported "only" or "unique" claims, the command palette featured, no live demo. Nothing here is agreed until the maintainer says so; the roadmap links here and holds status.

## Positioning

One sentence to test: a keyboard-first Git client that runs your real `git`, so hooks, credentials and LFS behave exactly like the command line.

Three hooks to lead with:

1. The command palette, with concrete examples and shortcuts.
2. The real Git CLI, no bundled Git library.
3. Line-level staging and Blame, driven from the keyboard.

Be upfront about the tradeoffs: Electron, Windows first, Linux experimental, macOS untested.

## Phase 0: before any launch (1 to 2 weeks)

- Get code signing underway (see `ROADMAP.md`). An unsigned installer costs the most first-time installs.
- Package for `winget`, then Scoop and Chocolatey if cheap. "winget install" is the easiest way to try a Windows app.
- Rewrite the README top: a 20 to 30 second capture of the palette and keyboard staging, one install line, honest platform status.
- Label 5 to 10 real issues "good first issue".
- Make a social card for the repo and the website.
- Publish SHA-256 checksums and build provenance (GitHub artifact attestations) with each release.
- No telemetry without a separate discussion. Count release downloads and winget stats instead.

## Phase 1: launch, one channel at a time

- **Show HN** (Tuesday to Thursday, US morning). Draft title: "Show HN: Oak, a keyboard-first Git GUI for Windows (Electron, MIT)". Stay in the comments for hours.
- **Reddit:** r/git, r/electronjs, r/opensource, r/commandline, r/programming. Space them out and lead with a problem solved, not the app. Read each community's self-promotion rules first.
- **Write-ups:** dev.to or Hashnode, plus lobste.rs if invited.
- **Lists:** awesome-git, awesome-electron, awesome-windows, alternativeto.net, the Microsoft Store if signing allows.
- Skip Product Hunt at first; it is lower value for developer tools.

Launch only after the install is clean (signed or well explained, winget works, README current).

## Phase 2: sustained content

- Technical posts from real problems: the virtualized commit graph, keyboard ownership architecture, React Aria in a desktop app, Playwright against real repos, why Oak shells out to `git`.
- Short clips, one feature each, for X, Bluesky, LinkedIn and YouTube Shorts.
- An honest comparison page with other clients that names their strengths.
- A changelog post per release.

## Phase 3: community

- Turn on GitHub Discussions.
- Triage issues fast; response time is the strongest signal to new contributors.
- Keep the roadmap backlog public and ask for votes on it.
- Thank contributors in release notes.

## Measures

GitHub stars and clones, release downloads, winget installs, issue and discussion activity, returning contributors. Stars are a vanity metric. A target of 25 to 50 real users who file issues, and let them steer the roadmap.

## Sequence

Signing application and winget first, then the README refresh, then Show HN after 2 to 3 weeks.
