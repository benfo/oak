# Oak

A modern Git GUI. Electron + React 19 + TypeScript (electron-vite). It runs the user's installed `git` CLI, never a Git library, so hooks, credentials, config and LFS behave like the command line. Windows 11 is the primary platform; Linux is experimental; macOS is untested.

At the start of every session, before any other work, read `AGENTS.local.md` at the repo root if it exists. It is a gitignored, per-clone file holding the maintainer's personal workflow rules, such as stopping for manual testing and commit style, and they apply to all work.

## Goals

Who Oak is for and its product principles live in [PRODUCT.md](PRODUCT.md); the visual system is in [DESIGN.md](DESIGN.md). In short: everyday Git done simply and dependably, the same action behaving the same everywhere, frequent actions quick and visible (Fetch/Pull/Push stay on the toolbar), and no new permanent UI or commands without a concrete workflow benefit. Be honest in docs about platform support.

## Commands

- `npm run dev` (hot reload; restart for main-process changes), `npm run build`, `npm run typecheck`, `npm run lint`, `npm run format` (Prettier; `format:check` in CI), `npm test`. Run typecheck, lint, format and tests before proposing a change.
- `npm test` runs `tests/**/*.test.ts` directly with the Node runner, against real git in a temp repo. Modules tested by Node import siblings with `.ts` extensions.
- `npm run test:ui` builds, then drives the real Electron app with Playwright (`tests-ui/`, serial, real git temp repos, real keystrokes). Not part of `npm test` and not in CI yet. Run it after changing views, diff or keyboard code.
- **UI test practice:** each test launches a fresh Electron app (about 2 s) and runs serially, so the suite takes about a minute. While developing, run only what you touched (`npm run test:ui -- -g "name"`) and keep the full run and `--repeat-each` for the end. Runs stop at the first failure and assertions time out at 5 s (`playwright.config.ts`; CI reports every failure). Wait for a view switch to settle (the destination's focus) before the next shortcut, scope locators when a second control has the same label, and for a bug fix confirm the test fails without the fix.
- `npm run dist` builds the Windows installer, `npm run dist:linux` the Linux packages, `npm run icon` re-renders `build/icon.png` from `build/icon.svg`. Releases are the maintainer's job (`docs/releasing.md`): do not run `npm run release`, push `vX.Y.Z` tags or trigger website publication.
- `npm run site:dev|check|build` work on `website/` (Astro, Tailwind, daisyUI; install with `npm ci --prefix website`). Use factual copy and synthetic screenshots only; no sales language or unsupported superiority claims. Section backgrounds alternate strictly, so adding or removing a section means re-flipping the ones after it.
- **Branches:** never commit to `main`. Create a branch from an up-to-date `main` before the first commit, named `feature/`, `fix/`, `docs/`, `chore/` or `website/` plus a short slug. Changes land by pull request (squash merge only); do not push, merge or tag unless asked. Details in `CONTRIBUTING.md`. Docs that belong to a change go in its branch; `docs/` is only for standalone documentation.
- Dev helper (after `npm run build`): env vars `OAK_SCREENSHOT=<png>`, `OAK_SCREENSHOT_DELAY`, `OAK_SCREENSHOT_KEYS` (real keystrokes and clicks), `OAK_SCREENSHOT_JS` are handled in `src/main/index.ts`. Verify UI behaviour by driving the app, not by guessing.

## Architecture

- `src/main/git.ts` spawns git (`outputSink` streams long-op output). `handlers.ts` holds every git operation; its `Handlers` type is the IPC contract. `index.ts` registers IPC (`git:<name>`; `STREAMING` ops stream output), native menus, the file watcher and the dev helper.
- `src/preload/index.ts` exposes `window.bridge`. Renderer calls go through the typed proxy `api.<handler>()` in `src/renderer/src/api.ts`.
- `useRepo.ts` is repo state; `withBusy`/`run` wrap operations (busy label, live output, refresh). Refreshes set only state that changed (JSON compare) so selections stay stable. `actions.ts` has shared git flows with confirmations.
- `commands.ts` + `components/RepoView.tsx` are the command registry, shortcuts and palette pickers. `settings.ts` holds preferences (`useSettings`/`updateSettings`). `lib/` has `navigation.ts`, `keymap.ts`, `shortcuts.ts` and other code shared across features.
- **Layout:** code that changes together lives together. Feature folders under `src/renderer/src/` (`diff/`, `history/`, `changes/`, `sidebar/`, `blame/`) hold a feature's components, hooks and helpers (for example `diff/diff.ts`, `history/graph.ts`). Shared UI stays in `components/`, shared logic in `lib/`. Split a file when it does more than one thing; `npm run lint` warns (ESLint `max-lines`, 300) as a prompt to look, not a rule to game.
- **Find in file** is shared: `shared/find.ts` (matching, `:N`), `lib/useFindInFile.ts` (state, stepping, status) and `components/FindBar.tsx` (the bar). The Blame view uses it today; other code views should reuse it, not copy it.
- Long lists (graph, History files, diff) window their rows with `@tanstack/react-virtual` through `lib/useVirtualRows.ts`.
- The commit graph and diff are custom (virtualized). Everything else interactive uses React Aria Components, themed through `data-*` state attributes.
- Syntax highlighting is Shiki in a Web Worker; colours are `--syntax-*` tokens, so themes restyle code without re-highlighting.
- Menus must not wait on git: slow data (for example the remote default branch for comparisons) is cached and refreshed in the background.
- Keep `ROADMAP.md` current when work ships or ideas are agreed.

## Design rules

- **No layout shift.** Transient UI (status, progress, selection bars, hints) uses reserved space or overlays and never moves content under the mouse. Delay progress UI about 300 ms. Keep button widths stable while busy.
- **Tokens only.** No raw colours, spacing, radii, font sizes or control heights in CSS or components. Use `src/renderer/src/tokens.css` (spacing in 4px steps `--space-*`, `--radius-*`, `--text-*`, `--control-*`, `--row-*`, semantic colours that pair surfaces with `-foreground`). Add a token deliberately if none fits. `npm run lint` enforces it. Themes are a base (light or dark) plus token overrides.
- **One focus system** (`styles.css`, "focus indicators"): controls and text fields get a 2px `--focus-ring` outline; panes sit inside `.pane-frame`, which draws the ring only when focus arrived by keyboard (`lib/focusRing.ts`); rows show focus with a tint and accent bar, never a ring hugging text. New scrolling panes go inside a `.pane-frame`.
- **Rows:** every list row uses `--row-pad` on both sides; nesting adds `--indent`. Keep `ROW_H` constants in sync with `--row-md`.
- Disabled buttons look inert and visible text explains why (they cannot show tooltips). Ctrl+A is scoped to the focused pane.
- **Menus:** large lists you pick from are searchable pickers anchored to their toolbar button; small action menus and right-click menus are React Aria menus (`showMenu`, `ContextMenu.tsx`), opened at the pointer for a right-click and under the focused row from the keyboard. Never open one at a stray pointer. Keep submenus to one level.
- **Pickers preview live:** moving onto a choice (theme) previews it, Enter keeps it, Escape reverts; theme pickers never dim the app.
- **Dialogs are keyboard-first:** initial focus lands on something arrow keys can drive. A dialog that opens another must close synchronously (`flushSync`) and refocus its opener first.
- **Explicit diff selection:** a click selects exactly the displayed line; Ctrl-click or Space toggles it. Never infer replacement pairs or moved-line partners, and never let alignment or word highlighting expand a selection. Partial operations keep line order and leave unselected changes untouched.
- **Reuse before building.** Do not copy a feature into a second view. Put view-independent logic in `src/shared` as pure, unit-tested helpers and view-independent UI in a shared component plus hook, and let each view supply only its text, line model and cursor. Check whether another view has or will need the behaviour first, and reconcile with existing conventions (for example the search handling under Keyboard model) instead of building a parallel one. Split a file that passes the 300-line `max-lines` warning into hooks and components as you go.
- **Colour and contrast.** Syntax highlighting sets an inline colour on each token, which beats any stylesheet colour, so never pair a solid fill with a contrasting text colour over code. Mark matches and selections with translucent tint tokens (defined for both themes) and a ring, and check the result in light and dark.
- **Show the user's unit.** Counts and labels say what a person sees: find counts occurrences, not lines. A hint or tooltip for a key that does nothing in the current state reads as a bug, so say why in reserved space (never a corner toast for something about the line under the cursor).
- **Reloads keep the screen.** Changing a setting that reloads the same file keeps the old rows until the new ones arrive; show the loading state only when the file or revision changes. After a step that changes the content, put the cursor row back where it sat in the pane.
- **Mouse matches keyboard.** Every widget key gets a visible button (with its key in the tooltip), and every button action is reachable by key.
- **Immediate, accurate feedback:** refresh the working diff after content changes even when status codes are identical. Never leave a successful operation looking like nothing happened.

## Keyboard model

- **Key ownership:** text fields own text editing; the focused widget owns moving and selecting inside itself; commands (anything changing the app, repo or layout) belong to the shortcut dispatcher, which only sees keys no widget consumed.
- **Widget keys are data** in `lib/keymap.ts` (`WIDGET_KEYMAP`: action to keys per role `list`/`graph`/`diff`/`blame`, with optional `help` shown in the shortcuts dialog). Components call `widgetAction(...)` or the `lib/navigation.ts` helpers and supply only what each action does. Never test `ctrlKey`/`altKey`/`key` combinations in a component. A new widget key needs a `WIDGET_KEYMAP` entry and a test in `tests/shortcuts-keymap.test.ts`.
- **Shortcuts are bindings:** `lib/shortcuts.ts` is the only dispatcher (`useShortcutRoot` in `App.tsx`). Register through `useShortcutScope` and `commandBinding`; overlays call `useShortcutOverlay`. Never add `window` keydown listeners. A disabled binding keeps its key and shows its `disabledReason` as a toast. Global commands live in `RepoView.buildCommands`; Ctrl+/ shows the searchable cheat sheet.
- **Shared policy:** common key meanings, modifier and IME guards, pane cycling and search handling live in `lib/navigation.ts`, adapted for React by `lib/useNavigation.ts` (capture phase, so it runs before React Aria). Use `handleNavigation(event, { activate, deeper, back, dismiss, discard, menu })`; omit callbacks that do not apply. New areas choose a role (collection, persistent find, choice picker, native form) and reuse its handler; never apply list Vim aliases inside forms or dialogs.
- **Panes:** Changes, History and the sidebar use `lib/usePane.ts` and `components/Pane.tsx` (`PaneFrame`, `PaneSearch`). Tools and forms declare `data-pane-owner`; persistent search uses `data-search-pane`.
- **Search is explicit:** `/` or Ctrl+F searches the focused list; plain typing never starts search or jumps. Persistent search fields keep focus while Enter/Shift+Enter find next/previous, Escape returns to the owning list keeping the query, and they are not Tab stops. Choice pickers use Enter to accept and Escape to cancel; file pickers select the found row and never stage or open the diff.
- **Focus after a button press:** a press from the keyboard leaves focus on the button so Enter can repeat (Previous match, Next block); only a mouse or touch press (`pointerType`) hands focus back to the field or code. Ignore auto-repeat (`event.repeat`) on keys that step through history so a held key cannot skip versions.
- **Escape in new views dismisses only:** it closes the topmost transient layer (menu, popover, find bar, selection) and never leaves the view or ends a mode, so a second press cannot lose the user's place. Leaving is an explicit button, a view shortcut or a palette command. The Blame view works this way; the Escape-goes-back behaviour described below predates this rule and is unchanged for existing panes.
- **Tab and F6:** Tab uses native/React Aria traversal (one stop per collection; fixed pane tools are stops in DOM order; per-item buttons and search fields are not). F6/Shift+F6 are the only pane jumps. Escape on a pane tool returns to its owning pane.
- **Lists:** arrows, Home, End, PgUp, PgDn move; Space selects, Enter acts (stage, unstage, open); Delete discards; Shift+F10 or the Menu key opens the context menu; Right goes deeper (graph, commit files, diff) and Left or Escape goes back. Moving between panes preserves selection.
- **Diff:** line cursor; Shift+arrows, Space and Ctrl+A select lines; Enter stage/unstage; Delete discard; N/P hunks; Shift+Left/Right scroll horizontally without changing focus, cursor or selection; Escape clears line selection before backing out. Ctrl+Shift+D toggles Inline and Side by side through `changeDiffLayout.ts`, the only entry point for explicit layout changes (it preserves the visible code anchor, focus and selection).
- **Vim navigation** is optional (off by default): plain h/j/k/l, Ctrl+D/U, gg/G in lists and diffs through `useNavigation`. Menus keep only h/j/k/l. No editing modes.
- **History All files** is a tree: arrows move, expand and collapse only; Enter opens a file.
- **Layouts:** F11 and the toolbar button expand the code area; the toolbar Sidebar toggle hides the sidebar (`sidebarHidden`, persisted). The only expanded layout is Code. Escape restores it only when no widget has anything to undo (a dispatcher fallback, never pre-empting a widget). Hidden panes stay mounted but inert and are skipped by F6/Tab. No docking, saved layouts or automatic collapsing.
- **Splits:** `Split.tsx` wraps `react-resizable-panels`; keep pixel-size preservation, the `split:<id>` localStorage keys and a descriptive `label` per split. Shift+Alt+arrows move the nearest divider (`lib/paneResize.ts`). Dividers stay out of Tab order.

## React Aria lessons

- Extra keys (Right, Delete, Shift+F10) go in a capture-phase handler on a wrapper so they run before React Aria.
- Items have no `onFocus`; listen on a wrapper and read `[role=row]`'s `data-key`.
- Pass React Aria's `Selection` object back unchanged (it carries the Shift+click anchor); build your own with the same class (`anchored()` in `ChangesView`). Cached item elements need `dependencies` or a ref for changing state, or handlers go stale.
- Virtualized rows sit in sized wrappers: make `[role=row]` and its gridcell `height: 100%` and put spacing inside the row.
- RAC `Button` drops `title`; use a native `<button>` or the shared `Tip` where a tooltip matters.
- Big collections: the sidebar Tree rebuilds its collection on every render, so leave collapsed sections' children out (handle Right/Left yourself), cache row elements per data object, memoize the whole `<Tree>` element, and drive cheap visuals from context. Palettes use a virtualized `ListBox`, lowercase text once per picker, and `useDeferredValue(query)`.
