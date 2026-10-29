# Roadmap

Status, decisions and ideas. [PRODUCT.md](PRODUCT.md) holds who Oak is for and its principles; [AGENTS.md](AGENTS.md) the conventions and design rules; `CHANGELOG.md` the per-release detail. Keep this short: when something ships, fold it into Shipped.

## Current status (2026-10-29)

**Open source (done 2026-10-23).** `benfo/oak` is the single public MIT repo; the private `benfo/oak-source` is archived and `OAK_PUBLIC_TOKEN` revoked. `main` is one root commit ("Initial open-source release"); older releases and tags were deleted on purpose. Workflows use the built-in `GITHUB_TOKEN` and the site publishes to this repo's `gh-pages` (release steps in `docs/releasing.md`). Community files exist (`CONTRIBUTING.md`, `SECURITY.md` with private vulnerability reporting, `CODE_OF_CONDUCT.md`, issue and PR templates); contributions are MIT with no CLA and the maintainer approves every PR. `main` is protected (no force pushes or deletion, PRs for outside contributors; the owner can push directly). Impeccable tooling stays local and gitignored.

Lessons for a future history rewrite or tag move:

- Force-pushing a tag triggers **Release packages**; it fails safely (`scripts/release.cjs` refuses to republish) but is noise.
- A force push to `main` may not redeploy the site: run `gh workflow run website.yml --ref main` and check the live version text.
- Remove branch protection before a force push and restore it after. GitHub may keep old SHAs reachable until Support garbage-collects them.
- This clone excludes `gh-pages` from fetch: `git config --add remote.origin.fetch "^refs/heads/gh-pages"` then `git branch -dr origin/gh-pages`. A fresh clone needs the same.

**Release state.** 0.1.21 is the latest release (2026-10-29: file type icons, focus mode that keeps the file list, the sidebar icon rail), after 0.1.20 (2026-10-28). The website downloads follow the latest published release (`website/src/data/release.json`, updated after the packages are public). The next release follows `docs/releasing.md`. Worth keeping:

- "Merge into" a branch already contained in the current one says "Nothing to merge: <branch> already contains <ref>". A disabled "(already merged)" item was reverted because the check delayed the menu; if wanted, compute it in the background like the compare-target cache.
- V switches List/Tree from the diff as well as the lists (`switchView`, `diff` role in `lib/keymap.ts`); it does nothing in the graph, sidebar, toolbar or History's All files.
- What's new lists the last 3 releases when no version range applies (`RECENT_RELEASES` in `lib/releaseNotes.ts`).
- Built on `feature/open-in-editor`, not yet released (fold into Shipped when preparing the release; the CHANGELOG and What's new entries are written then): Open in editor (Preferences > External tools: VS Code, Cursor, Sublime Text, Notepad++ or a custom command, `shared/editors.ts`); Open in browser, Open pull request and Copy link (repository, branch, commit, file and line) that never open a page that would 404 (`shared/remote/`: one file per provider in `providers/`, `rules.ts` for when a page may be opened, `main/remote.ts` for the git facts); "Open with default app" only for files an editor cannot edit; menus reordered to the one group order under Decisions, with destructive actions last; menus opened from the keyboard ignore a resting mouse pointer until it moves (`lib/useKeyboardMenuHoverLock.ts`). Open follow-ups: self-hosted GitHub, GitLab or Bitbucket servers need a host to provider setting (add it beside the provider list); a line link from a working file with local edits on a pushed commit can point a few lines off.
- Transit-map redesign of the Light and Dark themes (tokens only; see `PRODUCT.md`, `DESIGN.md`). Still open: `--radius-full` pills could use the signage radius, Dark grounds could take an ink tint, the Light selection tint is cool on warm paper, `.icon-btn` has a literal `24px` width. The 5,000-commit scroll test is removed with a TODO in `tests-ui/smoke.test.ts`; restore and stabilise it before adding `test:ui` to CI.

## Resume next

0. **Website follow-ups.** Panels differ in height, so content below the map shifts a little when a station changes; revisit if it bothers anyone. Keep "planned" in step with this file. Notes and rules are in `website/README.md`.
1. **Refactor.** Add the `test:ui` job to `checks.yml` once the suite is stable (needs a display on Linux, for example xvfb). Work down the `max-lines` warnings when touching those files.
2. **Agent contributions.** `AGENTS.md` is contributor-facing; the maintainer's workflow lives in gitignored `AGENTS.local.md` (plus a `CLAUDE.local.md` import, both in `.git/info/exclude`), so a fresh clone must recreate them. Open: how to check that agent-written PRs follow the rules (PR template checklist, CI).
3. **Code signing.** Windows marks downloads with Mark of the Web, so users must Unblock the installer (the website explains). The fix is signing: SignPath Foundation is free for open source and Oak is now public; compare Azure Artifact Signing (about $10 a month, `win.azureSignOptions`, no hardware token). SmartScreen may warn until reputation builds. Needs the maintainer to set up the account.
4. **Conflict follow-ups** (one small step at a time): stash-pop conflict banner, ours/theirs labels (swapped in a rebase), modify/delete conflicts, pulling conflicts from Pull/Rebase into the same flow.
5. **Housekeeping.** Optionally ask GitHub Support to garbage-collect old SHAs; confirm Linux in more real-world testing.

## Shipped

Versions are approximate before 0.1.8. Details per release are in `CHANGELOG.md`.

- **0.1.1 to 0.1.5:** Windows installer and auto-update; core client (graph, working changes, staging by file, hunk and line, commits with live hook output, branches, tags, stashes, fetch, pull, push, clone, merge, rebase, cherry-pick, revert, reset, checkout); Preferences, light and dark themes, custom theme files, author pictures; Shiki highlighting, word-level changes, side-by-side diffs; React Aria for collections and overlays (graph and diff stay custom); bundled "What's new"; comparison, shortcut reference (Ctrl+/), sidebar quick access, graph emphasis of the current branch.
- **0.1.6 to 0.1.7:** Linux packages (experimental; macOS untested); explicit line selection and diffs that refresh after content changes; keyboard architecture (one dispatcher, `lib/keymap.ts`, `usePane`, optional Vim keys); F11 code expansion, resizable splits, reduced toolbar, remembered window; website redesign.
- **0.1.8 to 0.1.11:** simpler branch comparison and History scope menu; stage-all prompt on empty commit; diff context steps and Ctrl+Shift+D; open pull request for GitHub, GitLab, Bitbucket and Azure DevOps; Ctrl+scroll zoom; pinned "Working changes" row; diff copy; Preferences > Git; History All files tree and per-file history.
- **0.1.12 to 0.1.15:** tab model (one stop per collection, F6 pane jumps); conflict handling (auto-switch, Abort/Continue banner, open in merge tool, marker warning; no built-in resolution editor by design); changed files as List or Tree (V); the "system map" website (`website/src/data/lines.ts`, `components/SystemMap.astro`, works without JavaScript); virtualized History files and large diffs (`@tanstack/react-virtual`; native select-all and copy then cover only rendered rows); the Playwright suite (`npm run test:ui`, `tests-ui/`).
- **0.1.16 to 0.1.19:** Transit-map themes; per-repository branch hiding; persistent Blame view (Ctrl+3; follow-ups: a revision picker, copy detection, blame in side-by-side diffs, cancelling stale requests); space and tab markers; per-feature style files; find in diffs and previews; Escape policy.
- **0.1.20:** ignore-whitespace diffs (session-only filter shared by Changes and History; hides space, tab and CRLF/LF edits but keeps blank-line changes; line and hunk actions preserve hidden edits, whole-file actions include everything, whitespace-only files stay listed with a reveal action; narrow panes use two fixed toolbar rows); branch and tag menus from History badges (shared with the sidebar via `lib/tagMenu.ts` and `showBranchMenu`; `HEAD` and unmatched badges fall through to the commit menu; Shift+Menu opens the active commit's ref menu, a picker first for several refs); native `title` tooltips replaced by `Tip` (with a hover-only mode); commit details scroll as one area with the subject, author and hash pinned.
- **0.1.21:** focus mode (PR #26): F11 keeps the file list beside the diff while the sidebar, rail and History graph step away, `F` toggles the list, and Escape exits it from the All files tree; the collapsed sidebar is an icon rail (Changes with a count, History, Blame while open, expand toggle; Ctrl+1 to Ctrl+3, one Tab stop, F6, arrows, Home/End, optional Vim keys) toggled by `Ctrl+[`. File type icons (PR #27): one `FileIcon` component draws icons in the Changes list, commit file lists and commit file tree; Preferences > Appearance and the palette ("File icons: …") offer **None** (the default), **Simple** (about 19 monochrome Lucide glyphs, muted colour, 1.5px stroke) and **Colour** (106 Material Icon Theme icons, MIT, with light-theme variants). Matching is exact name, name prefix (`.env.*`), longest extension, then a generic icon; icons keep a fixed 14px slot (no layout shift) and Colour is softened to 80% until hover, focus or selection. Attribution is in `THIRD-PARTY-NOTICES.md`, shipped as an extra resource. The default stays None until the maintainer has tried it (one value in `settings.ts`). The website has a "File type icons" map stop.

## Decisions worth keeping

- **Styles:** one plain CSS file per feature in `src/renderer/src/styles/`, imported in cascade order from `styles/index.css`. New features get their own file; no colocation, CSS Modules or Tailwind. Pairs split by the old cascade (toolbar and toolbar-buttons, sidebar and sidebar-tree, changes and file-lists, diff and line-selection, focus and keyboard-navigation) stay separate; merge one only after checking specificity and order.
- **Menus:** one group order everywhere, separated by dividers: do (primary actions, "New … from here…", Merge / Rebase), explore (Compare, file history, blame), go elsewhere (local first: open in editor, default app, Show in Explorer; then Open in browser and Open pull request; always flat and named "Open in …", never a submenu), Copy submenu (two or more variants), then destructive actions last (Manage, Undo, Discard). One level of submenus for rare variants only; no icons. Never assume a main branch or infer a comparison target from a branch name. Plain labels, no em dashes, colons for explanation.
- **Comparison:** starts only from explicit actions (context menu, palette), never from selecting a sidebar row; its controls live with the results in commit details.
- **Palette:** add commands for frequent actions, hard-to-discover features or useful direct keyboard access. Branch sorting and hiding stay in the Branches menu.
- **Toolbar:** Fetch, Pull and Push stay visible; occasional actions go in menus and the palette. No toolbar customisation until daily use shows a need.
- **Conflicts:** rely on Git and the user's merge tool. A first attempt with ours/theirs labels, a dropped-changes confirm, an Undo toast and Skip was removed as too much.
- **Layouts:** F11 focus mode, `F` for the file list, `Ctrl+[` for the icon rail (rules in `AGENTS.md`). The named layouts, Layout menu, Resize panes picker, an overlaying file list drawer and hiding the toolbar in focus mode were removed. No docking or automatic collapsing.
- **Escape:** dismisses transient UI first and keeps pane focus; comparison and file history are the only agreed mode-exit exceptions, and new ones need explicit agreement (full rules in `AGENTS.md`).
- **Website:** factual copy, no sales language or unsupported "only"/"unique" claims, the command palette featured, no live demo, screenshots are real captures of a synthetic repo, section backgrounds alternate strictly after the hero.
- **Big collections:** the sidebar lists the newest 100 tags with a searchable "Go to tag…" picker and leaves collapsed sections' children out of the Tree (React Aria rebuilds its collection every render).
- **Libraries (audited 2026-10-20):** Git produces diffs, Shiki highlights, React Aria and react-resizable-panels own UI behaviour, `fuzzysort` ranks the palette behind `lib/fuzzy.ts`; nothing worth replacing. The graph and diff stay custom (`diff`'s `parsePatch` lacks combined diffs); `@tanstack/react-virtual` drives our own long lists.
- **Reuse:** a feature that will appear in several views is built once as a helper, hook and component, and each view supplies only its text, line model and cursor. Find in file is the model.
- **Packaging:** the app includes only `out/main`, `out/preload` and `out/renderer`; scratch repos, profiles and screenshots under `out/` must never ship.

## Backlog

Ideas only. None is agreed, and each needs a concrete workflow and a discussion first.

**Git features**

- Interactive rebase, three-way merge editor, Git command log panel.
- User-installable file icon packs, like custom themes: folders in an `icon-packs` folder under the app data folder, each with a `pack.json` (names, extensions, folders, light variants) and SVGs; "Import icon pack…" would validate and extract a zip into it. Needs SVG sanitising (render as `<img>` only), zip-slip and size limits, and a decision on depending on the `material-icon-theme` npm package instead of vendoring. A Seti-based monochrome pack is an option if Simple feels too generic.
- Skip for rebase, cherry-pick and revert conflicts (prototyped and removed as niche and destructive; revisit if asked, with a confirm naming the dropped commit). Conflict safeguards (branch-named ours/theirs, a confirm when one side drops the other's changes, an Undo toast); revisit if users report lost work.
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
- Optional linked horizontal scrolling in side-by-side diffs (a diff options check item; independent stays the default); mouse alternatives for the layout toggle, only if testing shows a need.
- Whole-file syntax tokenizing (a hunk that starts mid-construct can be mis-coloured).
- Preview non-source files (images, PDFs, safe formats) instead of "binary file differs"; never run scripts, render SVG as an image only.
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
