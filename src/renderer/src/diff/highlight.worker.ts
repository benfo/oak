import { highlightBlocks, knownLanguage } from './highlighter'
import { languageFor } from './syntax'

/** Request: { id, path, blocks }. Reply: { id, tokens }; tokens is null for files we don't highlight. */
export interface HighlightRequest {
  id: number
  path: string
  blocks: string[]
}

const post = (msg: unknown) => (self as unknown as { postMessage(m: unknown): void }).postMessage(msg)

self.onmessage = async (e: MessageEvent<HighlightRequest>) => {
  const { id, path, blocks } = e.data
  try {
    const lang = languageFor(path, knownLanguage)
    post({ id, tokens: lang ? await highlightBlocks(lang, blocks) : null })
  } catch (err) {
    post({ id, tokens: null, error: String(err) })
  }
}
