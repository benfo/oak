import { showWhitespace } from '../diff/whitespace'
import type { Span } from '../diff/syntax'

interface Props {
  text: string
  /** The line's syntax colours; without them the text is drawn plain. */
  tokens: Span[] | null
  whitespace: boolean
  /** [start, end) offsets in `text` that the find box matched. */
  hits: readonly [number, number][]
}

/** One line of code: syntax coloured, with spaces and tabs drawn on request, and the found text marked. */
export function BlameCode({ text, tokens, whitespace, hits }: Props) {
  const draw = (t: string) => (whitespace ? showWhitespace(t) : t)
  if (!tokens && !hits.length) return <>{draw(text)}</>

  // A hit can start or end inside a coloured span, so each span is cut at the hit edges and the pieces keep its colour.
  const pieces: { t: string; c?: string; hit: boolean }[] = []
  let offset = 0
  for (const span of tokens ?? [{ t: text }]) {
    let from = 0
    for (const [start, end] of hits) {
      const a = Math.max(start - offset, from)
      const b = Math.min(end - offset, span.t.length)
      if (b <= a) continue
      if (a > from) pieces.push({ t: span.t.slice(from, a), c: span.c, hit: false })
      pieces.push({ t: span.t.slice(a, b), c: span.c, hit: true })
      from = b
    }
    if (from < span.t.length) pieces.push({ t: span.t.slice(from), c: span.c, hit: false })
    offset += span.t.length
  }
  return (
    <>
      {pieces.map((p, i) => (
        <span key={i} className={p.hit ? 'find-hit' : undefined} style={p.c ? { color: p.c } : undefined}>
          {draw(p.t)}
        </span>
      ))}
    </>
  )
}
