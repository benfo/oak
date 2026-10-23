import { fuzzyPositions, prepareFuzzy, rankFuzzy, type FuzzyTarget } from '../lib/fuzzy'
import { useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import {
  Autocomplete,
  Collection,
  Dialog,
  Header,
  Input,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  ListLayout,
  Modal as AriaModal,
  ModalOverlay,
  Popover,
  TextField,
  Virtualizer,
  type Key
} from 'react-aria-components'
import { Icon } from './Icon'
import { handleNavigation } from '../lib/navigation'
import { createStore } from '../ui'
import { ShortcutsDialog } from './ShortcutsDialog'
import { displayKeys, matchKeys, type Command } from '../commands'
import { useShortcutOverlay } from '../lib/useShortcuts'

export interface PaletteItem {
  id: string
  label: string
  category?: string
  detail?: string
  hint?: string
  /** Heading the item is listed under while nothing is typed (e.g. "Local branches"). */
  group?: string
  /** Small pills after the label (e.g. ahead/behind counts). */
  badges?: { text: string; warn?: boolean }[]
  /** Marked with a check (e.g. the current branch). */
  current?: boolean
  run: () => void
}

/** A footer action. Tab reaches it from the search box; its `hint` shortcut works while the picker is open. */
export interface PaletteAction {
  id: string
  label: (text: string) => string
  hint?: string
  /** Pushed to the right, apart from the others (e.g. "Close repository"). */
  end?: boolean
  run: (text: string) => void
}

interface PaletteReq {
  placeholder: string
  /** Text the search box starts with (e.g. the sidebar filter). */
  query?: string
  items: PaletteItem[]
  /** localStorage key for remembering recently picked items, which float to the top. */
  recentKey?: string
  /** An authoritative recent list (e.g. Git checkout history), rather than recently picked items. */
  recentIds?: string[]
  /** Show recent items as their own group with this heading (instead of floating them). */
  recentGroup?: string
  /** Open as a dropdown just below this element (e.g. a toolbar button) instead of centred. */
  anchor?: Element | null
  /** Called as the cursor moves onto an item (e.g. to preview a theme). */
  onHighlight?: (id: string) => void
  /** No dimmed backdrop, e.g. while previewing themes so the whole app shows the preview. */
  seeThrough?: boolean
  /** Actions in a fixed footer that never scrolls away (e.g. "New branch…"). Labels can use what's typed. */
  actions?: PaletteAction[]
  /** When nothing matches what's typed, the one row offered instead (e.g. create a branch with that name). */
  whenNoMatch?: (text: string) => { label: string; run: () => void } | null
  /** Called when the palette closes without a pick (Escape, click outside). */
  onCancel?: () => void
}

const paletteStore = createStore<PaletteReq | null>(null)
const shortcutsStore = createStore<Command[] | null>(null)

export const openPalette = (req: PaletteReq) => paletteStore.set(req)
export const openShortcuts = (commands: Command[]) => shortcutsStore.set(commands)
export const closePalette = () => paletteStore.set(null)

// ---------- fuzzy matching ----------
// Matching runs over every item on every keystroke (thousands of branches or tags), so text is
// prepared once per picker (lib/fuzzy.ts). Which letters to highlight is worked out separately,
// for the few rows actually on screen.

interface Prepared {
  item: PaletteItem
  text: string
  target: FuzzyTarget
  detailTarget: FuzzyTarget | null
}

interface Match {
  item: PaletteItem
  text: string
  score: number
}

/** More than this many matches would only be reached by scrolling a very long way; typing narrows them. */
const MAX_RESULTS = 2000
/** Matches --row-lg (tokens.css). */
const ROW_H = 32
const VISIBLE_ROWS = 12
const HEADING_H = 28

function readRecent(key?: string): string[] {
  if (!key) return []
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]')
  } catch {
    return []
  }
}

function remember(key: string | undefined, id: string) {
  if (!key) return
  try {
    localStorage.setItem(key, JSON.stringify([id, ...readRecent(key).filter((x) => x !== id)].slice(0, 10)))
  } catch {
    // recents just won't be remembered
  }
}

// ---------- components ----------

export function PaletteHost() {
  const req = useSyncExternalStore(paletteStore.subscribe, paletteStore.get)
  const shortcuts = useSyncExternalStore(shortcutsStore.subscribe, shortcutsStore.get)
  return (
    <>
      {req && <Palette key={req.placeholder + req.items.length} req={req} />}
      {shortcuts && <ShortcutsDialog commands={shortcuts} onClose={() => shortcutsStore.set(null)} />}
    </>
  )
}

/** A group of rows under an optional heading. Row keys are unique across groups (recents repeat items). */
interface Group {
  id: string
  title?: string
  rows: { key: string; match: Match }[]
}

/**
 * The command palette and pickers (React Aria Autocomplete): the input keeps focus while ↑↓
 * PgUp PgDn move a virtual cursor through the list, Enter or a click picks, Escape closes.
 * We rank matches ourselves (fuzzy), so Autocomplete gets no filter of its own. Centred by default;
 * with `anchor` it opens as a dropdown under that element (toolbar branch and repo pickers).
 */
function Palette({ req }: { req: PaletteReq }) {
  useShortcutOverlay('picker')
  const [query, setQuery] = useState(req.query ?? '')
  const opener = useRef(document.activeElement as HTMLElement | null)

  // Lowercased once per picker, not once per keystroke.
  const prepared = useMemo(
    (): Prepared[] =>
      req.items.map((item) => {
        const text = item.category ? `${item.category}: ${item.label}` : item.label
        return { item, text, target: prepareFuzzy(text), detailTarget: item.detail ? prepareFuzzy(item.detail) : null }
      }),
    [req]
  )

  // The input shows each keystroke at once; the results follow when React gets to them.
  const deferred = useDeferredValue(query)
  /** What's typed, as typed (footer labels, the "create" row). */
  const text = deferred.trim()
  const q = text
  const recentIds = useMemo(() => req.recentIds ?? readRecent(req.recentKey), [req])

  const groups = useMemo((): Group[] => {
    const toMatch = (p: Prepared, score = 0): Match => ({ item: p.item, text: p.text, score })
    const rows = (list: Match[], prefix = '') => list.map((match) => ({ key: prefix + match.item.id, match }))
    const listed = prepared
    const out: Group[] = []

    if (q) {
      // A match in the description (e.g. a commit subject) counts, below any match in the name.
      const byName = rankFuzzy(q, listed, (p) => p.target, MAX_RESULTS)
      const named = new Set(byName.map((r) => r.entry))
      const byDetail = rankFuzzy(q, listed, (p) => (named.has(p) ? null : p.detailTarget), MAX_RESULTS)
      const matches: Match[] = [
        ...byName.map((r) => toMatch(r.entry, r.score)),
        ...byDetail.map((r) => toMatch(r.entry, r.score - 2))
      ]
      out.push({ id: 'results', rows: rows(matches.length > MAX_RESULTS ? matches.slice(0, MAX_RESULTS) : matches) })
      // Nothing matches: offer to act on what was typed (only then, so Enter never creates by accident).
      const create = !matches.length ? req.whenNoMatch?.(text) : null
      if (create) out.push({ id: 'create', rows: rows([{ item: { id: '__create', label: create.label, run: create.run }, text: create.label, score: 0 }]) })
    } else if (req.recentGroup || listed.some((p) => p.item.group)) {
      // Nothing typed: recent picks first (their own group), then each group in order.
      if (req.recentGroup) {
        const byId = new Map(listed.map((p) => [p.item.id, p]))
        const recent = recentIds.map((id) => byId.get(id)).filter((p): p is Prepared => !!p).slice(0, 5)
        if (recent.length) out.push({ id: 'recent', title: req.recentGroup, rows: rows(recent.map((p) => toMatch(p)), 'recent:') })
      }
      const byGroup = new Map<string, Match[]>()
      for (const p of listed) byGroup.set(p.item.group ?? '', [...(byGroup.get(p.item.group ?? '') ?? []), toMatch(p)])
      for (const [title, list] of byGroup) out.push({ id: `group:${title}`, title: title || undefined, rows: rows(list.slice(0, MAX_RESULTS)) })
    } else {
      // Nothing typed, no groups: recent picks float to the top.
      const rank = (i: PaletteItem) => {
        const r = recentIds.indexOf(i.id)
        return r === -1 ? 1e9 : r
      }
      const sorted = listed.map((p) => toMatch(p, -rank(p.item))).sort((a, b) => b.score - a.score)
      out.push({ id: 'all', rows: rows(sorted.slice(0, MAX_RESULTS)) })
    }
    return out.filter((g) => g.rows.length)
  }, [q, text, prepared, recentIds])

  const rowCount = groups.reduce((n, g) => n + g.rows.length, 0)
  const headings = groups.filter((g) => g.title).length
  const floatRecent = !q && !req.recentGroup ? new Set(recentIds) : new Set<string>()
  const findRow = (key: Key) => {
    for (const g of groups) for (const row of g.rows) if (row.key === key) return row
  }

  const pick = (key: Key) => {
    const m = findRow(key)?.match
    if (!m) return
    remember(req.recentKey, m.item.id)
    // Close now and put focus back ourselves, so a dialog the command opens returns focus to
    // where the palette was opened from, not to this (soon gone) input.
    flushSync(closePalette)
    opener.current?.focus()
    m.item.run()
  }

  // Enter before the cursor has moved picks the top match.
  const onKeyDownCapture = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.currentTarget.getAttribute('aria-activedescendant')) return
    handleNavigation(e, { activate: () => {
      const first = groups[0]?.rows[0]
      if (first) pick(first.key)
    } }, { allowTextInput: true })
  }

  const runAction = (a: PaletteAction) => {
    flushSync(closePalette)
    opener.current?.focus()
    a.run(text)
  }
  const onFooterShortcut = (e: React.KeyboardEvent) => {
    if (e.defaultPrevented || e.nativeEvent.isComposing || e.repeat) return
    const a = req.actions?.find((x) => x.hint && matchKeys(x.hint, e.nativeEvent))
    if (!a) return
    e.preventDefault()
    e.stopPropagation()
    runAction(a)
  }

  const cancel = (open: boolean) => {
    if (open) return
    closePalette()
    req.onCancel?.()
  }

  const body = (
    <Dialog className="palette-dialog" aria-label={req.placeholder}>
      {/* Footer shortcuts work while typing; captured here before the search box handles the keys. */}
      <div className="palette-body" onKeyDownCapture={onFooterShortcut}>
      <Autocomplete inputValue={query} onInputChange={setQuery}>
        <TextField className="palette-field" aria-label={req.placeholder} autoFocus>
          <Input className="palette-input" placeholder={req.placeholder} spellCheck={false} onKeyDownCapture={onKeyDownCapture} />
        </TextField>
        {/* Virtualized: only the rows in view are drawn, however many items match. */}
        <Virtualizer layout={ListLayout} layoutOptions={{ rowHeight: ROW_H, headingHeight: HEADING_H }}>
          <ListBox
            className="palette-list"
            // Virtualized rows are absolutely positioned, so the list can't size to them.
            style={{ height: rowCount ? Math.min(rowCount * ROW_H + headings * HEADING_H, VISIBLE_ROWS * ROW_H) + 8 : undefined }}
            aria-label="Results"
            items={groups}
            dependencies={[q]}
            onAction={pick}
            renderEmptyState={() => <div className="palette-empty">No matches</div>}
          >
            {(g) => (
              <ListBoxSection id={g.id} aria-label={g.title ?? 'Results'} className="palette-section">
                {g.title && <Header className="palette-group">{g.title}</Header>}
                <Collection items={g.rows} dependencies={[q]}>
                  {(row) => (
                    <ListBoxItem id={row.key} textValue={row.match.text} className="palette-item">
                      {({ isFocused }) => (
                        <div className="palette-row">
                          <span className="palette-check">{row.match.item.current && <Icon name="check" size={14} />}</span>
                          <span className="palette-label">
                            <Highlighted text={row.match.text} query={q} dimTo={row.match.item.category ? row.match.item.category.length + 1 : 0} />
                          </span>
                          {row.match.item.badges?.map((b) => (
                            <span key={b.text} className={`pill ${b.warn ? 'warn' : ''}`}>
                              {b.text}
                            </span>
                          ))}
                          {row.match.item.detail && <span className="palette-detail">{row.match.item.detail}</span>}
                          {floatRecent.has(row.match.item.id) && <span className="palette-recent">recent</span>}
                          {row.match.item.hint && <kbd>{displayKeys(row.match.item.hint)}</kbd>}
                          {req.onHighlight && <OnHighlight focused={isFocused} id={row.match.item.id} run={req.onHighlight} />}
                        </div>
                      )}
                    </ListBoxItem>
                  )}
                </Collection>
              </ListBoxSection>
            )}
          </ListBox>
        </Virtualizer>
      </Autocomplete>
      {!!req.actions?.length && (
        <div className="palette-footer">
          {req.actions.map((a) => (
            <button key={a.id} className={`btn palette-action ${a.end ? 'end' : ''}`} onClick={() => runAction(a)}>
              <span className="palette-action-label">{a.label(text)}</span>
              {a.hint && <kbd>{displayKeys(a.hint)}</kbd>}
            </button>
          ))}
        </div>
      )}
      </div>
    </Dialog>
  )

  // A dropdown under its button: no backdrop; outside clicks and Escape close it.
  if (req.anchor)
    return (
      <Popover className="palette dropdown" triggerRef={{ current: req.anchor }} placement="bottom start" offset={6} isOpen onOpenChange={cancel}>
        {body}
      </Popover>
    )

  return (
    <ModalOverlay className={`palette-backdrop ${req.seeThrough ? 'see-through' : ''}`} isOpen isDismissable onOpenChange={cancel}>
      <AriaModal className="palette">{body}</AriaModal>
    </ModalOverlay>
  )
}


/** Inside a ListBoxItem: reports when that item gets the (virtual) cursor. */
function OnHighlight({ focused, id, run }: { focused: boolean; id: string; run: (id: string) => void }) {
  useEffect(() => {
    if (focused) run(id)
  }, [focused])
  return null
}

/** The label with matched letters emphasised; only rendered for rows in view. */
function Highlighted({ text, query, dimTo }: { text: string; query: string; dimTo: number }) {
  const hits = useMemo(() => (query ? fuzzyPositions(query, text) : new Set<number>()), [query, text])
  return (
    <>
      {[...text].map((ch, i) => (
        <span key={i} className={`${hits.has(i) ? 'hit' : ''} ${i < dimTo ? 'dim-part' : ''}`}>
          {ch}
        </span>
      ))}
    </>
  )
}
