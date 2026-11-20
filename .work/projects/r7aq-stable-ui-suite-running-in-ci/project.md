---
id: r7aq
kind: project
state: open
touches: [code, release]
created: 2026-11-20
updated: 2026-11-20
---
# Stable UI suite running in CI

## Goal
npm run test:ui passes reliably and runs in checks.yml.

## Acceptance
Three full test:ui runs in a row pass locally, and the CI job is green on a PR.

## Notes
Last full run 2026-11-13 on Electron 45: 145 passed, 2 failed. many-refs and squash-fixup each failed once in a full run and passed alone.
