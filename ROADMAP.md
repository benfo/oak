# Roadmap

Done, in progress and backlog. [PRODUCT.md](PRODUCT.md) holds who Oak is for and its principles; [AGENTS.md](AGENTS.md) holds the conventions and design rules; this file records status, decisions and ideas. Keep it short: when something ships, fold it into the shipped list below.

## Current status (2026-10-24)

**Open source (done 2026-10-23).** `benfo/oak` is the single public MIT repo. The private `benfo/oak-source` is archived and `OAK_PUBLIC_TOKEN` is revoked. `main` is one root commit, "Initial open-source release", and the only tag and release is `v0.1.15` (Latest); older releases and tags were deleted on purpose.
- Workflows run in this repo with the built-in `GITHUB_TOKEN`. The site publishes to this repo's `gh-pages`. Release steps are in `docs/releasing.md`.
- Community files: `CONTRIBUTING.md`, `SECURITY.md` (private vulnerability reporting is on), `CODE_OF_CONDUCT.md`, issue and PR templates. Contributions come in under MIT with no CLA, and the maintainer approves every PR.
- `main` is protected: no force pushes or deletion, and PRs for outside contributors. The owner can still push directly.
- Impeccable tooling was removed from the repo and stays local and gitignored.

Lessons for any future history rewrite or tag move:
- Force-pushing a tag triggers **Release packages**. It fails safely because `scripts/release.cjs` refuses to republish a published version, but it is noise.
- A force push to `main` may not redeploy the site. Run `gh workflow run website.yml --ref main` and check the live version text.
- Remove branch protection before a force push and restore it afterwards. GitHub may keep old SHAs reachable until Support garbage-collects them.
- This clone excludes `gh-pages` from fetch so it does not clutter History: `git config --add remote.origin.fetch "^refs/heads/gh-pages"` then `git branch -dr origin/gh-pages`. A fresh clone needs the same two commands.

**Release state.** Oak 0.1.15 is released (notes in `src/shared/releases.json`) and the website is pinned to it in `website/src/data/release.json`. The next version needs a `package.json` bump, release notes, a push to `main` and a matching `vX.Y.Z` tag. Unreleased on `main`:
- "Merge into" a branch that is already contained in the current branch now says "Nothing to merge: <branch> already contains <ref>" (`merge` returns Git's output). A disabled "(already merged)" menu item was tried and reverted because the check delayed the menu. If wanted later, compute it in the background when a repo opens or refreshes, like the compare-target cache, so menus never wait on Git.
- V switches the changed-files List/Tree view from the diff as well as the file lists (`switchView` has the `diff` role in `lib/keymap.ts`). It does nothing in the graph, sidebar or toolbar, in the expanded Code layout or in History's All files mode.
- Opening Oak with flags before the folder (as automation tools pass them) now opens the right folder.
- Transit-map visual redesign of the Light and Dark base themes (tokens only; layout, behaviour and keyboard model unchanged): warm paper and ink Light, ink Dark, 2px radii, saturated line colours, a 3px graph with ringed stations, filled merge dots and a HEAD ring, WCAG AA text tiers, quieter avatars. Context is in `PRODUCT.md` and `DESIGN.md`. Still open from the finish review: `--radius-full` pills (branch button, chips) could use the signage radius, the Dark grounds could take an ink tint, the Light selection tint is cool on warm paper, and `.icon-btn` has a literal `24px` width. The `test:ui` test "scrolls a 5,000 commit history to the end" fails on a clean `main` too, so look at it before adding `test:ui` to CI.

## Resume next
0. **Website revamp (starting).** A fresh pass over `website/`, led by a grilling session before any markup changes: audience and the one action the page drives, which sections stay and their order, copy that no longer matches the app (transit-map themes, hidden branches), whether screenshots need regenerating, and whether the "planned" section still matches this file. Notes and rules are in `website/README.md`. Work on `website/` branches, one topic each.
1. **Refactor follow-ups.** Add the `test:ui` job to `checks.yml` once the suite has been stable for a while (it needs a display on Linux, for example xvfb). Work down the 12 `max-lines` warnings (`npm run lint`) when touching those files; `DiffView.tsx` is still about 380 lines. The ESLint Babel parser needs `@babel/core` 8 declared explicitly so `npm ci` resolves its peers.
2. **Agent contributions (first pass done).** `AGENTS.md` is now contributor-facing (design rules, keyboard model, tokens, checks, no releases or deploys). The maintainer's personal workflow lives in gitignored `AGENTS.local.md` (plus a `CLAUDE.local.md` import, both listed in `.git/info/exclude`), which `AGENTS.md` tells any agent to read, so a fresh clone needs them recreated. Still open: decide how to check that agent-written PRs follow the rules (PR template checklist, CI), and whether `AGENTS.md` should be shorter.
3. **Code signing.** Windows marks downloads with Mark of the Web, so users must Unblock the installer (the website explains the workarounds). The real fix is signing. SignPath Foundation is free for open-source projects and Oak is now public, so it is worth reconsidering next to Azure Artifact Signing (about $10 a month, supported by electron-builder `win.azureSignOptions`, no hardware token). SmartScreen may still warn until reputation builds. Needs the maintainer to set up the account.
4. **Conflict handling follow-ups** (one small step at a time; the maintainer wants it kept simple): stash-pop conflict banner, ours/theirs side labels (swapped in a rebase), modify/delete conflicts, pulling conflicts from Pull/Rebase into the same flow.
5. **Blame.** Needs grilling first. Open questions: entry point (file menu, palette, diff gutter), optional line annotations versus its own view, jumping from a blamed line to its commit in History. Reuse `git blame --porcelain` and the existing History selection; keep it contextual.
6. **Housekeeping.** Optionally ask GitHub Support to garbage-collect the old commit SHAs; add a README screenshot; confirm Linux in more real-world testing.

## Shipped
Versions are approximate for the early work: everything before 0.1.8 is grouped.

**0.1.1 to 0.1.5**
- Windows installer (per user, Start menu and desktop shortcuts, Explorer "Open with Oak", `oak` command, single instance) and automatic updates through electron-updater against `benfo/oak` releases, with a "Restart now" notice.
- Core client: history graph, working changes, staging by file, hunk and line, commits with live hook output, branches, tags, stashes, fetch, pull, push, clone, merge, rebase, cherry-pick, revert, reset and checkout flows with confirmations.
- Preferences (identity, signing, pull mode, fetch, diffs, themes, zoom), light and dark themes, custom theme files, author pictures (GitHub, Gravatar, initials).
- Syntax highlighting in diffs (Shiki in a worker, colours from `--syntax-*` tokens) and word-level change highlighting.
- Side-by-side diffs (saved Automatic, Inline or Side by side), a compact diff header with previous/next change, and history previews that stay mounted while loading.
- React Aria for collections and overlays: file lists (GridList), sidebar (Tree), toolbar, dialogs and command palette. The graph and diff stay custom.
- Release highlights ("What's new"), bundled offline from `src/shared/releases.json`.
- Branch and commit comparison, searchable shortcut reference (Ctrl+/), sidebar quick access (current branch, recent branches), sorting and hiding gone-upstream branches, history that loads far enough to reveal an old branch tip, current-branch graph emphasis with muted other lanes, and context-menu grouping and retargeting.

**0.1.6 to 0.1.7**
- Linux packages (Debian and AppImage), tested on native Ubuntu 24.04 CI with a real diff and real staging. Linux stays experimental; macOS is untested.
- Explicit line selection: a click selects exactly the line shown, and partial staging follows displayed order. Diffs refresh after content changes even when status codes stay the same.
- Keyboard architecture: one shortcut dispatcher with scopes and overlays, widget keys declared in `lib/keymap.ts`, shared navigation policy and pane composition (`usePane`, `PaneFrame`, `PaneSearch`), optional Vim navigation (h/j/k/l, Ctrl+D/U, gg/G), file browsing in diffs (Alt+PageUp/PageDown), Shift+Left/Right horizontal scroll.
- Workspace: F11 code expansion with Escape to restore, sidebar toggle, `react-resizable-panels` splits with Shift+Alt+arrow resizing, reduced toolbar (Fetch, Pull, Push, Preferences, a More actions menu), window size and position remembered.
- Website redesign: screenshot-led, product-first, Tailwind and daisyUI with a light and dark toggle.

**0.1.8 to 0.1.9**
- Branch comparison simplified to changes since branching, with a note when the target has newer commits. History scope menu (all branches, current branch only, current branch plus full history, plus a target).
- Commit with nothing staged offers to stage changed files. Diff context steps (3 to whole file) and Ctrl+Shift+D layout toggle. Open pull request for GitHub, GitLab, Bitbucket and Azure DevOps remotes, including a notice after the first push.
- Pinned Ctrl+scroll zoom with an indicator, the Exit comparison banner, a faster history menu, and a pinned read-only "Working changes" row in History.

**0.1.10 to 0.1.11**
- Copy and native text selection in diffs (Ctrl+C, Ctrl+Shift+C as a patch).
- Preferences > Git page (line endings, editor, merge tool and diff tool presets, open the git config files).
- History "All files" tree at a commit with a path filter, and per-file history (`git log --follow`) as a filter on the graph.

**0.1.12 to 0.1.15**
- Tab model: ordinary traversal inside panes with one stop per collection, F6 and Shift+F6 as the only pane jumps, Escape on a pane tool returns to its pane. Shared tooltips (`components/Tip.tsx`).
- Conflict handling: auto-switch to Changes, banner with Abort and Continue, Open in merge tool (`git mergetool` with temp BASE/LOCAL/REMOTE), marker warning before Mark as resolved. There is no built-in resolution editor by design.
- Create theme from current, installer progress window on update, many layout fixes.
- Changed files as a List or Tree (V key) in Changes and History, with folder selection acting on all files inside.
- Website screenshots regenerated from the real app in light and dark.
- The History file list renders only the rows near the viewport (checked with a 5,000-file commit). The other long lists (commit graph, sidebar tree, palettes, All files tree, Changes) were already virtualized; the rest are small and bounded.
- A Playwright smoke suite (`npm run test:ui`, `tests-ui/`) drives the real app: open, diff, staging, line selection, hunks, layouts, History, and the 5,000-commit and 60,000-line windows. Adding it to CI is a follow-up once it has proven stable.
- The diff view (inline and side by side) renders only rows near the viewport once a diff has over 600 rows, using `@tanstack/react-virtual` (checked with a 60,000-line file). Native select-all and copy then cover only rendered rows; line-pick copy is unaffected.

## Decisions worth keeping
- **Menus:** primary actions first, then Compare, Merge / Rebase submenu, "New … from here…", Manage submenu (housekeeping and destructive), and a final Copy submenu when there are two or more variants. One level of submenus. Never assume a main branch or infer a comparison target from a branch name. Menu wording: plain labels, no em dashes, colons for explanation.
- **Comparison:** starts only from explicit actions (context menu, palette), not from selecting a sidebar row. Active controls live with the results in commit details.
- **Palette:** add commands for frequent actions, hard-to-discover features or useful direct keyboard access. Keep branch sorting and hiding in the Branches menu.
- **Toolbar:** keep Fetch, Pull and Push visible; occasional actions go in menus and the palette. No toolbar customisation until daily use shows a need.
- **Conflicts:** rely on Git and the user's merge tool. A first attempt with ours/theirs labels, a dropped-changes confirm, an Undo toast and Skip was removed as too much.
- **Layouts:** only F11 expansion and a sidebar toggle. The named Standard, Focus history and Focus code layouts, Layout menu and Resize panes picker were removed. No docking, no automatic collapsing.
- **Website:** factual copy, no sales language, no unsupported "only" or "unique" claims, the command palette featured prominently. No live demo or simulator; screenshots are real app captures of a synthetic repo. Section backgrounds alternate strictly after the plain hero.
- **Big collections:** the sidebar lists the newest 100 tags with a searchable "Go to tag…" picker, and leaves collapsed sections' children out of the Tree because React Aria rebuilds its collection on every render.
- **Libraries (audited 2026-10-20):** Git produces diffs, Shiki highlights, React Aria and react-resizable-panels own UI behaviour, `fuzzysort` ranks the palette behind `lib/fuzzy.ts`. Nothing found worth replacing; the graph and diff stay custom (`diff`'s `parsePatch` lacks combined diffs). `@tanstack/react-virtual` drives the long lists we render ourselves (History files, diff).
- **Packaging:** the app includes only `out/main`, `out/preload` and `out/renderer`; scratch repos, profiles and screenshots under `out/` must never ship.

## Backlog
Ideas only. None is agreed, and each needs a concrete workflow and a discussion before building.

**Git features**
- Interactive rebase (reorder, squash, edit), three-way merge editor, Git command log panel.
- Skip for rebase, cherry-pick and revert conflicts (`git <op> --skip`). It was prototyped and removed as niche and destructive; revisit if people ask, with a confirm naming the dropped commit.
- Conflict safeguards: ours/theirs buttons labelled with branch names, a confirm when taking one side drops the other's changes, an Undo toast. Revisit if users report lost work.
- Compare the working tree against any selected commit.
- Pull request support: host-to-provider mapping for self-hosted remotes, fork workflows, target branch selection, and a lightweight local PR review (pass a PR URL or pick branches, fetch the refs, open the comparison in Oak; comments and approvals stay on the provider's site).
- More preferences: default clone folder, external tools, fonts.

**Diff and files**
- Ignore whitespace and CRLF/LF differences. Collapse unchanged regions.
- Optional linked horizontal scrolling in side-by-side diffs (a check item in the diff options menu); independent scrolling stays the default.
- Mouse alternatives for the diff layout toggle, only if testing shows a need.
- Whole-file syntax tokenizing, since a hunk that starts mid-construct can be coloured wrongly.
- Preview non-source files (images, PDFs, safe formats) instead of "binary file differs". Never run scripts; render SVG as an image only.
- Open files with external apps: "Open" and "Show in folder" from file menus, using a read-only temporary copy for historical revisions. Never execute files automatically and confirm for executable and script types.
- Browse the repository at the working tree or a selected commit, including unchanged files, with filename search. Part of this shipped as History "All files"; a working-tree browser is not built.
- Neighbour diff prefetch if History stepping still feels slow; a state library such as Zustand for shared selection and scope state, only if needed.

**Interface and keyboard**
- Rebindable command shortcuts, with conflict detection and reset. Widget keys stay fixed.
- Optional saved wrap-around for branch and history search (searches currently stop at the ends).
- Manually hiding selected branches, and a per-branch "Hide from history" option for generated branches such as `gh-pages`, only if everyday use shows the need.
- More built-in themes (high contrast, GitHub, Nord) and a theme editor.
- A narrow icon rail for the sidebar, a Simple and Advanced mode, and keyboard architecture follow-ups (panes registering their own search, a CI collision test over the full command registry). Only when a concrete workflow needs them.

**Platform**
- Installers and testing for macOS and more Linux distributions.
