export interface ShortcutHelpRow {
  title: string
  description?: string
  keys: string
  category: string
  bindings: readonly string[]
}

/** Search aliases apply to both typed queries and the bindings behind each help row. */
export function normalizeShortcutSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/⌘/g, ' ctrl ')
    .replace(/⇧/g, ' shift ')
    .replace(/⌥/g, ' alt ')
    .replace(/↑/g, ' up ')
    .replace(/↓/g, ' down ')
    .replace(/←/g, ' left ')
    .replace(/→/g, ' right ')
    .replace(/\b(control|cmd|command|mod)\b/g, 'ctrl')
    .replace(/\barrow(up|down|left|right)\b/g, '$1')
    .replace(/\bescape\b/g, 'esc')
    .replace(/\breturn\b/g, 'enter')
    .replace(/\bcontextmenu\b/g, 'menu')
    .replace(/\bpgup\b/g, 'pageup')
    .replace(/\bpgdn\b/g, 'pagedown')
    .replace(/\bpage\s+(up|down)\b/g, 'page$1')
    .replace(/\//g, ' slash ')
    .replace(/,/g, ' comma ')
    .replace(/`/g, ' backtick ')
    .replace(/\+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const MODIFIERS = new Set(['ctrl', 'alt', 'shift', 'meta'])

export function prepareShortcutHelp<T extends ShortcutHelpRow>(row: T) {
  return {
    ...row,
    description: row.description,
    search: normalizeShortcutSearch(`${row.title} ${row.description ?? ''} ${row.category} ${row.keys} ${row.bindings.join(' ')}`),
    chords: row.bindings.map((binding) => normalizeShortcutSearch(binding).split(' '))
  }
}

/** A chord query matches one binding, with exactly its modifiers. Text stays a substring search. */
export function matchesShortcutHelp(row: ReturnType<typeof prepareShortcutHelp>, query: string) {
  const words = normalizeShortcutSearch(query).split(' ').filter(Boolean)
  const modifiers = words.filter((word) => MODIFIERS.has(word))
  const keys = words.filter((word) => !MODIFIERS.has(word))
  const punctuationKey = /^[/,`]$/.test(query.trim())
  if (punctuationKey) return row.chords.some((chord) => keys.every((key) => chord.includes(key)))
  if (!MODIFIERS.has(words[0])) return words.every((word) => row.search.includes(word))
  return row.chords.some((chord) => {
    const chordModifiers = chord.filter((word) => MODIFIERS.has(word))
    return (
      modifiers.every((modifier) => chordModifiers.includes(modifier)) &&
      (!keys.length || chordModifiers.length === new Set(modifiers).size) &&
      keys.every((key) => chord.includes(key))
    )
  })
}
