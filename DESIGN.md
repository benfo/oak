---
name: Oak
description: A desktop Git GUI drawn as a transit diagram of your repository, on warm paper with ink type and bold line colours.
colors:
  paper-chrome: "#edeae3"
  paper-surface: "#fbfaf6"
  paper-sunken: "#e4e0d6"
  ink: "#141414"
  ink-muted: "#47443e"
  ink-subtle: "#57524b"
  rule: "#d9d5ca"
  rule-strong: "#bdb8ab"
  primary: "#0039a6"
  primary-foreground: "#ffffff"
  danger: "#d9261f"
  warning: "#724c00"
  diff-add-foreground: "#17692d"
  diff-del-foreground: "#b81d28"
  lane-0: "#0039a6"
  lane-1: "#ee352e"
  lane-2: "#00933c"
  lane-3: "#f2b705"
  lane-4: "#b933ad"
  lane-5: "#00a1de"
  lane-6: "#ff6319"
  lane-7: "#8a5a2b"
  dark-chrome: "#131416"
  dark-surface: "#1a1b1e"
  dark-sunken: "#101113"
  dark-ink: "#f0eee8"
  dark-ink-muted: "#d2cfc7"
  dark-rule: "#2c2d30"
  dark-rule-strong: "#3d3e42"
  dark-primary: "#5b8dff"
  dark-lane-1: "#ff5a52"
  dark-lane-2: "#2fbf6a"
  dark-lane-3: "#ffc928"
  dark-lane-4: "#d95fcd"
  dark-lane-5: "#35bff0"
  dark-lane-6: "#ff8346"
  dark-lane-7: "#c28a54"
typography:
  body:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    letterSpacing: "normal"
  label:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    letterSpacing: "normal"
  caption:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "normal"
  title:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    letterSpacing: "normal"
  display:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    letterSpacing: "normal"
  code:
    fontFamily: "'Cascadia Code', 'Cascadia Mono', 'JetBrains Mono', Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "20px"
rounded:
  xs: "0px"
  sm: "0px"
  md: "2px"
  lg: "4px"
  xl: "8px"
  full: "9999px"
spacing:
  0-5: "2px"
  1: "4px"
  1-5: "6px"
  2: "8px"
  2-5: "10px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
  10: "40px"
components:
  button-default:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "28px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "28px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "28px"
  input:
    backgroundColor: "{colors.paper-sunken}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "28px"
  menu-popover:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "4px"
  menu-item:
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
---

# Design System: Oak

## Overview

**Creative North Star: "The Transit Map"**

Oak draws a repository the way a city draws its network: branches are coloured lines, commits are stations, merges are interchanges. The rest of the app speaks the same signage language: warm paper ground, black ink type, 2px corners and saturated line colours.

The shell is an operate-mode tool and stays quiet: toolbar on top, branch sidebar left, History and Changes in the main area, diff below. Density is desktop-dense (13px body, 28px controls and rows). Colour is rationed: neutrals carry the chrome, and the eight line colours live mainly in the commit graph, where they carry meaning. The platform font (Segoe UI) is kept deliberately; colour, corner and line carry the identity.

Only the Light and Dark themes use these values. The other built-in themes (One Dark, Dracula, SynthWave '84, Solarized Light) keep their own palettes behind the same token names, so every rule here is about tokens, not hex values.

## Colors

Warm neutrals do the structural work, one transit blue is the interface accent, and the eight lane colours are the signage. Values are in the front matter.

- **Line Blue** (primary): main actions, links, selection tints, the focus ring and the active-row bar. It is also lane 0, so the accent and the first line match.
- **Lanes 1 to 7** (red, green, yellow, purple, cyan, orange, brown): the remaining graph lines, cycled by lane index modulo 8 and lifted in Dark for contrast. Red and orange also form the brand mark gradient.
- **Neutrals:** chrome (window and sidebar), surface (panels and overlays; Dark overlays mix 6% toward white), sunken (inputs, headers, wells), ink with muted and subtle steps for secondary text and hints, rule and rule-strong for dividers and control borders.
- **Semantic:** danger, warning, diff and syntax colours are separate tokens with Light and Dark values, not part of the line palette. The destructive colour is `danger`, not lane red.

**The Lines Are Signage Rule.** Lane colours mean "this line". Never use them as chrome decoration, and never fall back to a neutral grey panel with a lone blue accent: warm paper and line colours are the identity.

## Typography

One stack for everything (Segoe UI Variable Text, Segoe UI, system-ui) and Cascadia Code, Cascadia Mono, JetBrains Mono, Consolas for code. Hierarchy comes from weight and ink tone, not size jumps.

- **Display** (700, 26px): welcome screen only.
- **Title** (600, 15px): dialog and panel headings.
- **Body** (400, 13px): interface text.
- **Label** (500, 12px): controls and metadata.
- **Caption** (400, 11px): badges, pills, line numbers, hints.
- **Code** (12px, 20px line height): diffs and hashes.

Sizes come from the five `--text-*` steps and weights from the four `--weight-*` steps.

## Layout

A 44px title bar, toolbar, branch sidebar, History and Changes, diff below, all resizable. Spacing is a 4px scale. Controls are 20, 24, 28 or 32px tall (28px default); rows are 28px, or 32px for roomy lists. Rows keep 10px inner padding on both sides and nesting adds one indent per level.

**The Nothing Moves Rule.** Hover, focus and selection use colour, tone, outline or inset bars only, never size, margin or position.

## Elevation and Shapes

Flat by default: surfaces separate by tone and 1px borders. One shadow token lifts floating layers only (menus, popovers, dialogs, palette, toasts, the zoom bubble); panels, rows and buttons never carry it. Modal scrims are 35% black (25% soft). Active rows use 2px to 3px inset bars in primary.

One radius knob (2px) drives every size: controls and rows 2px, menus, popovers and pills 4px, the largest containers 8px, small steps square, avatars full. A theme may change the knob; components never set a literal radius.

## Components

- **Buttons:** 28px tall, 12px side padding, 1px border, 6px icon gap. Default is surface with a strong-rule border and `--hover` tint; primary is Line Blue with white text (ink in Dark), danger the same in danger, both brightening 8% on hover. Icon buttons are 24px, transparent, muted ink. Disabled uses 0.45 opacity.
- **Inputs:** sunken fill, strong-rule border, 28px tall, 10px side padding; errors show a line beneath in danger.
- **Focus:** one system, a 2px `--focus-ring` outline with a 2px offset on keyboard focus; panes draw it inset plus the active-row bar. Outline-based so it survives Windows high contrast, where `--ring` becomes Highlight. Never a second style or a box-shadow ring.
- **Navigation:** the sidebar sits on chrome with a filter field, badge counts and 28px chevron rows. Selected rows use `--selection`, or `--selection-strong` when the pane is focused.
- **Menus:** overlay popover, 4px radius, strong border, floating shadow, 4px padding, 100ms pop-in; items 6px by 12px, the focused one in the strong selection tint.
- **Status bar:** a `--row-md` strip on chrome with a top border, 12px tabular text, under every repository view. Left: the running operation (after 300 ms, with elapsed time) or the last result (about 4 s). Right: facts and actions; actions tint on hover and open a hover card, items needing attention use warning. The zoom bubble divides its size and offset by `--zoom` so it stays put while the window rescales.
- **Toasts:** bottom-right above the status bar, newest nearest the corner, `--toast` fill (surface mixed 20% toward text), strong border, floating shadow. Errors and warnings carry an icon, no side stripe. Errors stay until clicked; others fade after 5 s, or 10 s with buttons.

### The Transit Graph (signature)

SVG, one 28px row per commit, lanes 18px apart.

- **Lines:** 3px (3.5px for the current branch), coloured by `--graph-lane-N`; non-emphasised lines mix 80% toward the surface.
- **Station:** a commit is a hollow dot, surface fill, 4.5px radius, 2px ring in its lane colour.
- **Interchange:** a merge is a filled dot, 5px radius.
- **HEAD:** a 9px, 1.5px halo ring around its station.
- **Working changes:** a 4.5px node with a short stub at the top when the tree is dirty.

**The Station Grammar Rule.** Hollow is a commit, filled is a merge, a halo is HEAD. New marks extend this grammar rather than invent another.
