# Roadmap

Status, next steps and decisions. Principles are in [PRODUCT.md](PRODUCT.md), conventions and design rules in [AGENTS.md](AGENTS.md), per-release detail in `CHANGELOG.md`.

Each fact has one place. When work moves, edit **Now**. When something ships, add a line to **Shipped** and delete it from **Now**, **Open items** and **Backlog**. Ideas live in **Backlog**; once agreed, **Features** lists their order only.

## Now (2026-11-13)

- **Released:** 0.1.29 (2026-11-13). The website downloads follow the latest published release (`website/src/data/release.json`, updated once the packages are public).
- **Unreleased (`feature/clean-up-branches`):** "Repository check-up…" (palette, toolbar More actions menu) reports branches, storage and leftover state in one dialog, then deletes the ticked merged or gone branches and compacts with `git gc`. More checks are in Backlog.
- **Flaky UI tests:** `tests-ui/escape.test.ts` "comparison banner Escape dismisses…" and "F6 reaches an empty comparison result…" fail about 1 run in 3 (focus not where expected); `tests-ui/nav-history.test.ts` "view switches" sometimes reads the status line before "Nothing earlier" shows.
- **Not run:** the full Electron UI suite since #35 (focused tests pass).

## Next

Work that unblocks growth and keeps the project healthy.

1. **Code signing.** Windows marks downloads with Mark of the Web, so users must Unblock the installer. Apply to SignPath Foundation (free for open source, slow to approve); fall back to Azure Artifact Signing (about $10 a month, `win.azureSignOptions`, no hardware token). Sign only in the release workflow. Meanwhile publish SHA-256 checksums and build provenance; once signed, drop the Unblock instructions from the README and website. Needs the maintainer to set up the account.
2. **Microsoft Store.** The maintainer has a Partner Center account (confirm individual or company). Store installs skip Mark of the Web, so this complements signing the GitHub installer. Steps, each discussed first: reserve the name, add an `appx` (MSIX) target for a Store build only, turn the in-app updater off there, check the packaged app still runs the user's `git` and keeps its settings, run the Windows App Certification Kit, write the listing, privacy page and age rating, decide whether the release workflow builds it.
3. **Distribution.** `winget` package, README refresh, release checksums, "good first issue" labels; launch after signing. Plan: [docs/marketing-plan.md](docs/marketing-plan.md).
4. **CI.** A `test:ui` job in `checks.yml` once the suite is stable (xvfb on Linux). First restore and stabilise the 5,000-commit scroll test removed with a TODO in `tests-ui/smoke.test.ts`.
5. **Linux.** More real-world testing.

## Features (proposed order, not agreed)

Parity with the most-used features of other Git clients. Each needs its workflow discussed first; detail is in Backlog. "Not built" was checked against `src/main/handlers.ts` on 2026-11-01.

1. Interactive rebase: reorder, drop, reword, merge-aware (squash and fixup are built).
2. Submodules (not built).
3. Git LFS state.
4. Clone and init flow check (a `clone` handler exists).
5. Full text search.
6. Worktrees.
7. Bisect (not built).
8. Compare the working tree against any commit.
9. Commit options follow-ups.
10. Conflict follow-ups, one small step at a time.

Later or by request: everything else in Backlog. A built-in merge editor contradicts the "rely on the merge tool" decision, so only on clear demand.

## Open items

Known gaps in shipped work; fix when touching the area.

- **Back and Forward:** file history and Compare results are not restored, nor the blame scroll offset. Extend `NavPlace` (`src/shared/navPlace.ts`) if needed.
- **Open in editor and remote links:** self-hosted GitHub, GitLab or Bitbucket servers need a host to provider setting; a line link from a working file with local edits on a pushed commit can point a few lines off.
- **Merge into** a branch already contained in the current one says "Nothing to merge". A disabled "(already merged)" item delayed the menu and was reverted; if wanted, compute it in the background like the compare-target cache.
- **Status bar:** no bar on the Welcome screen, so zoom shows no feedback there; an item that loads late (identity, latest commit) shifts its neighbours for about a frame; the git output has no key (decided: no new global key for now).
- **Performance** (`npm run perf:open`): History with 13,800 refs on one commit waits about 0.6 s on `git log` decorations; pickers wait about 2 s for branch details. Not measured: thousands of changed files in a commit, a very large status, huge diffs (fixtures `commits5k`, `hugeDiff`), expanding context in very large files, a real-world large repo. Focus-triggered refresh and an external `git commit` were not driven by hand.
- **Themes:** still open from the transit-map redesign: `--radius-full` pills could use the signage radius, Dark grounds could take an ink tint, the Light selection tint is cool on warm paper, `.icon-btn` has a literal `24px` width.
- **Website:** panels differ in height, so content below the map shifts a little when a station changes. Keep "planned" in step with this file (`website/README.md`).
- **Refactor:** work down `max-lines` warnings when touching those files.
- **Agent contributions:** how to check agent-written PRs follow the rules (PR checklist, CI). The maintainer's workflow lives in gitignored `AGENTS.local.md` and `CLAUDE.local.md` (in `.git/info/exclude`), so a fresh clone must recreate them.

## Shipped

One line per release; details in `CHANGELOG.md`. Versions are approximate before 0.1.8.

- **0.1.1 to 0.1.7:** installer and auto-update, core client (graph, staging by file, hunk and line, commits, branches, tags, stashes, merge, rebase, cherry-pick, revert, reset), themes, Shiki, side-by-side diffs, React Aria, comparison, shortcut reference, keyboard architecture, Linux packages (experimental), F11 expansion, resizable splits.
- **0.1.8 to 0.1.15:** branch comparison, diff context and layout toggle, pull request links, zoom, per-file history, All files tree, tab model and F6, conflict handling, List or Tree files, virtualized History and diffs, the "system map" website (`website/src/data/lines.ts`, `components/SystemMap.astro`), the Playwright suite.
- **0.1.16 to 0.1.19:** transit-map themes, branch hiding, Blame (Ctrl+3), space and tab markers, per-feature style files, find in diffs, Escape policy.
- **0.1.20:** ignore-whitespace diffs (session only), branch and tag menus from History badges, `Tip` tooltips.
- **0.1.21:** focus mode keeps the file list, sidebar icon rail (`Ctrl+[`), file type icons.
- **0.1.22:** SVG preview, Open in editor, remote links, commit options and WIP commits, one menu group order, small-window layout fixes.
- **0.1.23:** squash and fixup from History (range select, Undo), progressive opening of big repositories, ref badge and menu caps, menu type-ahead.
- **0.1.24:** status bar; toasts restyled bottom-right.
- **0.1.25:** keyboard checkout (Enter on a sidebar branch), copy path and `path:line`.
- **0.1.26:** Back and Forward (Alt+Left and Alt+Right).
- **0.1.27:** expand hidden diff context (hunk header buttons, E around the cursor).
- **0.1.28:** step along a commit's line in History (Alt+Down, Alt+Up), SynthWave '84 theme with `glow`, Bitbucket `ssh.bitbucket.org` remotes.
- **0.1.29:** colour-blind friendly diff colours, Windows high contrast support, Alt+Up retraces an Alt+Down walk, History working changes as fast as Changes.

## Decisions worth keeping

Only what `AGENTS.md` does not already cover.

- **Open source:** `benfo/oak` is the single public MIT repo with one root commit; older releases and tags were deleted on purpose. No CLA; the maintainer approves every PR. `main` is protected (no force pushes or deletion; the owner can push directly). Workflows use `GITHUB_TOKEN`; the site publishes to `gh-pages` (`docs/releasing.md`). Impeccable tooling stays local and gitignored. If history is rewritten again: remove branch protection first and restore it after; a force-pushed tag triggers a Release packages run that fails safely (`scripts/release.cjs` refuses to republish); run `gh workflow run website.yml --ref main` because a force push may not redeploy the site. This clone excludes `gh-pages` from fetch (`git config --add remote.origin.fetch "^refs/heads/gh-pages"`, then `git branch -dr origin/gh-pages`); a fresh clone needs the same.
- **Styles:** pairs split by the old cascade (toolbar and toolbar-buttons, sidebar and sidebar-tree, changes and file-lists, diff and line-selection, focus and keyboard-navigation) stay separate unless specificity and order are checked. No colocation, CSS Modules or Tailwind.
- **Menus:** never assume a main branch or infer a comparison target from a branch name. Plain labels, colons for explanation.
- **Comparison:** starts only from explicit actions (context menu, palette), never from selecting a sidebar row; its controls live with the results in commit details.
- **Palette:** commands for frequent actions, hard-to-discover features or direct keyboard access. Branch sorting and hiding stay in the Branches menu.
- **Toolbar:** no customisation until daily use shows a need.
- **Conflicts:** rely on Git and the user's merge tool. Ours/theirs labels, a dropped-changes confirm, an Undo toast and Skip were tried and removed as too much.
- **Layouts:** named layouts, a Layout menu, a Resize panes picker, an overlay file drawer and hiding the toolbar in focus mode were removed.
- **File icons:** the default stays None until the maintainer has tried it.
- **Website:** feature the command palette, no live demo.
- **Big collections:** the sidebar lists the newest 100 tags plus a "Go to tag…" picker. A commit row shows at most 6 ref badges and "+N" (the checked-out ref always stays); a menu lists at most 12 refs per list with a disabled "N more" row. Never render an unbounded list in a row, menu or tooltip.
- **Libraries (audited 2026-10-20):** Git produces diffs, Shiki highlights, React Aria and react-resizable-panels own UI behaviour, `fuzzysort` ranks the palette behind `lib/fuzzy.ts`. Toasts stay in-house (audited 2026-11-02): React Aria's `ToastRegion` adds a document F6 listener, Sonner and Base UI make toasts Tab stops (Base UI also hard-codes F6), Radix hooks Escape, headless react-hot-toast adds little. The graph and diff stay custom (`diff`'s `parsePatch` lacks combined diffs).
- **Back and Forward:** per repository, in memory, recorded on deliberate jumps (view switches, opening a commit or blame, a parent or child link), never on arrowing or Alt+arrow line steps. Alt+Left and Alt+Right, mouse back and forward buttons, palette commands; no toolbar buttons. A place is the view plus its commit, or the blame file, revision and cursor line; a commit no longer in the graph is skipped silently.
- **Accessibility colours:** diff colours are a preference separate from themes, laid over any theme in `theme.ts` (`diff/diffColours.ts`, checked by `tests/diff-colours.test.ts`). Status letters and line counts follow it; graph lanes do not. Changed words are underlined only in the colour-blind mode, never over whitespace. Windows high contrast is honoured through `forced-colors`, not a setting.
- **Themes:** built-in themes are known editor palettes (credited in `builtInThemes.ts`), adjusted until `tests/diff-contrast.test.ts` passes. `glow: true` is one fixed recipe on syntax-coloured code, with no strength or raw CSS. Themes do not set fonts: Oak has no display-only text, so a theme font would become the body font of dense lists.
- **Packaging:** the app includes only `out/main`, `out/preload` and `out/renderer`; scratch repos, profiles and screenshots under `out/` must never ship.

## Backlog

Ideas only, none agreed; each needs a concrete workflow and a discussion first.

**Git features**

- Interactive rebase: reuse the squash planner (`src/shared/rewrite.ts`) and scripted-todo engine (`src/main/rewrite.ts`). Squashing around a skipped commit is a reorder, so it belongs here (Ctrl+click compares). Squash and fixup refuse with a reason on a dirty tree, a merge commit in the way or a file history. 2,000 selected commits: 200 ms to the summary, 350 ms to the dialog, rows not virtualised; revisit near 10,000.
- Submodules: status (clean, modified, uninitialised), initialise and update, open as a repository. No `submodule add` wizard until asked.
- Git LFS: show pointer files and pending uploads from `git lfs` output.
- Bisect as a guided flow: mark good and bad from History, show progress and the found commit, always offer Reset.
- Worktrees: create (new or existing branch), view (path, branch, dirty, locked or prunable), switch, clean up (remove, prune, flag merged branches). Also for agent workflows, including two side by side; define the workflow before the UI.
- Compare the working tree against any selected commit.
- Repository check-up follow-ups: stale stashes (older than about 30 days or from a deleted branch, unticked by default) as another group; a status bar item that appears only when the check finds something (needs a cheap background check after fetch, without the size). Later, opt-in only: `git maintenance start`, `git fsck`, `git lfs prune`. Not wanted: a one-click boost without review, a health score, reflog expiry or `gc --prune=now`, bulk remote branch deletion, automatic cleanup. Open: whether gone branches with unmerged commits start ticked (they do now) and whether to detect squash merges.
- Commit options follow-ups: author and date overrides, `--reset-author` for amend, trailers such as Co-authored-by, a "Verified" signature badge in History, a hint when an undone WIP commit was already pushed. Not wanted: `--no-post-rewrite`.
- Conflict follow-ups: stash-pop conflict banner, ours/theirs labels (swapped in a rebase), modify/delete conflicts, Pull and Rebase conflicts in the same flow. Skip for rebase, cherry-pick and revert (prototyped and removed; revisit with a confirm naming the dropped commit) and safeguards only if users report lost work.
- Output log: a stream of what Oak ran (every git command and result, background fetches, errors), like VS Code's Output, replacing the single last-output dialog. Design first: what an entry is, how many to keep, persistence, filters.
- Pull requests: host to provider mapping for self-hosted remotes, forks, target branch selection, a lightweight local review (fetch the refs, open the comparison; comments stay on the provider).
- `oak://open?remote=…&ref=<sha>&path=…&line=N` links: "Copy Oak link" on a diff or blame line; opening one matches recent repositories (offer clone or fetch with a confirm) and lands in Blame at the line. Registered by the installer, handled beside `second-instance` (argv on Windows and Linux, `open-url` on macOS). Links are untrusted input. A website redirect page only with approval.
- Built-in terminal panel in the repository or worktree folder, beside `openTerminal`. Needs a pty decision (`node-pty` is native and complicates packaging), shells, and a layout without shift; optional.
- More status bar items, only with a concrete benefit and never duplicating what is on screen (a working-tree summary in expanded Code repeats the Changes badge).
- Menu-wide type-ahead across submenus; the palette covers it for now.

**Search**

- Full text search (wanted by the maintainer): search file contents from the History All files tree (at that commit) and the Changes list (changed files only), with match case, whole word and regular expression toggles; binary files skipped. Approach: `git grep -I -n --column -z` with `-i`, `-w`, `-F` or `-P`, streamed through a `STREAMING` handler, the previous run killed on each keystroke (short debounce), results capped. A commit scope runs `git grep <sha>`; Changes passes its changed paths as a pathspec (`--untracked` for new files). Results filter the tree to matching files with counts, and Enter opens the file with find on the match. The same toggles come to find in diffs and Blame through `src/shared/find.ts`, so both use one matcher. Later scopes in the same panel: commit messages (`git log --grep`) and changed text (`git log -S` or `-G`). Measure with a large repo; consider bundling ripgrep only if `git grep` is measurably too slow on the working tree.
- Browse the repository at the working tree or a commit, including unchanged files, with filename search (History "All files" covers commits; no working-tree browser).

**Diff and files**

- More previewers instead of "binary file differs": PNG and other images, PDF, other safe formats. One file under `preview/` plus a line in `previewers.ts`; never run scripts. SVG follow-ups: zoom and pan (`react-zoom-pan-pinch`), swipe and onion-skin comparison, fit and actual size, a minimum size for tiny icons, a persisted default mode (Preview or Diff).
- "Blame this line" from the diff line menu (deleted lines blame the old side at the parent; History diffs blame as of that commit).
- Commit details for a line while reading, without opening Blame; try a hover or key-triggered popover first (always-on annotation risks the GitLens distraction).
- Whole-file syntax tokenizing (a hunk starting mid-construct can be mis-coloured).
- "Open" and "Show in folder" for historical revisions (read-only temporary copy); never execute automatically, confirm for executable and script types.
- User-installable file icon packs: folders under the app data `icon-packs` folder with a `pack.json` and SVGs; "Import icon pack…" validates and extracts a zip. Needs SVG sanitising (`<img>` only), zip-slip and size limits, and a decision on depending on `material-icon-theme` instead of vendoring. A Seti-based monochrome pack if Simple feels too generic.
- Mouse alternatives for the layout toggle, if testing shows a need.
- Neighbour diff prefetch if History stepping feels slow; a state library such as Zustand only if needed.

**Interface and keyboard**

- Rebindable command shortcuts with conflict detection and reset (widget keys stay fixed); optional saved wrap-around for branch and history search.
- Branch hiding in pickers and the palette, and a keep-visible list for remote branches, only if needed.
- More themes (GitHub, Nord), a theme editor, and a high contrast light and dark pair for people not using a Windows contrast theme (must pass `tests/diff-contrast.test.ts` and pair with the diff colours preference).
- More preferences (default clone folder, external tools, fonts).
- A Simple and Advanced mode, panes registering their own search, a CI collision test over the command registry, only for a concrete workflow.

**Platform**

- Installers and testing for macOS and more Linux distributions.
