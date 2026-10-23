import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BUILT_IN_THEMES } from '../src/renderer/src/builtInThemes.ts'

type Rgba = [number, number, number, number]

const css = readFileSync(new URL('../src/renderer/src/tokens.css', import.meta.url), 'utf8')

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector)
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('\n}', start))
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

const BASES: Record<string, Record<string, string>> = {
  light: block("[data-theme='light'] {"),
  dark: { ...block("[data-theme='light'] {"), ...block("[data-theme='dark'] {") }
}

function parse(value: string, tokens: Record<string, string>): Rgba {
  const v = value.trim()
  const ref = v.match(/^var\(--([\w-]+)\)$/)
  if (ref) return parse(tokens[ref[1]], tokens)
  const mix = v.match(/^color-mix\(in srgb, (.+?) (\d+)%, (.+)\)$/)
  if (mix) {
    const a = parse(mix[1], tokens)
    const alpha = Number(mix[2]) / 100
    return [a[0], a[1], a[2], a[3] * alpha]
  }
  if (v === 'transparent') return [0, 0, 0, 0]
  if (v.startsWith('#')) {
    const h = v.length === 4 ? v.replace(/[a-f\d]/gi, (c) => c + c).slice(1) : v.slice(1)
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1]
  }
  const rgba = v.match(/^rgba?\(([^)]+)\)$/)
  if (rgba) {
    const p = rgba[1].split(',').map((s) => Number(s.trim()))
    return [p[0], p[1], p[2], p[3] ?? 1]
  }
  throw new Error(`Unsupported colour: ${value}`)
}

function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top[3]
  return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1) as Rgba
}

function luminance(c: Rgba): number {
  const [r, g, b] = [0, 1, 2].map((i) => {
    const s = c[i] / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const SYNTAX = ['comment', 'keyword', 'string', 'number', 'function', 'type', 'property', 'tag']

for (const theme of BUILT_IN_THEMES) {
  test(`diff syntax text meets WCAG AA in ${theme.name}`, () => {
    const t = { ...BASES[theme.base], ...(theme.colors ?? {}) }
    const surface = parse(t.surface, t)
    const failures: string[] = []
    for (const kind of ['add', 'del'] as const) {
      const line = over(parse(t[`diff-${kind}`], t), surface)
      const word = over(parse(t[`diff-${kind}-word`], t), line)
      assert.ok(contrast(line, surface) >= 1.1, `${theme.name} ${kind} tint is too faint to scan`)
      assert.ok(luminance(word) !== luminance(line), `${theme.name} ${kind} word highlight is invisible`)
      const backgrounds: [string, Rgba][] = [
        [kind, line],
        [`${kind} word`, word]
      ]
      for (const [label, bg] of backgrounds) {
        for (const name of ['foreground', ...SYNTAX.map((s) => `syntax-${s}`)]) {
          const ratio = contrast(parse(t[name], t), bg)
          if (ratio < 4.5) failures.push(`${name} on ${label}: ${ratio.toFixed(2)}`)
        }
      }
    }
    for (const name of SYNTAX.map((s) => `syntax-${s}`)) {
      const ratio = contrast(parse(t[name], t), surface)
      if (ratio < 4.5) failures.push(`${name} on context: ${ratio.toFixed(2)}`)
    }
    assert.deepEqual(failures, [])
  })
}
