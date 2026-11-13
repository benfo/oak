import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BLUE_ORANGE, diffColourTokens } from '../src/renderer/src/diff/diffColours.ts'
import { BUILT_IN_THEMES } from '../src/renderer/src/builtInThemes.ts'

type RGB = [number, number, number]

function parse(color: string): { rgb: RGB; alpha: number } {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)
  if (hex) return { rgb: [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) as RGB, alpha: 1 }
  const m = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/.exec(color)
  if (!m) throw new Error(`unreadable colour ${color}`)
  return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], alpha: m[4] === undefined ? 1 : Number(m[4]) }
}

const over = (top: string, under: RGB): RGB => {
  const { rgb, alpha } = parse(top)
  return rgb.map((c, i) => c * alpha + under[i] * (1 - alpha)) as RGB
}
const linear = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const luminance = (rgb: RGB) => 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2])
function contrast(a: RGB, b: RGB) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// The default Light and Dark surfaces, read from tokens.css so the test follows them.
const tokens = readFileSync(new URL('../src/renderer/src/tokens.css', import.meta.url), 'utf8')
const defaultSurface = (base: 'light' | 'dark') =>
  new RegExp(`\\[data-theme='${base}'\\][^{]*\\{[^}]*?--surface:\\s*(#[0-9a-f]{6})`, 'i').exec(tokens)![1]

const surfaces = BUILT_IN_THEMES.map((t) => ({ name: t.name, base: t.base, surface: t.colors?.surface ?? defaultSurface(t.base) }))

test('blue and orange signs and counts read at 4.5:1 on their row tint, on every built-in theme', () => {
  for (const { name, base, surface } of surfaces) {
    const ground = parse(surface).rgb
    const p = BLUE_ORANGE[base]
    for (const side of ['add', 'del'] as const) {
      const text = parse(p[`diff-${side}-foreground`]).rgb
      for (const tint of [p[`diff-${side}`], p[`diff-${side}-gutter`]]) {
        const ratio = contrast(text, over(tint, ground))
        assert.ok(ratio >= 4.5, `${name}: ${side} text on ${tint} is ${ratio.toFixed(2)}:1`)
      }
    }
  }
})

// Machado et al. (2009) full-severity simulations, applied in linear RGB.
const SIMULATIONS: Record<string, number[][]> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998]
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881]
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039]
  ]
}
const simulate = (rgb: RGB, m: number[][]) => {
  const l = rgb.map(linear)
  return m.map((row) => Math.min(1, Math.max(0, row[0] * l[0] + row[1] * l[1] + row[2] * l[2])))
}
const distance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

test('added and removed stay apart under simulated colour blindness', () => {
  for (const base of ['light', 'dark'] as const) {
    const add = parse(BLUE_ORANGE[base]['diff-add-foreground']).rgb
    const del = parse(BLUE_ORANGE[base]['diff-del-foreground']).rgb
    for (const [kind, m] of Object.entries(SIMULATIONS)) {
      const d = distance(simulate(add, m), simulate(del, m))
      assert.ok(d >= 0.15, `${base} ${kind}: added and removed differ by only ${d.toFixed(3)}`)
    }
  }
})

test('standard lays nothing over the theme; colour-blind friendly sets every diff token for the base', () => {
  assert.deepEqual(diffColourTokens('standard', 'dark'), {})
  assert.deepEqual(Object.keys(diffColourTokens('blueOrange', 'light')).sort(), Object.keys(BLUE_ORANGE.light).sort())
})
