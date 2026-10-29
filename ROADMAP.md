# Roadmap

Done, in progress and backlog. [PRODUCT.md](PRODUCT.md) holds who Oak is for and its principles; [AGENTS.md](AGENTS.md) holds the conventions and design rules; this file records status, decisions and ideas. Keep it short: when something ships, fold it into the shipped list below.

## Current status (2026-10-28)

**Open source (done 2026-10-23).** `benfo/oak` is the single public MIT repo. The private `benfo/oak-source` is archived and `OAK_PUBLIC_TOKEN` is revoked. `main` is one root commit, "Initial open-source release", and older releases and tags were deleted on purpose. Subsequent releases use the public repository.

- Workflows run in this repo with the built-in `GITHUB_TOKEN`. The site publishes to this repo's `gh-pages`. Release steps are in `docs/releasing.md`.
- Community files: `CONTRIBUTING.md`, `SECURITY.md` (private vulnerability reporting is on), `CODE_OF_CONDUCT.md`, issue and PR templates. Contributions come in under MIT with no CLA, and the maintainer approves every PR.
- `main` is protected: no force pushes or deletion, and PRs for outside contributors. The owner can still push directly.
- Impeccable tooling was removed from the repo and stays local and gitignored.

Lessons for any future history rewrite or tag move:

- Force-pushing a tag triggers **Release packages**. It fails safely because `scripts/release.cjs` refuses to republish a published version, but it is noise.
- A force push to `main` may not redeploy the site. Run `gh workflow run website.yml --ref main` and check the live version text.
- Remove branch protection before a force push and restore it afterwards. GitHub may keep old SHAs reachable until Support garbage-collects them.
- This clone excludes `gh-pages` from fetch so it does not clutter History: `git config --add remote.origin.fetch "^refs/heads/gh-pages"` then `git branch -dr origin/gh-pages`. A fresh clone needs the same two commands.

**Release state.** Oak 0.1.19 has shipped, following 0.1.18 (Blame and space/tab markers). The website downloads point to 0.1.19. The next release follows `docs/releasing.md`. Details worth keeping from recent work:

- "Merge into" a branch that is already contained in the current branch now says "Nothing to merge: <branch> already contains <ref>" (`merge` returns Git's output). A disabled "(already merged)" menu item was tried and reverted because the check delayed the menu. If wanted later, compute it in the background when a repo opens or refreshes, like the compare-target cache, so menus never wait on Git.
- V switches the changed-files List/Tree view from the diff as well as the file lists (`switchView` has the `diff` role in `lib/keymap.ts`). It does nothing in the graph, sidebar or toolbar, or in History's All files mode.
- Opening Oak with flags before the folder (as automation tools pass them) now opens the right folder.
- What's new lists the last 3 releases when no version range applies (`RECENT_RELEASES` in `lib/releaseNotes.ts`), so someone who skipped versions can still see recent notes. The notes list is a focusable pane, and the Preferences General tab attaches the Vim hint under its checkbox.
- Website: map stops show a hint, a chevron and a "Back to the map" link, scroll their panel into view on click, and mobile visitors see a note that Oak is a desktop app.
- Transit-map visual redesign of the Light and Dark base themes (tokens only; layout, behaviour and keyboard model unchanged): warm paper and ink Light, ink Dark, 2px radii, saturated line colours, a 3px graph with ringed stations, filled merge dots and a HEAD ring, WCAG AA text tiers, quieter avatars. Context is in `PRODUCT.md` and `DESIGN.md`. Still open from the finish review: `--radius-full` pills (branch button, chips) could use the signage radius, the Dark grounds could take an ink tint, the Light selection tint is cool on warm paper, and `.icon-btn` has a literal `24px` width. The 5,000-commit scroll test is currently removed with a TODO in `tests-ui/smoke.test.ts`; restore and stabilise it before adding `test:ui` to CI.

**0.1.19 shipped (2026-10-26).** Find in diffs and file previews: History and Changes share find with Blame, covering commit file previews and inline and side-by-side diffs. Search counts occurrences in the loaded diff, including added and deleted lines. `:N` uses After line numbers, or Before for deleted files. The shortcut reference searches by actual key bindings and names the view or control that owns each shortcut. Escape now exits file history from the graph, empty results or banner, the same agreed exception as Comparison. The website downloads point to 0.1.19. Validation: 203 unit tests, typecheck, formatting and lint (11 file-size warnings, no errors). Escape test follow-up (2026-10-28): reproduced the file history banner-button failure and corrected the test to dismiss its keyboard-focus tooltip before exiting file history, asserting focus at each step. All 6 Escape UI tests pass; app behaviour is unchanged. The removed 5,000-commit scroll test still needs restoring and stabilising before adding `test:ui` to CI.

## Merged, unreleased

- **Ignore-whitespace diff review and toolbar cleanup (PR #24, merged 2026-10-28).** Session-only filter shared by Changes and History, off at startup. Hide space, tab and CRLF/LF edits while retaining blank-line additions/deletions. Line and hunk actions use exact selected text and preserve hidden whitespace-only edits; whole-file actions still include everything. Whitespace-only files remain listed with an action to reveal their changes. Diff options groups layout, context and whitespace controls; navigation remains directly accessible, and the active filter has a visible reset control. Narrow panes use two fixed toolbar rows. Lucide supplies icons through the shared component. Validation: 81 focused unit tests and 19 focused Electron UI tests pass, plus build, typecheck, lint and formatting. Included in the next release.

- **Ref menus from History badges, Shift+Menu and a steadier commit details pane (PR #25, merged 2026-10-28).** Right-click a branch or tag badge in the History list for its menu (the sidebar's, now shared through `lib/tagMenu.ts` and `showBranchMenu`), with a ring in the badge's colour while it is open. `HEAD` and unmatched badges fall through to the commit menu, and the old "Manage…" items left the commit menu. Shift+Menu opens the active commit's ref menu (a picker first when it has several refs, the commit menu when none). Native `title` tooltips became `Tip`, which has a hover-only mode (`focusable={false}`) for non-interactive elements. The commit details scroll as one area with the subject and the author and hash rows pinned, and only the subject pinned when the details column is under 440px tall. Ref menus from the keyboard exist only as Shift+Menu; a Tab-through-badges idea was deferred. Included in the next release.

## In review (branch feature/focus-mode-file-list-and-sidebar-rail)

- **Focus mode and the sidebar rail (2026-10-28).** Focus mode keeps the file list beside the diff (Changes and History) while the sidebar, the rail and the History commit graph step away; `F` hides or shows the list from the diff or the list. Focus stays in the file list when entering focus mode if the list is visible, and moves to the code only when its pane went away. The collapsed sidebar is now an icon rail (Changes with a count, History, Blame while open, plus the expand toggle) with Ctrl+1 to Ctrl+3 in its tooltips, one Tab stop, F6, arrows, Home and End, optional Vim keys including gg and G, and → into the main area. `Ctrl+[` toggles sidebar and rail, and the sidebar's nav rows show their Ctrl+1 to Ctrl+3 keys on hover or keyboard focus. Escape now exits focus mode while the History All files tree has focus (React Aria's default Escape handling stopped it, so the tree uses `escapeKeyBehavior="none"`). New UI tests: `escape-all-files`, `focus-mode-focus` and `sidebar-rail`. The website focus stop and shortcut list are updated on the branch; the `oak-focus` screenshot still shows the old diff-only focus mode and needs recapturing before the site is published.

## In review (branch feature/file-type-icon-packs)

- **File type icons (2026-10-29).** Built-in icon packs for file and folder rows in the Changes list, a commit's changed files and the commit file tree, through one `FileIcon` component. Three choices in Preferences > Appearance and the palette ("File icons: …"): **None** (the default, today's look), **Simple** (monochrome Lucide glyphs in a muted text colour, about 19 kinds of file) and **Colour** (a curated 106-icon subset of Material Icon Theme, MIT, with light-theme variants for a few icons). Matching is by exact name, then name prefix (`.env.*`), then the longest extension (`.test.ts`, `.d.ts`), then a generic icon. Icons sit in a fixed 14px slot, so rows never shift; Colour icons are softened to 80% until the row is hovered, focused or selected, and Simple icons use the muted text colour (at least 4.1:1 on every built-in theme) and a 1.5px stroke. A pack is data plus a `render` function, so more built-in packs are cheap. Attribution is in `THIRD-PARTY-NOTICES.md`, shipped with the app as an extra resource. The default stays None until the maintainer has tried it; switching it is one value in `settings.ts`. The website's tree stop shows both packs; its screenshots are real captures of a synthetic repo. Validation: 9 focused unit tests, typecheck, build, lint (no errors).

## Resume next

0. **Website follow-ups.** The revamp has shipped. Panels have different heights, so content below the map shifts a little when a station changes; revisit if it bothers anyone. Keep the "planned" section in step with this file. Blame now has a released feature stop. Notes and rules are in `website/README.md`.
1. **Refactor follow-ups.** Add the `test:ui` job to `checks.yml` once the suite has been stable for a while (it needs a display on Linux, for example xvfb). Work down the `max-lines` warnings (`npm run lint`) when touching those files. The Babel parser peer dependency is now declared explicitly.
2. **Agent contributions (first pass done).** `AGENTS.md` is now contributor-facing (design rules, keyboard model, tokens, checks, no releases or deploys). The maintainer's personal workflow lives in gitignored `AGENTS.local.md` (plus a `CLAUDE.local.md` import, both listed in `.git/info/exclude`), which `AGENTS.md` tells any agent to read, so a fresh clone needs them recreated. Still open: decide how to check that agent-written PRs follow the rules (PR template checklist, CI), and whether `AGENTS.md` should be shorter.
3. **Code signing.** Windows marks downloads with Mark of the Web, so users must Unblock the installer (the website explains the workarounds). The real fix is signing. SignPath Foundation is free for open-source projects and Oak is now public, so it is worth reconsidering next to Azure Artifact Signing (about $10 a month, supported by electron-builder `win.azureSignOptions`, no hardware token). SmartScreen may still warn until reputation builds. Needs the maintainer to set up the account.
4. **Conflict handling follow-ups** (one small step at a time; the maintainer wants it kept simple): stash-pop conflict banner, ours/theirs side labels (swapped in a rebase), modify/delete conflicts, pulling conflicts from Pull/Rebase into the same flow.
5. **Housekeeping.** Optionally ask GitHub Support to garbage-collect the old commit SHAs; confirm Linux in more real-world testing.

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
- Website revamp: the page is a "system map" in the app's Transit Map identity. Four coloured lines hold features as stations, and selecting a station shows its panel with a screenshot, keys and points. It works without JavaScript and is keyboard navigable (`website/src/data/lines.ts`, `components/SystemMap.astro`).
- The History file list renders only the rows near the viewport (checked with a 5,000-file commit). The other long lists (commit graph, sidebar tree, palettes, All files tree, Changes) were already virtualized; the rest are small and bounded.
- A Playwright smoke suite (`npm run test:ui`, `tests-ui/`) drives the real app: open, diff, staging, line selection, hunks, layouts, History, and the 5,000-commit and 60,000-line windows. Adding it to CI is a follow-up once it has proven stable.
- The diff view (inline and side by side) renders only rows near the viewport once a diff has over 600 rows, using `@tanstack/react-virtual` (checked with a 60,000-line file). Native select-all and copy then cover only rendered rows; line-pick copy is unaffected.

**0.1.16 to 0.1.19**

- Transit-map Light and Dark themes, graph station rings and merge dots.
- Per-repository branch hiding by pattern and remote-only status, with the checked-out branch always visible.
- Persistent Blame view (Ctrl+3), with commit details, History navigation, stepping to earlier versions, occurrence-based find and line jumps, ignore-whitespace and ignore-revisions options. Escape dismisses transient UI and keeps the view open. Shared find helpers, hook and bar are ready for other code views.
- Space and tab markers shared by diffs and Blame.
- Feature styles split into separate files, preserving cascade order.
- Website downloads updated to 0.1.19, with a Blame map stop and screenshot.
- Find in diffs and file previews shared with Blame (`:N` line jumps, current match scrolled into view, split diffs scroll only the matching column), key-aware shortcut reference search, and Escape exiting file history like Comparison.
- Blame follow-ups remain: a revision picker, copy detection, blame in side-by-side diffs, and cancelling stale requests when switching files.

## Decisions worth keeping

- **Styles:** feature CSS lives in `src/renderer/src/styles/`, one plain CSS file per feature, imported in cascade order from `styles/index.css` (split from the old `styles.css`; the built CSS was identical apart from blank lines). New features get their own file. No colocation, CSS Modules or Tailwind. Pairs split by the old cascade (toolbar and toolbar-buttons, sidebar and sidebar-tree, changes and file-lists, diff and line-selection, focus and keyboard-navigation) stay separate; merge one only after checking specificity and order.
- **Menus:** primary actions first, then Compare, Merge / Rebase submenu, "New … from here…", Manage submenu (housekeeping and destructive), and a final Copy submenu when there are two or more variants. One level of submenus. Never assume a main branch or infer a comparison target from a branch name. Menu wording: plain labels, no em dashes, colons for explanation.
- **Comparison:** starts only from explicit actions (context menu, palette), not from selecting a sidebar row. Active controls live with the results in commit details.
- **Palette:** add commands for frequent actions, hard-to-discover features or useful direct keyboard access. Keep branch sorting and hiding in the Branches menu.
- **Toolbar:** keep Fetch, Pull and Push visible; occasional actions go in menus and the palette. No toolbar customisation until daily use shows a need.
- **Conflicts:** rely on Git and the user's merge tool. A first attempt with ours/theirs labels, a dropped-changes confirm, an Undo toast and Skip was removed as too much.
- **Layouts:** F11 expands the code area and keeps the file list fixed beside the diff, `F` hides or shows that list (session only), and `Ctrl+[` collapses the sidebar to an icon rail (it does nothing in focus mode). The named Standard, Focus history and Focus code layouts, Layout menu and Resize panes picker were removed, as were a file list drawer that overlaid the diff and hiding the toolbar in focus mode. No docking, no automatic collapsing.
- **Website:** factual copy, no sales language, no unsupported "only" or "unique" claims, the command palette featured prominently. No live demo or simulator; screenshots are real app captures of a synthetic repo. Section backgrounds alternate strictly after the plain hero.
- **Big collections:** the sidebar lists the newest 100 tags with a searchable "Go to tag…" picker, and leaves collapsed sections' children out of the Tree because React Aria rebuilds its collection on every render.
- **Libraries (audited 2026-10-20):** Git produces diffs, Shiki highlights, React Aria and react-resizable-panels own UI behaviour, `fuzzysort` ranks the palette behind `lib/fuzzy.ts`. Nothing found worth replacing; the graph and diff stay custom (`diff`'s `parsePatch` lacks combined diffs). `@tanstack/react-virtual` drives the long lists we render ourselves (History files, diff).
- **Shared Escape policy (shipped in 0.1.19):** Escape dismisses transient UI and line selection, then restores expanded Code. It keeps content pane focus. Agreed contextual exceptions: a visibly announced comparison or file history with an explicit Exit control owns Escape in its graph or banner/controls, after menus, pickers and tooltips are dismissed. Escape in code or file lists preserves the mode. New mode-exit exceptions require explicit agreement. Search fields and other pane tools return to their owning pane. Empty History results participate in F6 navigation and show the standard focus ring. Shared ordered dismissal has repeat protection; tooltip-wrapped buttons forward unhandled keys and focus lookup skips hidden or inert panes. Rules and shortcut help match. Validation: 198 unit tests and all 44 Electron UI tests pass, along with typecheck, formatting and lint (12 file-size warnings, no errors).
- **Reuse:** a feature that will appear in several views is built once as a helper, a hook and a component, and each view supplies only its own text, line model and cursor. Find in file is the model.
- **Packaging:** the app includes only `out/main`, `out/preload` and `out/renderer`; scratch repos, profiles and screenshots under `out/` must never ship.

## Backlog

Ideas only. None is agreed, and each needs a concrete workflow and a discussion before building.

**Git features**

- Interactive rebase (reorder, squash, edit), three-way merge editor, Git command log panel.
- User-installable file icon packs, like custom themes. Built-in packs exist (None and a Material Icon Theme subset); user packs would be folders in an `icon-packs` folder under the app data folder, each with a `pack.json` mapping (names, extensions, folders, light variants) and SVGs. Zip import ("Import icon pack…") would validate and extract into that folder. Needs SVG sanitising (render as `<img>` only), zip-slip and size limits, and a decision on depending on the `material-icon-theme` npm package instead of vendoring its SVGs.
- Skip for rebase, cherry-pick and revert conflicts (`git <op> --skip`). It was prototyped and removed as niche and destructive; revisit if people ask, with a confirm naming the dropped commit.
- Conflict safeguards: ours/theirs buttons labelled with branch names, a confirm when taking one side drops the other's changes, an Undo toast. Revisit if users report lost work.
- Compare the working tree against any selected commit.
- Blame from a line: a "Blame this line" action in the diff line menu that opens Blame with the cursor already on that line. Needs a decision for deleted lines (blame the old side at the parent) and for History diffs (blame as of that commit).
- Shared find options for diffs and Blame: case sensitive, whole word and regular expression matching.
- Commit details for a line while reading a diff or file, like VS Code's inline blame or hover (author, date, subject, full message on demand), without opening the Blame view. Explore a hover or key-triggered popover first; an always-on inline annotation risks the distraction people report with GitLens.
- Pull request support: host-to-provider mapping for self-hosted remotes, fork workflows, target branch selection, and a lightweight local PR review (pass a PR URL or pick branches, fetch the refs, open the comparison in Oak; comments and approvals stay on the provider's site).
- More preferences: default clone folder, external tools, fonts.
- Open the repository in VS Code or the user's configured default editor.
- Worktrees for agent workflows: discover and track them, create and remove them, and explore viewing worktrees side by side. Define the everyday workflow before choosing the UI.

**Diff and files**

- Fold long unchanged regions in a diff into one expandable row ("340 unchanged lines"), so distant changes sit close together and need less scrolling. A possibility, not planned. The diff header already sets one context amount for the whole diff (3 lines up to the whole file); folding would add per-region expand and collapse. Needs a decision on how it interacts with context steps, find and line selection.
- Optional linked horizontal scrolling in side-by-side diffs (a check item in the diff options menu); independent scrolling stays the default.
- Mouse alternatives for the diff layout toggle, only if testing shows a need.
- Whole-file syntax tokenizing, since a hunk that starts mid-construct can be coloured wrongly.
- Preview non-source files (images, PDFs, safe formats) instead of "binary file differs". Never run scripts; render SVG as an image only.
- Open files with their associated app: "Open" and "Show in folder" from file menus, using a read-only temporary copy for historical revisions. Never execute files automatically and confirm for executable and script types.
- Browse the repository at the working tree or a selected commit, including unchanged files, with filename search. Part of this shipped as History "All files"; a working-tree browser is not built.
- Neighbour diff prefetch if History stepping still feels slow; a state library such as Zustand for shared selection and scope state, only if needed.

**Interface and keyboard**

- Rebindable command shortcuts, with conflict detection and reset. Widget keys stay fixed.
- Optional saved wrap-around for branch and history search (searches currently stop at the ends).
- Hiding branches by pattern, and hiding remote branches without a local copy, work in the sidebar and the history graph (per repository, in Branch options, the Repository tab of Preferences and the branch menu). Still open, only if everyday use shows the need: hiding them in pickers and the palette, and a keep-visible list for remote branches.
- More built-in themes (high contrast, GitHub, Nord) and a theme editor.
- A narrow icon rail for the sidebar, a Simple and Advanced mode, and keyboard architecture follow-ups (panes registering their own search, a CI collision test over the full command registry). Only when a concrete workflow needs them.

**Platform**

- Installers and testing for macOS and more Linux distributions.
