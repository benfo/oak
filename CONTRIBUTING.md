# Contributing to Oak

Thanks for helping. Oak is maintained by one person, who reviews and approves every change.

## Before you start

- For anything larger than a small fix, open an issue first so we can agree on the approach. Oak aims to stay focused on everyday Git, so not every feature fits.
- Small bug fixes and documentation corrections can go straight to a pull request.

## License

Oak is licensed under the [MIT License](LICENSE). By submitting a pull request you agree that your contribution is licensed under the same terms. There is no CLA to sign.

## Setup

Requires Node.js 24 and Git.

```sh
npm ci
npm run dev
```

Main-process changes need a restart of `npm run dev`.

## Checks

Run these before opening a pull request. CI runs the same checks on Windows and Ubuntu.

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
```

`npm run lint` enforces design tokens: CSS must use the values in `src/renderer/src/tokens.css` rather than raw colours, spacing or sizes. Tests use a real `git` in a temporary repository.

## Branches and pull requests

- Never commit to `main`. Branch from an up-to-date `main`, named with a type prefix and a short slug: `feature/`, `fix/`, `docs/`, `chore/` or `website/`, for example `fix/graph-scroll`.
- There are no release or `develop` branches. A fix for a released bug is a normal `fix/` branch, released as the next version. If a branch depends on another unmerged branch, stack it on that branch and say so in the pull request.
- Every change goes through a pull request. Pull requests are squash-merged, so the title becomes the one-line commit on `main`, and the branch is deleted after the merge.
- Documentation that belongs to a change (for example `ROADMAP.md`) goes in that change's branch. Use `docs/` only for documentation on its own.
- Pushes to `main` that touch `website/` deploy the site, so website work always goes through a `website/` branch.

## Guidelines

- Read [AGENTS.md](AGENTS.md). It describes the architecture, the design rules (no layout shift, one focus system, tokens only) and the keyboard model. It applies to people and coding agents alike.
- Keep pull requests small and focused on one change. Describe what you changed and how you tested it.
- Add or update tests for behaviour you change.
- Oak runs the installed `git` CLI and never a Git library. Keep it that way.
- Keep commit messages to a clear one-line summary.
- Releases, tags and website deployments are done by the maintainer, so please do not include version bumps or release notes unless asked.
- Windows is the primary platform. Say which platform you tested on.

## Reporting bugs and ideas

Use the issue templates. For security problems, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Conduct

Be respectful. See the [Code of Conduct](CODE_OF_CONDUCT.md).
