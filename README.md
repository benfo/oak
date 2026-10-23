# Oak

A keyboard-friendly Git GUI built with Electron, React and TypeScript. Oak runs your installed Git CLI, so your hooks, credentials, configuration and Git LFS work the way they do on the command line.

Windows 11 is the primary platform. Linux is experimental and macOS has not been tested.

## Features

- Review and stage changes by file, hunk or single line. A click selects exactly the line shown, and Oak never guesses at replacement pairs.
- Inline or side-by-side diffs with syntax colours, word-level highlighting and adjustable context.
- Compare a branch with a target without checking it out, or review the branch at an earlier commit.
- History scope: only the current branch's own commits, its full ancestry, or the branch plus a target.
- Changed files as a list or a folder tree (press V in a file list or the diff).
- Conflicts: Oak switches to Changes, shows a banner and opens your Git merge tool. Marking a file resolved warns if conflict markers remain.
- Command palette (Ctrl+Shift+P) for branch, stash, diff, history and preference commands, with shortcuts shown.
- Full keyboard navigation, with optional h/j/k/l keys.
- Themes with live preview, including custom theme files.

## Download

Get the Windows installer or the experimental Linux x64 packages from [the latest release](https://github.com/benfo/oak/releases/latest). Linux has a Debian package, which is smoke-tested on Ubuntu 24.04, and an AppImage. There are no macOS downloads yet.

- **Windows:** requires Git on your PATH.
- **Ubuntu:** `sudo apt install ./Oak-<version>-linux-amd64.deb`. This also installs Git and the desktop dependencies.
- **AppImage:** install Git, mark the file as executable and open it.

## Keyboard

Press **Ctrl+/** for the searchable list of shortcuts.

- **Ctrl+Shift+P** opens the command palette.
- **/** or **Ctrl+F** searches the focused list. In the branch and history search fields, Enter and Shift+Enter jump to the next and previous match, and Escape returns to the list.
- **F6** and **Shift+F6** switch panes. Tab moves through the controls inside a pane.
- In lists, the arrow keys move, **Space** selects, **Enter** acts (stage, unstage or open) and **Delete** discards.
- In a diff, **N** and **P** jump between hunks, **Shift+Left/Right** scrolls long lines and **Ctrl+Shift+D** switches between inline and side by side.
- **F11** expands the focused history graph or code area. Press it again to restore the layout.
- Optional Vim-style navigation (Preferences > General) adds h/j/k/l alongside the arrow keys. It also works in menus.

## Good to know

- Fetch, Pull and Push stay on the toolbar. **More actions** holds Refresh, Open terminal here and Open in Explorer.
- **Open pull request** in a local branch's menu, or in the command palette, opens the host's new-pull-request page for the branch. GitHub, GitLab, Bitbucket and Azure DevOps remotes are recognised, and the branch must be pushed.
- If you commit with nothing staged, Oak asks whether to stage the changed files first. New files are included only if you tick **Include new files**.

## Development

Requires Node.js 24+, npm and Git on your PATH.

```sh
npm ci
npm run dev
```

Changes to the main process need a restart. To open a specific repository after building:

```sh
npm run build
npx electron . "path/to/repository"
```

Before opening a pull request, run:

```sh
npm run typecheck
npm run lint
npm test
```

Tests use real Git in temporary repositories. `npm run dist` writes the Windows installer to `dist/`, and `dist/win-unpacked/Oak.exe` runs without installing. On Linux, `npm run dist:linux` builds the AppImage and Debian packages, and `xvfb-run -a npm run test:linux-package` checks the installed Debian package.

Brand artwork lives in `build/`: `icon.svg` is the app symbol and `brand/oak-logo.svg` is the full logo. `npm run icon` renders the installer icon and syncs the website icon.

[AGENTS.md](AGENTS.md) is the shared instruction file for coding agents. [ROADMAP.md](ROADMAP.md) records decisions and planned work.

## Website and releases

`website/` contains the Astro site and `src/` contains the app. GitHub Actions run the checks, publish the site and build releases.

```sh
npm ci --prefix website
npm run site:dev
npm run site:check
npm run site:build
```

The preview is at `http://127.0.0.1:4321/oak/` and the public site is [www.benfourie.com/oak](https://www.benfourie.com/oak/). The site uses Tailwind CSS and daisyUI, with a layout adapted from the MIT-licensed Landwind template. Its license is in `website/public/third-party-notices.txt`.

- **App checks:** pushes to `main` and pull requests run typecheck, lint, tests and a production build on Windows and Ubuntu.
- **Website:** changes under `website/` on `main` publish `website/dist/` to the `gh-pages` branch. Pull requests build without publishing.
- **Releases:** pushing a matching `vX.Y.Z` tag builds and publishes the Windows and Linux packages. See [docs/releasing.md](docs/releasing.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and pull requests are welcome, and the maintainer reviews every change.

## License

Oak is licensed under the [MIT License](LICENSE).
