# Releasing (maintainer)

Releases and the website are published by GitHub Actions in this repository using the built-in `GITHUB_TOKEN`. No personal token is needed.

1. Bump `version` in `package.json` and the lockfile, and add notes to `src/shared/releases.json` and a matching section to `CHANGELOG.md`. Older entries can stay for users who skip a release, but trim them once those versions are no longer worth explaining.
2. Run `npm run typecheck`, `npm run lint` and `npm test`.
3. Commit and push to `main`.
4. Create and push the matching `vX.Y.Z` tag. The **Release packages** workflow builds Windows and Linux packages on native runners, smoke-tests the Debian package, verifies the updater checksums and publishes the release.
5. After the packages are public, update `website/src/data/release.json` so the website download links match.

Notes:

- Do not create tags only to test packaging. Run **Release packages** manually with `publish_linux` off to build downloadable test artifacts without publishing.
- A failed publication leaves the release in draft. Rerun the workflow after fixing the failure. A published version cannot be reused.
- Pushes to `main` that touch `website/` deploy the site to `gh-pages`. Keep unfinished website work on a branch.
- `npm run release` publishes already-built artifacts from `dist/` using `GH_TOKEN` or `gh auth token`. It does not build them.
