---
id: "4223"
kind: project
state: open
touches: [release]
created: 2026-11-20
updated: 2026-11-20
---
# Signed Windows installer

## Goal
Windows marks downloads with Mark of the Web, so users must Unblock the installer. Sign it, only in the release workflow.

## Acceptance
A downloaded installer runs without Unblock or a SmartScreen block, and each release lists its checksums.
