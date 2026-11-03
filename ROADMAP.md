# Roadmap

Status, decisions and ideas. [PRODUCT.md](PRODUCT.md) holds who Oak is for and its principles; [AGENTS.md](AGENTS.md) the conventions and design rules; `CHANGELOG.md` the per-release detail. Keep this short: when something ships, fold it into Shipped.

## Current status (2026-11-03)

**Open source (done 2026-10-23).** `benfo/oak` is the single public MIT repo; the private `benfo/oak-source` is archived and `OAK_PUBLIC_TOKEN` revoked. `main` is one root commit ("Initial open-source release"); older releases and tags were deleted on purpose. Workflows use the built-in `GITHUB_TOKEN` and the site publishes to this repo's `gh-pages` (release steps in `docs/releasing.md`). Community files exist (`CONTRIBUTING.md`, `SECURITY.md` with private vulnerability reporting, `CODE_OF_CONDUCT.md`, issue and PR templates); contributions are MIT with no CLA and the maintainer approves every PR. `main` is protected (no force pushes or deletion, PRs for outside contributors; the owner can push directly). Impeccable tooling stays local and gitignored.

Lessons for a future history rewrite or tag move:

- Force-pushing a tag triggers **Release packages**; it fails safely (`scripts/release.cjs` refuses to republish) but is noise.
- A force push to `main` may not redeploy the site: run `gh workflow run website.yml --ref main` and check the live version text.
- Remove branch protection before a force push and restore it after. GitHub may keep old SHAs reachable until Support garbage-collects them.
- This clone excludes `gh-pages` from fetch: `git config --add remote.origin.fetch "^refs/heads/gh-pages"` then `git branch -dr origin/gh-pages`. A fresh clone needs the same.

**Release state.** 0.1.23 is the latest release (2026-11-02), after 0.1.22 (2026-10-29) and 0.1.21 (2026-10-29). The website downloads follow the latest published release (`website/src/data/release.json`, updated after the packages are public). The next release follows `docs/releasing.md`. Open items:

- Open in editor: self-hosted GitHub, GitLab or Bitbucket servers need a host to provider setting (add it beside the provider list); a line link from a working file with local edits on a pushed commit can point a few lines off.
- "Merge into" a branch already contained in the current one says "Nothing to merge". A disabled "(already merged)" item was reverted because the check delayed the menu; if wanted, compute it in the background like the compare-target cache.
- Transit-map redesign of the Light and Dark themes (tokens only; see `PRODUCT.md`, `DESIGN.md`). Still open: `--radius-full` pills could use the signage radius, Dark grounds could take an ink tint, the Light selection tint is cool on warm paper, `.icon-btn` has a literal `24px` width. The 5,000-commit scroll test is removed with a TODO in `tests-ui/smoke.test.ts`; restore and stabilise it before adding `test:ui` to CI.

## Resume next

0. **Keyboard checkout and copy (branch `fix/keyboard-checkout-and-copy`, not merged; 2026-11-03).** Enter on a local, recent or remote sidebar branch uses the existing checkout flow; clicking still previews its commit. Git preserves working changes when possible and refuses switches that would overwrite them. Verified with two focused Electron tests, including failure of the regression test without the fix; typecheck, lint, formatting and keyboard unit tests pass.
   File lists copy relative paths with Ctrl+C and full paths with Ctrl+Shift+C. The focused list takes priority over the previous diff and lingering text selections. The focused Electron regression test fails without the fix and passes with it.
0. **Status bar and notifications (branch `feature/status-bar`, not merged; 2026-11-02).** Built: a notification service (`R/notices.ts`, policy `src/shared/notice.ts`; `notify` replaced every `toast` call), a status bar (progress after 300 ms, results and hints, last fetched, zoom with an on-demand bubble, unfinished merge, rebase or cherry-pick with its step, update ready, "committing as" when the identity is missing or set for the repository alone, and the latest commit's author and age, "You, 2 hours ago", whose click shows it in History), clickable items with hover cards, toasts restyled and moved bottom-right, `withBusy` taking a `done` text. Unverified: full unit and UI suites were not run (only the touched files and neighbours); the maintainer tried zoom, the toasts and the status bar by hand on 2026-11-02 and all look fine; the Welcome screen has no bar, so zoom gives no on-screen feedback there; a bar item that loads a moment after its neighbours (the identity, the latest commit) shifts the items beside it, which bends the no-layout-shift rule for about a frame (fix by reserving space or ordering late items leftmost, if it is ever noticed); opening the git output has a click and a palette command but no key (decided: no new global key for now). Next: review in the app, open the PR (squash), then the output log (see Backlog). Candidate bar items not built: a working-tree summary for expanded Code. A selection count in a diff was dropped: the diff's line-actions bar already shows "N lines selected".
0. **Performance (reported 2026-11-01, shipped in 0.1.23).** First fix: a History row drew thousands of ref badges and the commit menu listed every branch (about 3.7 s per click on about 9,200 refs; now 40 to 200 ms). Then opening a big repo became progressive. Branches, stashes and the commit list each show as they arrive; the branch listing is split into a fast call (`src/main/refs.ts` `listBranches`: names, hashes, peeled tag hashes, upstream, `gone` derived from the ref list) and a background `branchDetails` call (ahead/behind, date, subject). Until the lists are in, the sidebar counts show "…", History says "Loading history…", the toolbar branch button is inert with a spinner, and pickers and ref menus show a "Still loading…" toast instead of opening incomplete. The commit list starts alongside branches unless hidden branches or a comparison scope need them (`logNeedsBranches`). Only ref-changing `.git` paths refresh refs and history (`src/shared/watchPaths.ts`); window focus refreshes refs only after 30 s. A commit's refs are looked up through an index (`findBranch`), which took Shift+Menu on 13,800 refs from about 660 ms to under 80 ms. Measured in the real app on 13,800 packed refs (before to after, ms since launch): first commits 2,464 to 1,309, sidebar complete 2,464 to 969, Changes unchanged; 5 focuses 11 git commands to 5, an external stage 8 to 2. Small and 5,000-commit repos did not regress (`npm run perf:open` repeats the measurement). Still open: History on 13,800 refs on one commit waits on `git log` decorations (about 0.6 s alone; git cannot cap them); pickers wait for the details (about 2 s there); not measured: a commit with thousands of changed files, a very large working-tree status, huge diffs (fixtures `commits5k` and `hugeDiff` exist), a real-world large repo. A focus-triggered refresh and an external `git commit` while Oak is open were not driven by hand.
0. **Website follow-ups.** Panels differ in height, so content below the map shifts a little when a station changes; revisit if it bothers anyone. Keep "planned" in step with this file. Notes and rules are in `website/README.md`.
1. **Refactor.** Add the `test:ui` job to `checks.yml` once the suite is stable (needs a display on Linux, for example xvfb). Work down the `max-lines` warnings when touching those files.
2. **Agent contributions.** `AGENTS.md` is contributor-facing; the maintainer's workflow lives in gitignored `AGENTS.local.md` (plus a `CLAUDE.local.md` import, both in `.git/info/exclude`), so a fresh clone must recreate them. Open: how to check that agent-written PRs follow the rules (PR template checklist, CI).
3. **Code signing.** Windows marks downloads with Mark of the Web, so users must Unblock the installer (the website explains). The fix is signing: SignPath Foundation is free for open source and Oak is now public; compare Azure Artifact Signing (about $10 a month, `win.azureSignOptions`, no hardware token). SmartScreen may warn until reputation builds (EV certificates no longer skip that). Plan: apply to SignPath Foundation first (the wait is the slow part), fall back to Azure Artifact Signing, sign only in the release workflow, never locally. Meanwhile publish SHA-256 checksums and build provenance; once signing works, drop the Unblock instructions from the README and website. Needs the maintainer to set up the account.
4. **Conflict follow-ups** (one small step at a time): stash-pop conflict banner, ours/theirs labels (swapped in a rebase), modify/delete conflicts, pulling conflicts from Pull/Rebase into the same flow.
5. **Housekeeping.** Confirm Linux in more real-world testing.
6. **Marketing and distribution.** The plan is in [docs/marketing-plan.md](docs/marketing-plan.md). First steps: `winget` package, README refresh, release checksums, "good first issue" labels; launch after signing and a clean install.

## Features still to build

Proposed order, not yet agreed (each still needs its workflow discussed first). Priority is parity with the most-used and most-asked-for features of other Git clients. Details of each idea are in Backlog. "Not built" was checked against `src/main/handlers.ts` on 2026-11-01; recheck before starting one.

**Next (the usual reasons people reject a client)**

1. Interactive rebase: reorder, drop, reword, merge-aware (squash and fixup are built, see Backlog).
2. Submodules: status, update, open (not built).
3. Git LFS: visible state for tracked files and pending uploads (works through `git`, no UI).
4. Clone and init flow check (a `clone` handler exists; confirm recent repositories and default folder).

**Then**

5. Full text search: `git grep`, `git log --grep`, `-S` and `-G` in one panel.
6. Worktrees: create, view, switch, clean up.
7. Bisect as a short guided flow (not built).
8. Compare the working tree against any commit.
9. Commit options follow-ups: author and date overrides, `--reset-author`, Co-authored-by trailers.
10. Partial code expansion in diffs.
11. Conflict follow-ups (item 4 under Resume next).

**Later or by request**

- Built-in merge editor (contradicts the "rely on the merge tool" decision; only on clear demand).
- Verified signature badge, Blame this line from diffs, shared find options, hover commit details, `oak://` links.
- Pull request support beyond links, more previewers, user-installable icon packs, rebindable shortcuts, more themes.
- Terminal panel, macOS installers and testing, more Linux distributions.

## Shipped

One line per release; details are in `CHANGELOG.md`. Versions are approximate before 0.1.8.

- **0.1.1 to 0.1.7:** installer and auto-update, core client (graph, staging by file, hunk and line, commits, branches, tags, stashes, merge, rebase, cherry-pick, revert, reset), themes, Shiki, side-by-side diffs, React Aria, comparison, shortcut reference, keyboard architecture, Linux packages (experimental), F11 expansion, resizable splits.
- **0.1.8 to 0.1.15:** branch comparison, diff context and layout toggle, pull request links, zoom, per-file history, All files tree, tab model and F6, conflict handling (no built-in resolution editor by design), List or Tree files, virtualized History and diffs, the "system map" website (`website/src/data/lines.ts`, `components/SystemMap.astro`), the Playwright suite.
- **0.1.16 to 0.1.19:** Transit-map themes, branch hiding, Blame (Ctrl+3), space and tab markers, per-feature style files, find in diffs, Escape policy.
- **0.1.20:** ignore-whitespace diffs (session only; whole-file actions include hidden edits), branch and tag menus from History badges, `Tip` tooltips.
- **0.1.21:** focus mode keeps the file list, sidebar icon rail (`Ctrl+[`), file type icons (None default, Simple, Colour).
- **0.1.22:** SVG preview, Open in editor, remote links (open in browser, pull request, copy link), commit options and WIP commits, one menu group order, small-window layout fixes (`lib/layoutMinimums.ts`).
- **0.1.23:** squash and fixup from History (range select, Undo), progressive opening of big repositories with fewer repeat refreshes, ref badge and commit menu caps for repositories with thousands of refs, menu type-ahead.

## Decisions worth keeping

Rules for menus, Escape, layouts, styles, previews, tokens and reuse are in `AGENTS.md`. These are decisions it does not cover:

- **Styles:** pairs split by the old cascade (toolbar and toolbar-buttons, sidebar and sidebar-tree, changes and file-lists, diff and line-selection, focus and keyboard-navigation) stay separate; merge one only after checking specificity and order. No colocation, CSS Modules or Tailwind.
- **Menus:** never assume a main branch or infer a comparison target from a branch name. Plain labels, colons for explanation.
- **Comparison:** starts only from explicit actions (context menu, palette), never from selecting a sidebar row; its controls live with the results in commit details.
- **Palette:** add commands for frequent actions, hard-to-discover features or useful direct keyboard access. Branch sorting and hiding stay in the Branches menu.
- **Toolbar:** Fetch, Pull and Push stay visible; occasional actions go in menus and the palette. No toolbar customisation until daily use shows a need.
- **Conflicts:** rely on Git and the user's merge tool. A first attempt with ours/theirs labels, a dropped-changes confirm, an Undo toast and Skip was removed as too much.
- **Layouts:** the named layouts, Layout menu, Resize panes picker, an overlaying file list drawer and hiding the toolbar in focus mode were removed. No docking or automatic collapsing.
- **File icons:** the default stays None until the maintainer has tried it (one value in `settings.ts`).
- **Website:** factual copy, no sales language or unsupported "only"/"unique" claims, the command palette featured, no live demo, screenshots are real captures of a synthetic repo, section backgrounds alternate strictly after the hero.
- **Big collections:** the sidebar lists the newest 100 tags with a searchable "Go to tag…" picker. A commit row shows at most 6 ref badges and a "+N" chip (the checked-out ref always stays); a menu lists at most 12 refs per list with a disabled "N more" row and points to the sidebar. Never render an unbounded list in a row, a menu or a tooltip.
- **Libraries (audited 2026-10-20):** Git produces diffs, Shiki highlights, React Aria and react-resizable-panels own UI behaviour, `fuzzysort` ranks the palette behind `lib/fuzzy.ts`; nothing worth replacing. Toasts stay in-house (audited 2026-11-02, reading each library's source): React Aria's `ToastRegion` adds a document F6 landmark listener, Sonner and Base UI make every toast a Tab stop (Base UI also hard-codes F6), Radix hooks Escape; react-hot-toast in headless mode is the only one without keyboard behaviour and adds little over our host. The graph and diff stay custom (`diff`'s `parsePatch` lacks combined diffs).
- **Packaging:** the app includes only `out/main`, `out/preload` and `out/renderer`; scratch repos, profiles and screenshots under `out/` must never ship.

## Backlog

Ideas only. None is agreed, and each needs a concrete workflow and a discussion first.

**Git features**

- Interactive rebase, three-way merge editor, Git command log panel.
- Squash and fixup from History shipped in 0.1.23: Shift+click or Shift+arrows select a contiguous range, then Combine commits in the menu, the summary buttons or the palette; Undo toast; force-push warning for pushed commits. Refused with a reason when the tree is dirty, a merge commit is in the way, or the list is a file history. Interactive rebase should reuse its planner (`src/shared/rewrite.ts`) and scripted-todo engine (`src/main/rewrite.ts`). Squashing around a skipped commit is a reorder, so it belongs to interactive rebase, not to Ctrl+click (Ctrl+click compares). Measured with 2,000 loaded commits selected: 200 ms to the summary and 350 ms to the dialog, rows not virtualised; revisit near 10,000.
- Output log: a running stream of what Oak ran, from many places (every git command with its result, background fetches, errors), like VS Code's Output, replacing the single current-or-last output dialog; the status bar message already opens that dialog. Needs a design first: what counts as an entry, how many to keep, whether it persists, filters, and whether the stream is the one place a missed result can be recovered.
- More status bar items, each only with a concrete workflow benefit and never a duplicate of something already on screen: a working-tree summary for expanded Code (it repeats the Changes badge, so only if its absence there is missed).
- Menu-wide type-ahead: typing in a menu only searches its own level, so "squash" does not find an item inside a submenu. Leaving it for the palette was chosen for now; revisit if people ask.
- Submodules: list them with status (clean, modified, uninitialised), initialise and update, open one as a repository. Everyday actions only; no `submodule add` wizard until asked.
- Git LFS: show which files are LFS pointers and whether uploads are pending, using `git lfs` output. LFS itself already works through the user's `git`.
- Bisect as a guided flow: mark good and bad from History, show progress and the found commit, always offer Reset.
- User-installable file icon packs, like custom themes: folders in an `icon-packs` folder under the app data folder, each with a `pack.json` (names, extensions, folders, light variants) and SVGs; "Import icon pack…" would validate and extract a zip into it. Needs SVG sanitising (render as `<img>` only), zip-slip and size limits, and a decision on depending on the `material-icon-theme` npm package instead of vendoring. A Seti-based monochrome pack is an option if Simple feels too generic.
- Skip for rebase, cherry-pick and revert conflicts (prototyped and removed as niche and destructive; revisit if asked, with a confirm naming the dropped commit). Conflict safeguards (branch-named ours/theirs, a confirm when one side drops the other's changes, an Undo toast); revisit if users report lost work.
- Commit options follow-ups: author and date overrides, `--reset-author` for amend, trailers such as Co-authored-by, a "Verified" signature badge in History (no git commit flag exists for checking signatures; it is a display feature), and a hint when an undone WIP commit was already pushed (the remote still has it and the next push needs a force push). Not wanted: `--no-post-rewrite`.
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

- Partial code expansion: show hidden unchanged regions as gap rows with expand up, expand down and expand all (about 20 lines a click, like GitHub), reading the file at that revision. Expanded lines become ordinary context rows so find and line selection keep working; the context steps set the initial gap. Replaces the older "fold long unchanged regions" idea.
- Mouse alternatives for the layout toggle, only if testing shows a need.
- Whole-file syntax tokenizing (a hunk that starts mid-construct can be mis-coloured).
- More previewers for non-source files (PNG and other images, PDF, safe formats) instead of "binary file differs": add one file under `preview/` and a line in `previewers.ts`; never run scripts. Follow-ups for the SVG one: zoom and pan (`react-zoom-pan-pinch`), swipe and onion-skin comparison, a fit and actual size toggle, a minimum display size for tiny icons, and a per-user default mode (Preview or Diff) that survives restarts (today the choice lasts until Oak restarts).
- "Open" and "Show in folder" from file menus (read-only temporary copy for historical revisions); never execute automatically, confirm for executable and script types.
- Browse the repository at the working tree or a commit, including unchanged files, with filename search (History "All files" covers part of this; a working-tree browser is not built).
- Neighbour diff prefetch if History stepping feels slow; a state library such as Zustand for shared selection and scope, only if needed.

**Interface and keyboard**

- Rebindable command shortcuts with conflict detection and reset (widget keys stay fixed); optional saved wrap-around for branch and history search.
- Branch hiding by pattern and remote-only status works in the sidebar and graph (per repository, in Branch options, Preferences > Repository and the branch menu). Only if needed: hiding in pickers and the palette, and a keep-visible list for remote branches.
- More themes (high contrast, GitHub, Nord) and a theme editor.
- A Simple and Advanced mode, and keyboard follow-ups (panes registering their own search, a CI collision test over the command registry), only when a concrete workflow needs them.

**Platform**

- Installers and testing for macOS and more Linux distributions.
