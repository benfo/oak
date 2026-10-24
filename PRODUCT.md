# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Developers who want everyday Git (stage, commit, branch, history, merge) done simply and dependably, keyboard-first, without a heavy IDE. Windows 11 is the primary platform; Linux is experimental; macOS is untested.

## Product Purpose
Oak is a desktop Git GUI (Electron, React, TypeScript). Success is people finishing common Git tasks easily, not the number of controls.

## Positioning
Oak runs the user's installed git CLI, so hooks, credentials, config and LFS behave like the terminal. It has one consistent keyboard model and explicit line-level diff selection.

## Operating Context
Long-lived desktop sessions with large repositories: virtualized commit graph, history and diff; themes are a light or dark base plus token overrides.

## Capabilities and Constraints
- Layout, behaviour, keyboard model, focus system and "no layout shift" rule are kept as they are.
- All styling goes through `src/renderer/src/tokens.css` (enforced by `npm run lint`).
- Interactive controls use React Aria Components themed via `data-*` attributes; the graph and diff are custom.
- Redesign scope for the current spike: app UI only (not the website).

## Brand Commitments
Name is Oak; icon source is `build/icon.svg`. Visual direction so far: flat, original, uncluttered. Docs must be honest about platform support.

## Evidence on Hand
Real app plus synthetic screenshots for the website. No testimonials or usage data exist; do not invent any.

## Product Principles
- Everyday Git, done simply and dependably. Judge changes by reduced confusion, fewer unnecessary steps and real use, not by the number of controls.
- Consistency and user joy are product goals alongside correctness.
- The same action behaves the same everywhere (keyboard, mouse, selection, focus, feedback). Navigation preferences add alternatives, never different semantics.
- Frequent actions are quick and visible; occasional ones are contextual. Fetch, Pull and Push stay on the toolbar. Add permanent UI or commands only for a concrete workflow benefit.
- Preserve position and selection, make state visible, and nothing moves under the mouse.
