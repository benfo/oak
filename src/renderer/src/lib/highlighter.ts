import { createHighlighterCore, type HighlighterCore, type ThemeRegistrationRaw } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import { bundledLanguages } from 'shiki/langs'
import type { Span } from './syntax'

/*
 * Syntax highlighting with Shiki (TextMate grammars, as in VS Code). Runs in a worker
 * (highlight.worker.ts); kept free of DOM/worker APIs so tests can run it in Node.
 *
 * The theme paints with CSS variables instead of colours, so every Oak theme (and custom theme
 * files) colours code through the --syntax-* tokens, and switching themes needs no re-highlight.
 * The JavaScript regex engine avoids loading Oniguruma's WASM.
 */

const v = (name: string) => `var(--syntax-${name})`
/** Shiki needs a default foreground; tokens with it are left uncoloured (they inherit). */
const PLAIN = 'var(--foreground)'

const THEME: ThemeRegistrationRaw = {
  name: 'oak',
  type: 'light',
  settings: [
    { settings: { foreground: PLAIN, background: 'var(--surface)' } },
    { scope: ['comment', 'punctuation.definition.comment', 'string.comment'], settings: { foreground: v('comment') } },
    {
      scope: ['keyword', 'storage', 'storage.type', 'storage.modifier', 'keyword.operator.new', 'keyword.operator.expression', 'markup.heading', 'entity.name.section'],
      settings: { foreground: v('keyword') }
    },
    { scope: ['keyword.operator', 'punctuation'], settings: { foreground: PLAIN } },
    {
      scope: ['string', 'punctuation.definition.string', 'string.regexp', 'markup.inline.raw', 'markup.fenced_code', 'constant.other.symbol'],
      settings: { foreground: v('string') }
    },
    {
      scope: ['constant.numeric', 'constant.language', 'constant.character', 'constant.other.color', 'support.constant', 'variable.other.constant', 'variable.other.enummember'],
      settings: { foreground: v('number') }
    },
    { scope: ['entity.name.function', 'support.function', 'meta.function-call entity.name.function', 'markup.underline.link'], settings: { foreground: v('function') } },
    {
      scope: [
        'entity.name.type',
        'entity.name.class',
        'entity.name.namespace',
        'entity.other.inherited-class',
        'support.type',
        'support.class',
        'storage.type.primitive',
        'storage.type.built-in',
        'entity.name.type.class',
        'meta.type.annotation entity.name.type'
      ],
      settings: { foreground: v('type') }
    },
    {
      scope: [
        'variable.other.property',
        'variable.other.object.property',
        'support.variable.property',
        'meta.object-literal.key',
        'support.type.property-name',
        'entity.other.attribute-name',
        'variable.parameter',
        'entity.name.tag.yaml',
        'string.unquoted.key',
        'keyword.other.definition.ini',
        'entity.name.variable.field'
      ],
      settings: { foreground: v('property') }
    },
    { scope: ['entity.name.tag', 'support.class.component', 'markup.deleted.git_gutter'], settings: { foreground: v('tag') } }
  ]
}

/** Whether Shiki bundles a language with this id or alias (for syntax.ts languageFor). */
export const knownLanguage = (id: string) => id in bundledLanguages

let highlighter: Promise<HighlighterCore> | null = null
const getHighlighter = () =>
  (highlighter ??= createHighlighterCore({ themes: [THEME], langs: [], engine: createJavaScriptRegexEngine({ forgiving: true }) }))


/** Highlights each block (lines joined with \n) and returns its lines as spans. Null if the language is unknown. */
export async function highlightBlocks(lang: string, blocks: string[]): Promise<Span[][][] | null> {
  const load = bundledLanguages[lang as keyof typeof bundledLanguages]
  if (!load) return null
  const hl = await getHighlighter()
  if (!hl.getLoadedLanguages().includes(lang)) await hl.loadLanguage(load)
  return blocks.map((code) =>
    hl
      .codeToTokensBase(code, { lang, theme: 'oak', tokenizeMaxLineLength: 1000, tokenizeTimeLimit: 300 })
      .map((line) => merge(line.map((tok) => (tok.color && tok.color !== PLAIN ? { t: tok.content, c: tok.color } : { t: tok.content }))))
  )
}

/** Joins neighbouring spans of the same colour (whitespace takes any colour), so lines render fewer elements. */
function merge(spans: Span[]): Span[] {
  const out: Span[] = []
  for (const s of spans) {
    const prev = out[out.length - 1]
    if (prev && (prev.c === s.c || !s.t.trim())) prev.t += s.t
    else if (prev && !prev.t.trim()) out[out.length - 1] = { ...s, t: prev.t + s.t }
    else out.push({ ...s })
  }
  return out
}
