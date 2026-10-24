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

Oak draws a repository the way a city draws its network. Branches are coloured lines, commits are stations, merges are interchanges, and the rest of the app speaks the same signage language: warm paper ground, black ink type, crisp 2px corners and saturated line colours. It is recognisable with no content on screen: warm paper, ink black, cut corners, bold lines.

The shell is an operate-mode tool and stays quiet. Toolbar on top, branch sidebar left, History and Changes in the main area, diff below. Density is desktop-dense (13px body, 28px controls and rows). Colour is rationed: neutrals carry the chrome, and the eight line colours live mainly in the commit graph, where they carry meaning. The platform font (Segoe UI) was kept deliberately; the world is carried by colour, corner and line, not by a custom face.

Only the Light and Dark base themes were redesigned. One Dark, Dracula and Solarized Light keep their own palettes and plug into the same token names, so any rule here is about tokens, not hex values.

**Key Characteristics:**
- Warm paper (Light) or neutral ink ground (Dark), with ink-coloured type
- 2px corners everywhere, driven by one radius knob
- Eight saturated line colours, lifted in Dark so they hold against the ground
- 3px graph lines, hollow ringed stations, filled interchange dots
- Flat: borders and tone separate surfaces, shadows only on floating layers
- Tokens only: no raw colours, spacing, radii, font sizes or control heights in components

## Colors

Warm neutrals do the structural work; one deep transit blue acts as the interface accent; the eight lane colours are the signage.

### Primary
- **Line Blue** (primary, #0039a6 in Light, #5b8dff in Dark): main actions, links, selection tints, the focus ring and the active-row bar. Also lane 0, so the interface accent and the first line are the same colour.

### Secondary
- **Signal Red** (lane-1 #ee352e, dark #ff5a52): second graph line and the welcome mark gradient start. The destructive action colour is a separate token (danger).
- **Line Orange** (lane-6 #ff6319, dark #ff8346): brand mark gradient end and the sixth line.

### Tertiary
- **Line Green** (lane-2), **Line Yellow** (lane-3), **Line Purple** (lane-4), **Line Cyan** (lane-5), **Line Brown** (lane-7): the remaining graph lanes, cycled in order by lane index modulo 8. Dark values are lifted for contrast on the ink ground.

### Neutral
- **Paper Chrome** (#edeae3): window chrome and sidebar. Dark: Ink Chrome (#131416).
- **Paper Surface** (#fbfaf6): main panels (lists, diff) and overlays. Dark: #1a1b1e, with overlays mixed 6% toward white.
- **Paper Sunken** (#e4e0d6): inputs, headers, wells. Dark: #101113.
- **Ink** (#141414): primary text. Dark: #f0eee8. Secondary text uses ink-muted (#47443e) and hints use ink-subtle (#57524b); both are tuned for legibility on the paper tones.
- **Rule** (#d9d5ca) and **Rule Strong** (#bdb8ab): hairline dividers and control borders. Dark: #2c2d30 and #3d3e42.
- Status and diff colours (danger, warning, diff add and delete tints, syntax colours) are semantic tokens with separate Light and Dark values; they are not part of the line palette.

### Named Rules
**The Lines Are Signage Rule.** Lane colours mean "this line". Do not borrow them as decoration on chrome; the interface accent is Line Blue only.

**The Token Source Rule.** Every colour is a variable from `tokens.css`. A theme may override any palette token; components never hold a literal.

## Typography

**Display Font:** none; Segoe UI Variable Text, then Segoe UI, system-ui (the platform font, kept by user choice)
**Body Font:** the same stack
**Label/Mono Font:** Cascadia Code, Cascadia Mono, JetBrains Mono, Consolas

**Character:** Plain, native and dense. Hierarchy comes from weight and ink tone (foreground, muted, subtle), not from size jumps.

### Hierarchy
- **Display** (700, 26px): welcome screen only.
- **Title** (600, 15px): dialog and panel headings.
- **Body** (400, 13px): all interface text.
- **Label** (500, 12px): control and metadata text; code and diffs also use 12px.
- **Caption** (400, 11px): badges, pills, line numbers, hints.
- **Code** (mono, 12px, 20px line height): diffs and hashes.

### Named Rules
**The Scale Only Rule.** Font sizes come from the five `--text-*` steps and weights from the four `--weight-*` steps; no component sets a literal size.

## Layout

A fixed shell: 44px title bar, toolbar, branch sidebar, main area with History and Changes, diff below, resizable by split handles. Spacing is a 4px scale (2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40). Controls are 20, 24, 28 or 32px tall (28px default); list rows are 28px, or 32px for roomy lists; virtualised lists reuse the same numbers. Every list row keeps 10px inner padding on both sides and nesting adds one indent per level. Layout, keyboard model and the no-layout-shift rule are fixed: hover, focus and selection never change a box's size or position.

### Named Rules
**The Nothing Moves Rule.** State changes use colour, tone, outline or inset bars only, never size, margin or position changes.

## Elevation & Depth

Flat by default. Surfaces separate by tone (chrome, surface, sunken) and 1px borders. A single shadow token lifts floating layers (menus, popovers, dialogs, palette): in Light `0 8px 30px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)`, in Dark a heavier `0 10px 40px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.4)`. Modal scrims are 35% black (25% soft). Selection and active rows use inset bars (2px to 3px in primary), not shadows.

### Named Rules
**The Flat Until Floating Rule.** Only layers that float over the app carry the shadow token; panels, rows and buttons never do.

## Shapes

Cut signage: one radius knob (2px) drives every size. Controls and rows use 2px; menus, popovers and pills use the large step (4px); the extra-large step (8px) is for the biggest containers; small and extra-small collapse to square. Pills and avatars use the full radius. A theme may change the knob to go sharper or rounder; components never set a literal radius. Borders are 1px.

## Components

### Buttons
- **Shape:** 2px corners, 28px tall, 12px horizontal padding, 1px border, 6px gap between icon and label.
- **Default:** surface fill with a strong-rule border; hover is the `--hover` tint.
- **Primary:** Line Blue fill and border, white text (ink text in Dark); hover brightens 8%.
- **Danger:** danger fill and border, white text; same hover.
- **Icon button:** 24px, transparent, muted ink; hover tint plus full ink. Disabled uses the 0.45 disabled opacity.
- **Focus:** the one app-wide ring: `outline: 2px solid var(--ring)` with a 2px offset, shown on keyboard focus only.

### Inputs / Fields
- **Style:** sunken-tone fill, 1px strong-rule border, 2px corners, 28px tall, 10px side padding.
- **Focus:** text fields always show the same 2px ring; panes (lists, tree, diff) show it inset, plus a 2px to 3px primary bar on the active row.
- **Error:** a field-error line beneath the field in danger colour.

### Navigation
Branch sidebar on the chrome tone with a filter field, badge counts and chevron rows at 28px. Tabs (preferences) mark selection with a selected state and the shared focus ring. Selected rows use `--selection` when the pane is unfocused and `--selection-strong` when focused.

### Menus
Overlay-tone popover, 4px radius, 1px strong border, floating shadow, 4px padding, 100ms pop-in. Items use 6px by 12px padding and 2px corners; the focused item takes the strong selection tint.

### The Transit Graph (signature)
The commit list draws history as a route map in SVG, one 28px row per commit, with lanes 18px apart.
- **Lines:** 3px strokes (3.5px for the current branch line), each coloured by lane index modulo 8 from `--graph-lane-N`. Non-emphasised lines are mixed 80% toward the surface.
- **Station:** an ordinary commit is a hollow dot: surface fill, 4.5px radius, 2px ring in its lane colour.
- **Interchange:** a merge commit is a filled dot in its lane colour, 5px radius.
- **HEAD:** the current commit gets a 9px radius halo ring, 1.5px, in its lane colour, around its station.
- **Working changes:** a 4.5px node with a short stub joins the top of the graph when the tree is dirty.

### Named Rules
**The One Focus Rule.** There is one focus system: a 2px `--focus-ring`, outline-based so it survives Windows high-contrast mode, where `--ring` becomes the system Highlight colour.

**The Station Grammar Rule.** Hollow means a commit, filled means a merge, a halo means HEAD. New graph marks extend this grammar; they do not invent a second one.

## Do's and Don'ts

### Do:
- **Do** take every colour, space, radius, font size and control height from `tokens.css` variables.
- **Do** use 2px corners (the radius knob) and 1px borders for controls and rows.
- **Do** keep the graph at 3px lines and an 18px lane pitch, and cycle eight lane colours.
- **Do** use the single 2px focus ring, and inset bars for active rows.
- **Do** keep surfaces flat and the shadow token for floating layers only.
- **Do** keep hover, focus and selection free of layout shift.
- **Do** check new colours against the Light and Dark values, and remember the three other built-in themes carry their own palettes.

### Don't:
- **Don't** use a neutral grey panel with a single blue accent as the look; warm paper and line colours are the identity.
- **Don't** use lane colours as chrome decoration.
- **Don't** add a second focus style, or replace outline rings with box-shadow rings.
- **Don't** add raw hex, pixel or font-size values to component CSS.
- **Don't** hold the redesign values as fixed for other themes; One Dark, Dracula and Solarized Light keep their own palettes.
