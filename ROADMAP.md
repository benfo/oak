# Roadmap

Status, decisions and ideas. [PRODUCT.md](PRODUCT.md) holds who Oak is for and its principles; [AGENTS.md](AGENTS.md) the conventions and design rules; `CHANGELOG.md` the per-release detail. Keep this short: when something ships, fold it into Shipped.

## Current status (2026-11-01)

**Open source (done 2026-10-23).** `benfo/oak` is the single public MIT repo; the private `benfo/oak-source` is archived and `OAK_PUBLIC_TOKEN` revoked. `main` is one root commit ("Initial open-source release"); older releases and tags were deleted on purpose. Workflows use the built-in `GITHUB_TOKEN` and the site publishes to this repo's `gh-pages` (release steps in `docs/releasing.md`). Community files exist (`CONTRIBUTING.md`, `SECURITY.md` with private vulnerability reporting, `CODE_OF_CONDUCT.md`, issue and PR templates); contributions are MIT with no CLA and the maintainer approves every PR. `main` is protected (no force pushes or deletion, PRs for outside contributors; the owner can push directly). Impeccable tooling stays local and gitignored.

Lessons for a future history rewrite or tag move:

- Force-pushing a tag triggers **Release packages**; it fails safely (`scripts/release.cjs` refuses to republish) but is noise.
- A force push to `main` may not redeploy the site: run `gh workflow run website.yml --ref main` and check the live version text.
- Remove branch protection before a force push and restore it after. GitHub may keep old SHAs reachable until Support garbage-collects them.
- This clone excludes `gh-pages` from fetch: `git config --add remote.origin.fetch "^refs/heads/gh-pages"` then `git branch -dr origin/gh-pages`. A fresh clone needs the same.

**Release state.** 0.1.22 is the latest release (2026-10-29), after 0.1.21 (2026-10-29) and 0.1.20 (2026-10-28). The website downloads follow the latest published release (`website/src/data/release.json`, updated after the packages are public). The next release follows `docs/releasing.md`. Open items:

- Open in editor: self-hosted GitHub, GitLab or Bitbucket servers need a host to provider setting (add it beside the provider list); a line link from a working file with local edits on a pushed commit can point a few lines off.
- "Merge into" a branch already contained in the current one says "Nothing to merge". A disabled "(already merged)" item was reverted because the check delayed the menu; if wanted, compute it in the background like the compare-target cache.
- Transit-map redesign of the Light and Dark themes (tokens only; see `PRODUCT.md`, `DESIGN.md`). Still open: `--radius-full` pills could use the signage radius, Dark grounds could take an ink tint, the Light selection tint is cool on warm paper, `.icon-btn` has a literal `24px` width. The 5,000-commit scroll test is removed with a TODO in `tests-ui/smoke.test.ts`; restore and stabilise it before adding `test:ui` to CI.

## Resume next

0. **Website follow-ups.** Panels differ in height, so content below the map shifts a little when a station changes; revisit if it bothers anyone. Keep "planned" in step with this file. Notes and rules are in `website/README.md`.
1. **Refactor.** Add the `test:ui` job to `checks.yml` once the suite is stable (needs a display on Linux, for example xvfb). Work down the `max-lines` warnings when touching those files.
2. **Agent contributions.** `AGENTS.md` is contributor-facing; the maintainer's workflow lives in gitignored `AGENTS.local.md` (plus a `CLAUDE.local.md` import, both in `.git/info/exclude`), so a fresh clone must recreate them. Open: how to check that agent-written PRs follow the rules (PR template checklist, CI).
3. **Code signing.** Windows marks downloads with Mark of the Web, so users must Unblock the installer (the website explains). The fix is signing: SignPath Foundation is free for open source and Oak is now public; compare Azure Artifact Signing (about $10 a month, `win.azureSignOptions`, no hardware token). SmartScreen may warn until reputation builds. Needs the maintainer to set up the account.
4. **Conflict follow-ups** (one small step at a time): stash-pop conflict banner, ours/theirs labels (swapped in a rebase), modify/delete conflicts, pulling conflicts from Pull/Rebase into the same flow.
5. **Housekeeping.** Confirm Linux in more real-world testing.

## Shipped

One line per release; details are in `CHANGELOG.md`. Versions are approximate before 0.1.8.

- **0.1.1 to 0.1.7:** installer and auto-update, core client (graph, staging by file, hunk and line, commits, branches, tags, stashes, merge, rebase, cherry-pick, revert, reset), themes, Shiki, side-by-side diffs, React Aria, comparison, shortcut reference, keyboard architecture, Linux packages (experimental), F11 expansion, resizable splits.
- **0.1.8 to 0.1.15:** branch comparison, diff context and layout toggle, pull request links, zoom, per-file history, All files tree, tab model and F6, conflict handling (no built-in resolution editor by design), List or Tree files, virtualized History and diffs, the "system map" website (`website/src/data/lines.ts`, `components/SystemMap.astro`), the Playwright suite.
- **0.1.16 to 0.1.19:** Transit-map themes, branch hiding, Blame (Ctrl+3), space and tab markers, per-feature style files, find in diffs, Escape policy.
- **0.1.20:** ignore-whitespace diffs (session only; whole-file actions include hidden edits), branch and tag menus from History badges, `Tip` tooltips.
- **0.1.21:** focus mode keeps the file list, sidebar icon rail (`Ctrl+[`), file type icons (None default, Simple, Colour).
- **0.1.22:** SVG preview, Open in editor, remote links (open in browser, pull request, copy link), commit options and WIP commits, one menu group order, small-window layout fixes (`lib/layoutMinimums.ts`).

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
- **Big collections:** the sidebar lists the newest 100 tags with a searchable "Go to tag…" picker.
- **Libraries (audited 2026-10-20):** Git produces diffs, Shiki highlights, React Aria and react-resizable-panels own UI behaviour, `fuzzysort` ranks the palette behind `lib/fuzzy.ts`; nothing worth replacing. The graph and diff stay custom (`diff`'s `parsePatch` lacks combined diffs).
- **Packaging:** the app includes only `out/main`, `out/preload` and `out/renderer`; scratch repos, profiles and screenshots under `out/` must never ship.

## Backlog

Ideas only. None is agreed, and each needs a concrete workflow and a discussion first.

**Git features**

- Interactive rebase, three-way merge editor, Git command log panel.
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
