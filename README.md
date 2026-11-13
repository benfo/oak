# Oak

A keyboard-friendly Git client for everyday Git with fewer distractions. Oak runs your installed Git, so your hooks, credentials, configuration and Git LFS work the way they do on the command line.

Windows 11 is the primary platform. Linux is experimental and macOS has not been tested. Features, screenshots and shortcuts are on the website: [www.benfourie.com/oak](https://www.benfourie.com/oak/).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="website/public/oak-comparison-dark.png">
  <img src="website/public/oak-comparison.png" alt="Oak comparing a feature branch against main, with the changed file's diff open">
</picture>

## Highlights

- A command palette (Ctrl+Shift+P) for branch, stash, diff, history and preference actions.
- Stage by file, hunk or single line.
- Compare a branch with its target without checking it out.
- File history, Blame and find in diffs.
- Navigate everything by keyboard, with optional h/j/k/l keys. Press Ctrl+/ in the app for every shortcut.

## Download

Get the Windows installer or the Linux x64 packages (Debian and AppImage) from [the latest release](https://github.com/benfo/oak/releases/latest). There are no macOS downloads yet.

- **Windows:** requires Git on your PATH. The installer is not code-signed yet, so Windows may block it. Right-click the file, choose Properties and tick Unblock, or run `Unblock-File .\Oak-Setup-<version>.exe` in PowerShell. In SmartScreen, choose More info, then Run anyway.
- **Ubuntu:** `sudo apt install ./Oak-<version>-linux-amd64.deb`. This also installs Git and the desktop dependencies.
- **AppImage:** install Git, mark the file as executable and open it.

## Contributing

Issues and pull requests are welcome, and the maintainer reviews every change. Setup, checks and the branch workflow are in [CONTRIBUTING.md](CONTRIBUTING.md), conventions for people and coding agents in [AGENTS.md](AGENTS.md), and planned work in [ROADMAP.md](ROADMAP.md).

## License

Oak is licensed under the [MIT License](LICENSE). Third-party material, such as the Colour file icons, is listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
