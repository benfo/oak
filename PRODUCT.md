# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers who want everyday Git (stage, commit, branch, history, merge) done simply and dependably, keyboard-first, without a heavy IDE. Windows 11 is primary; Linux is experimental; macOS is untested.

## Product Purpose

Oak is a desktop Git GUI (Electron, React, TypeScript). Success is people finishing common Git tasks easily, not the number of controls.

## Positioning

Oak runs the user's installed git CLI, so hooks, credentials, config and LFS behave like the terminal. It has one consistent keyboard model and explicit line-level diff selection.

## Operating Context

Long-lived desktop sessions with large repositories: virtualized commit graph, history and diff.

## Capabilities and Constraints

Layout, keyboard model, focus system, tokens and the no-layout-shift rule are fixed; they are specified in `AGENTS.md` and `DESIGN.md`.

## Brand Commitments

Name is Oak; icon source is `build/icon.svg`. Flat, original, uncluttered. Docs are honest about platform support.

## Evidence on Hand

The real app and synthetic screenshots for the website. No testimonials or usage data exist; do not invent any.

## Product Principles

- Judge changes by reduced confusion, fewer steps and real use. Consistency and user joy are goals alongside correctness.
- The same action behaves the same everywhere (keyboard, mouse, selection, focus, feedback). Navigation preferences add alternatives, never different semantics.
- Frequent actions are quick and visible; occasional ones are contextual. Fetch, Pull and Push stay on the toolbar. Permanent UI or commands only for a concrete workflow benefit.
- Preserve position and selection, make state visible, and nothing moves under the mouse.
