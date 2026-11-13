# Roadmap

Where Oak is, what is next, and the decisions worth keeping. [PRODUCT.md](PRODUCT.md) holds who Oak is for and its principles; [AGENTS.md](AGENTS.md) the conventions and design rules; `CHANGELOG.md` the per-release detail.

How to keep this file: it has one place for each kind of fact. When work moves, edit **Now** first. When something ships, fold it into **Shipped** and delete it from **Now**, **Open items** and **Backlog**. Ideas live only in **Backlog** (details) and, once agreed, in **Features** (order only, no detail).

## Now (2026-11-13)

- **Released:** 0.1.28 (2026-11-12), after 0.1.27 and 0.1.26. The website downloads follow the latest published release (`website/src/data/release.json`, updated once the packages are public).
- **On `main`, not released, preparing 0.1.29:** Alt+Up retraces an Alt+Down walk in History and prefers the checked-out line (the commit list cursor follows the selection in the same render); History working changes list from the loaded status, as fast as Changes; a "Diff colours" preference (Standard, or Colour-blind friendly blue and orange over any theme, changed words underlined; palette command too); Windows high contrast support (rings for selection, focus, changed words, find matches, the current hunk and picked lines; drawn split lines and menu separators; hatched side-by-side filler); Shift+F12 in dev builds simulates high contrast. Each was tested by the maintainer.
- **Flaky UI tests (also before these changes):** `tests-ui/escape.test.ts` "comparison banner Escape dismisses…" and "F6 reaches an empty comparison result…" each fail about 1 run in 3 (focus not where expected); `tests-ui/nav-history.test.ts` "view switches" sometimes reads the status line before "Nothing earlier" shows.
- **Not run:** the full Electron UI suite for #35, #36, #40, line stepping and the changes above (focused tests pass).

## Next

Not features: the work that unblocks growth and keeps the project healthy.

1. **Code signing.** Windows marks downloads with Mark of the Web, so users must Unblock the installer (the website explains). Plan: apply to SignPath Foundation (free for open source; the wait is the slow part), fall back to Azure Artifact Signing (about $10 a month, `win.azureSignOptions`, no hardware token), sign only in the release workflow, never locally. SmartScreen may warn until reputation builds. Meanwhile publish SHA-256 checksums and build provenance; once signing works, drop the Unblock instructions from the README and website. Needs the maintainer to set up the account.
2. **Microsoft Store listing.** The maintainer has a Partner Center developer account (confirm individual or company). The Store signs packages it certifies, so Store installs skip Mark of the Web and SmartScreen; it does not sign the GitHub or website installer, so it complements signing. Steps, each needing its own discussion: reserve the app name and note the package identity and publisher ID; add an `appx` (MSIX) target to `electron-builder` for a Store build only; switch the in-app updater off there; check the packaged app still runs the user's `git`, opens repositories anywhere and keeps its settings; run the Windows App Certification Kit; write the listing (Windows 11 primary), screenshots, a privacy policy page and the age rating; submit. Decide whether the release workflow produces the Store build.
3. **Distribution.** `winget` package, README refresh, release checksums, "good first issue" labels; launch after signing and a clean install. The plan is in [docs/marketing-plan.md](docs/marketing-plan.md).
4. **CI.** Add a `test:ui` job to `checks.yml` once the suite is stable (needs a display on Linux, for example xvfb). First restore the 5,000-commit scroll test removed with a TODO in `tests-ui/smoke.test.ts` and stabilise it.
5. **Linux.** Confirm in more real-world testing.

## Features (proposed order, not agreed)

Priority is parity with the most-used and most-asked-for features of other Git clients. Each needs its workflow discussed first; the idea's detail is in Backlog. "Not built" was checked against `src/main/handlers.ts` on 2026-11-01; recheck before starting one.

1. Interactive rebase: reorder, drop, reword, merge-aware (squash and fixup are built).
2. Submodules: status, update, open (not built).
3. Git LFS: visible state for tracked files and pending uploads.
4. Clone and init flow check (a `clone` handler exists; confirm recent repositories and the default folder).
5. Full text search.
6. Worktrees.
7. Bisect as a short guided flow (not built).
8. Compare the working tree against any commit.
9. Commit options follow-ups.
10. Conflict follow-ups, one small step at a time: stash-pop conflict banner, ours/theirs labels (swapped in a rebase), modify/delete conflicts, pulling conflicts from Pull and Rebase into the same flow.

Later or by request: everything else in Backlog (a built-in merge editor contradicts the "rely on the merge tool" decision, so only on clear demand).

## Open items

Known gaps in shipped work. Small; fix when touching the area.

- **Back and Forward:** file history and Compare results are not restored (Back returns to the previous view); blame scroll offset is not restored. Extend `NavPlace` (`src/shared/navPlace.ts`) if daily use shows a need.
- **Open in editor:** self-hosted GitHub, GitLab or Bitbucket servers need a host to provider setting (add it beside the provider list); a line link from a working file with local edits on a pushed commit can point a few lines off.
- **Merge into** a branch already contained in the current one says "Nothing to merge". A disabled "(already merged)" item was reverted because the check delayed the menu; if wanted, compute it in the background like the compare-target cache.
- **Status bar:** the Welcome screen has no bar, so zoom gives no on-screen feedback there; an item that loads a moment after its neighbours (identity, latest commit) shifts the items beside it for about a frame (reserve space or order late items leftmost if noticed); opening the git output has a click and a palette command but no key (decided: no new global key for now).
- **Performance** (opening big repos is progressive since 0.1.23; `npm run perf:open` repeats the measurement): History on 13,800 refs on one commit waits on `git log` decorations (about 0.6 s alone; git cannot cap them); pickers wait for branch details (about 2 s there). Not measured: a commit with thousands of changed files, a very large working-tree status, huge diffs (fixtures `commits5k` and `hugeDiff` exist), a real-world large repo. A focus-triggered refresh and an external `git commit` while Oak is open were not driven by hand.
- **Themes:** the transit-map redesign is tokens only (see `PRODUCT.md`, `DESIGN.md`). Still open: `--radius-full` pills could use the signage radius, Dark grounds could take an ink tint, the Light selection tint is cool on warm paper, `.icon-btn` has a literal `24px` width.
- **Website:** panels differ in height, so content below the map shifts a little when a station changes. Keep "planned" in step with this file; rules are in `website/README.md`.
- **Refactor:** work down the `max-lines` warnings when touching those files.
- **Agent contributions:** open question is how to check that agent-written PRs follow the rules (PR template checklist, CI). `AGENTS.md` is contributor-facing; the maintainer's workflow lives in gitignored `AGENTS.local.md` plus a `CLAUDE.local.md` import (both in `.git/info/exclude`), so a fresh clone must recreate them.

## Shipped

One line per release; details are in `CHANGELOG.md`. Versions are approximate before 0.1.8.

- **0.1.1 to 0.1.7:** installer and auto-update, core client (graph, staging by file, hunk and line, commits, branches, tags, stashes, merge, rebase, cherry-pick, revert, reset), themes, Shiki, side-by-side diffs, React Aria, comparison, shortcut reference, keyboard architecture, Linux packages (experimental), F11 expansion, resizable splits.
- **0.1.8 to 0.1.15:** branch comparison, diff context and layout toggle, pull request links, zoom, per-file history, All files tree, tab model and F6, conflict handling (no built-in resolution editor by design), List or Tree files, virtualized History and diffs, the "system map" website (`website/src/data/lines.ts`, `components/SystemMap.astro`), the Playwright suite.
- **0.1.16 to 0.1.19:** Transit-map themes, branch hiding, Blame (Ctrl+3), space and tab markers, per-feature style files, find in diffs, Escape policy.
- **0.1.20:** ignore-whitespace diffs (session only; whole-file actions include hidden edits), branch and tag menus from History badges, `Tip` tooltips.
- **0.1.21:** focus mode keeps the file list, sidebar icon rail (`Ctrl+[`), file type icons (None default, Simple, Colour).
- **0.1.22:** SVG preview, Open in editor, remote links (open in browser, pull request, copy link), commit options and WIP commits, one menu group order, small-window layout fixes (`lib/layoutMinimums.ts`).
- **0.1.23:** squash and fixup from History (range select, Undo), progressive opening of big repositories with fewer repeat refreshes, ref badge and commit menu caps for repositories with thousands of refs, menu type-ahead.
- **0.1.24:** status bar with results, hints and progress; toasts restyled bottom-right.
- **0.1.25:** keyboard checkout (Enter on a sidebar branch), copy relative or full path and `path:line` from file lists and diffs, folder column punctuation fix.
- **0.1.26:** Back and Forward through visited places (Alt+Left and Alt+Right).
- **0.1.27:** expand hidden diff context (hunk header buttons, E around the cursor).
- **0.1.28:** step along a commit's line in History (Alt+Down and Alt+Up, child link in commit details; highlighting the followed line declined), SynthWave '84 theme with the `glow` theme property, Bitbucket `ssh.bitbucket.org` remotes.

## Decisions worth keeping

Rules for menus, Escape, layouts, styles, previews, tokens and reuse are in `AGENTS.md`. These are decisions it does not cover:

- **Open source:** `benfo/oak` is the single public MIT repo with one root commit; older releases and tags were deleted on purpose. Contributions are MIT with no CLA and the maintainer approves every PR. `main` is protected (no force pushes or deletion; PRs for outside contributors; the owner can push directly). Workflows use the built-in `GITHUB_TOKEN`; the site publishes to this repo's `gh-pages` (`docs/releasing.md`). Impeccable tooling stays local and gitignored. If history is ever rewritten again: remove branch protection first and restore it after, expect a force-pushed tag to trigger a Release packages run that fails safely (`scripts/release.cjs` refuses to republish), and run `gh workflow run website.yml --ref main` because a force push may not redeploy the site. This clone excludes `gh-pages` from fetch (`git config --add remote.origin.fetch "^refs/heads/gh-pages"`, then `git branch -dr origin/gh-pages`); a fresh clone needs the same.
- **Styles:** pairs split by the old cascade (toolbar and toolbar-buttons, sidebar and sidebar-tree, changes and file-lists, diff and line-selection, focus and keyboard-navigation) stay separate; merge one only after checking specificity and order. No colocation, CSS Modules or Tailwind.
- **Menus:** never assume a main branch or infer a comparison target from a branch name. Plain labels, colons for explanation.
- **Comparison:** starts only from explicit actions (context menu, palette), never from selecting a sidebar row; its controls live with the results in commit details.
- **Palette:** add commands for frequent actions, hard-to-discover features or useful direct keyboard access. Branch sorting and hiding stay in the Branches menu.
- **Toolbar:** Fetch, Pull and Push stay visible; occasional actions go in menus and the palette. No toolbar customisation until daily use shows a need.
- **Conflicts:** rely on Git and the user's merge tool. A first attempt with ours/theirs labels, a dropped-changes confirm, an Undo toast and Skip was removed as too much.
- **Layouts:** the named layouts, Layout menu, Resize panes picker, an overlaying file list drawer and hiding the toolbar in focus mode were removed. No docking or automatic collapsing.
- **File icons:** the default stays None until the maintainer has tried it (one value in `settings.ts`).
- **Website:** factual copy, no sales language or unsupported "only" or "unique" claims, the command palette featured, no live demo, screenshots are real captures of a synthetic repo, section backgrounds alternate strictly after the hero.
- **Big collections:** the sidebar lists the newest 100 tags with a searchable "Go to tag…" picker. A commit row shows at most 6 ref badges and a "+N" chip (the checked-out ref always stays); a menu lists at most 12 refs per list with a disabled "N more" row and points to the sidebar. Never render an unbounded list in a row, a menu or a tooltip.
- **Libraries (audited 2026-10-20):** Git produces diffs, Shiki highlights, React Aria and react-resizable-panels own UI behaviour, `fuzzysort` ranks the palette behind `lib/fuzzy.ts`; nothing worth replacing. Toasts stay in-house (audited 2026-11-02): React Aria's `ToastRegion` adds a document F6 landmark listener, Sonner and Base UI make every toast a Tab stop (Base UI also hard-codes F6), Radix hooks Escape; react-hot-toast in headless mode has no keyboard behaviour and adds little over our host. The graph and diff stay custom (`diff`'s `parsePatch` lacks combined diffs).
- **Back and Forward:** per repository, in memory only, recorded on deliberate jumps (view switches, opening a commit or a blame, a parent or child link) and never on arrowing or Alt+arrow line steps. Alt+Left and Alt+Right (not in text fields), mouse back and forward buttons, palette commands; no toolbar buttons. A place is the view plus its commit, or the blame file, revision and cursor line; a commit that has left the graph is skipped silently.
- **Accessibility colours:** diff colours are a preference separate from themes, laid over any theme in `theme.ts` (`diff/diffColours.ts`, contrast and colour-blindness simulation checked by `tests/diff-colours.test.ts`). Status letters and line counts follow it; graph lanes do not. Changed words are underlined only in the colour-blind mode, never over changed whitespace. Windows high contrast is honoured through `forced-colors` rather than a separate setting.
- **Themes:** built-in themes are known editor palettes (credited in `builtInThemes.ts`), adjusted until `tests/diff-contrast.test.ts` passes. A theme may set `glow: true` (SynthWave '84 does): one fixed recipe on syntax-coloured code only, honoured by custom theme files and their starter copies; no strength or raw CSS. Themes do not set fonts: Oak has no display-only text, so a theme font would become the body font of dense lists, and synthwave-style fonts are logo fonts that would have to be bundled.
- **Packaging:** the app includes only `out/main`, `out/preload` and `out/renderer`; scratch repos, profiles and screenshots under `out/` must never ship.

## Backlog

Ideas only. None is agreed, and each needs a concrete workflow and a discussion first. Agreed order is in Features above.

**Git features**

- Interactive rebase should reuse the squash planner (`src/shared/rewrite.ts`) and scripted-todo engine (`src/main/rewrite.ts`). Squashing around a skipped commit is a reorder, so it belongs here, not to Ctrl+click (Ctrl+click compares). Squash and fixup currently refuse with a reason when the tree is dirty, a merge commit is in the way, or the list is a file history. Measured with 2,000 loaded commits selected: 200 ms to the summary and 350 ms to the dialog, rows not virtualised; revisit near 10,000.
- Output log: a running stream of what Oak ran, from many places (every git command with its result, background fetches, errors), like VS Code's Output, replacing the single current-or-last output dialog; the status bar message already opens that dialog. Needs a design first: what counts as an entry, how many to keep, whether it persists, filters, and whether the stream is the one place a missed result can be recovered.
- More status bar items, each only with a concrete workflow benefit and never a duplicate of something already on screen: a working-tree summary for expanded Code (it repeats the Changes badge, so only if its absence there is missed).
- Menu-wide type-ahead: typing in a menu only searches its own level, so "squash" does not find an item inside a submenu. Left to the palette for now; revisit if people ask.
- Submodules: list them with status (clean, modified, uninitialised), initialise and update, open one as a repository. Everyday actions only; no `submodule add` wizard until asked.
- Git LFS: show which files are LFS pointers and whether uploads are pending, using `git lfs` output. LFS itself already works through the user's `git`.
- Bisect as a guided flow: mark good and bad from History, show progress and the found commit, always offer Reset.
- Skip for rebase, cherry-pick and revert conflicts (prototyped and removed as niche and destructive; revisit if asked, with a confirm naming the dropped commit), and conflict safeguards (branch-named ours/theirs, a confirm when one side drops the other's changes, an Undo toast); revisit if users report lost work.
- Commit options follow-ups: author and date overrides, `--reset-author` for amend, trailers such as Co-authored-by, a "Verified" signature badge in History (a display feature; no git commit flag checks signatures), and a hint when an undone WIP commit was already pushed (the remote still has it and the next push needs a force push). Not wanted: `--no-post-rewrite`.
- Compare the working tree against any selected commit.
- "Blame this line" from the diff line menu (decide deleted lines: blame the old side at the parent; History diffs: blame as of that commit).
- Shared find options for diffs and Blame: case, whole word, regular expression.
- Commit details for a line while reading, like inline blame or hover, without opening Blame; try a hover or key-triggered popover first (always-on annotation risks the GitLens distraction).
- Pull request support: host-to-provider mapping for self-hosted remotes, forks, target branch selection, and a lightweight local PR review (pass a URL or pick branches, fetch the refs, open the comparison; comments and approvals stay on the provider).
- More preferences (default clone folder, external tools, fonts).
- `oak://open?remote=…&ref=<sha>&path=…&line=N` links: "Copy Oak link" on a diff or blame line; opening one matches the remote against recent repositories (offer to clone or fetch a missing commit, each with a confirm) and lands in Blame at the line. Registered through the installer's protocol and handled beside the single-instance `second-instance` path (argv on Windows and Linux, `open-url` on macOS). Treat links as untrusted input. Optional website redirect page for people without Oak, only with approval.
- Full text search: `git grep` over the working tree or a commit, commit messages (`git log --grep`) and changed text (`git log -S` or `-G`) in one palette-style panel with a scope switch; results open Blame at the line.
- Manage worktrees: create (new branch or existing), view (path, branch, dirty state, locked or prunable), switch between them, and clean up (remove, prune stale entries, flag merged branches). Also for agent workflows, including viewing two side by side; define the everyday workflow before the UI.
- Built-in terminal panel in the repository folder (or the selected worktree), instead of only launching an external terminal (`openTerminal` today). Needs a decision on a pty library (`node-pty` is a native module, which complicates packaging for Windows and Linux), shells, and layout without shifting content; keep it optional.

**Diff and files**

- Partial code expansion (shipped in 0.1.27): hunk headers and a footer carry expand up, expand down and expand all buttons (20 lines a click), and E expands around the cursor. The first expand refetches diffs at whole-file context for the session and cuts them client-side; expanded lines are ordinary context rows so find, selection and staging keep working. Not yet checked: very large files.
- Mouse alternatives for the layout toggle, only if testing shows a need.
- Whole-file syntax tokenizing (a hunk that starts mid-construct can be mis-coloured).
- More previewers for non-source files (PNG and other images, PDF, safe formats) instead of "binary file differs": add one file under `preview/` and a line in `previewers.ts`; never run scripts. Follow-ups for the SVG one: zoom and pan (`react-zoom-pan-pinch`), swipe and onion-skin comparison, a fit and actual size toggle, a minimum display size for tiny icons, and a per-user default mode (Preview or Diff) that survives restarts (today the choice lasts until Oak restarts).
- User-installable file icon packs, like custom themes: folders in an `icon-packs` folder under the app data folder, each with a `pack.json` (names, extensions, folders, light variants) and SVGs; "Import icon pack…" would validate and extract a zip into it. Needs SVG sanitising (render as `<img>` only), zip-slip and size limits, and a decision on depending on the `material-icon-theme` npm package instead of vendoring. A Seti-based monochrome pack is an option if Simple feels too generic.
- "Open" and "Show in folder" from file menus (read-only temporary copy for historical revisions); never execute automatically, confirm for executable and script types.
- Browse the repository at the working tree or a commit, including unchanged files, with filename search (History "All files" covers part of this; a working-tree browser is not built).
- Neighbour diff prefetch if History stepping feels slow; a state library such as Zustand for shared selection and scope, only if needed.

**Interface and keyboard**

- Rebindable command shortcuts with conflict detection and reset (widget keys stay fixed); optional saved wrap-around for branch and history search.
- Branch hiding by pattern and remote-only status works in the sidebar and graph (per repository, in Branch options, Preferences > Repository and the branch menu). Only if needed: hiding in pickers and the palette, and a keep-visible list for remote branches.
- More themes (GitHub, Nord) and a theme editor.
- A high contrast light and dark built-in theme pair, for people who want strong contrast inside Oak without switching Windows to a contrast theme (Windows contrast themes already work through `forced-colors`). Must pass `tests/diff-contrast.test.ts` and pair with the diff colours preference.
- A Simple and Advanced mode, and keyboard follow-ups (panes registering their own search, a CI collision test over the command registry), only when a concrete workflow needs them.

**Platform**

- Installers and testing for macOS and more Linux distributions.
