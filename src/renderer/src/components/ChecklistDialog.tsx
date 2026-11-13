import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { GridList, GridListHeader, GridListItem, GridListSection, type Selection } from 'react-aria-components'
import { createStore } from '../lib/createStore'
import { handleShortcutBindings } from '../lib/shortcuts'
import { shortcutPlatform } from '../lib/useShortcuts'
import { Modal } from '../ui'
import { DialogDetailsView } from './DialogDetails'

export interface ChecklistItem {
  id: string
  label: string
  /** Rows with the same group sit under one heading, in the order groups first appear. */
  group?: string
  /** Why the row is listed, shown beside the label. */
  note?: string
  /** Draws the note as a warning. */
  warn?: boolean
  checked?: boolean
}

/** What the dialog shows; everything here can arrive after the dialog opened. */
export interface ChecklistContent {
  message: string
  /** Read-only findings shown above the list. */
  summary?: ReactNode
  /** What ticking a row can cost, shown under the list. */
  caution?: string
  items: ChecklistItem[]
}

export interface ChecklistOptions extends ChecklistContent {
  title: string
  /** The confirm button's text for the number of ticked rows. */
  ok: (count: number) => string
  /** Whether confirming the ticked rows is destructive. */
  danger?: (ids: string[]) => boolean
  /** Slow content: the dialog opens at once with the content above and swaps this in when it arrives. */
  loading?: Promise<ChecklistContent>
}

type ChecklistReq = ChecklistOptions & { pending: boolean; resolve: (ids: string[] | null) => void }

const checklistStore = createStore<ChecklistReq | null>(null)

/**
 * A dialog to tick rows of a list; resolves with the ticked ids in list order, or null when cancelled.
 * Rejects, closing the dialog, when `loading` fails.
 */
export const chooseFromList = (opts: ChecklistOptions) =>
  new Promise<string[] | null>((resolve, reject) => {
    const req: ChecklistReq = { ...opts, pending: !!opts.loading, resolve }
    checklistStore.set(req)
    const stillOpen = () => checklistStore.get()?.resolve === resolve
    opts.loading?.then(
      (content) => stillOpen() && checklistStore.set({ ...req, ...content, pending: false }),
      (e) => {
        if (stillOpen()) checklistStore.set(null)
        reject(e)
      }
    )
  })

export function ChecklistDialogHost() {
  const req = useSyncExternalStore(checklistStore.subscribe, checklistStore.get)
  return req ? <ChecklistDialog req={req} /> : null
}

function grouped(items: ChecklistItem[]) {
  const groups = new Map<string, ChecklistItem[]>()
  for (const item of items) groups.set(item.group ?? '', [...(groups.get(item.group ?? '') ?? []), item])
  return [...groups]
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  return (
    <GridListItem id={item.id} textValue={item.label} className="checklist-row">
      {({ isSelected }) => (
        <>
          <input type="checkbox" checked={isSelected} readOnly tabIndex={-1} aria-hidden />
          <span className="checklist-label">{item.label}</span>
          {item.note && <span className={`checklist-note ${item.warn ? 'warn' : ''}`}>{item.note}</span>}
        </>
      )}
    </GridListItem>
  )
}

const initiallyTicked = (items: ChecklistItem[]): Selection => new Set(items.filter((i) => i.checked).map((i) => i.id))

function ChecklistDialog({ req }: { req: ChecklistReq }) {
  const [items, setItems] = useState(req.items)
  const [selected, setSelected] = useState(() => initiallyTicked(req.items))
  // Rows that arrive after opening bring their own ticks.
  if (items !== req.items) {
    setItems(req.items)
    setSelected(initiallyTicked(req.items))
  }
  const ticked = req.items.filter((i) => selected === 'all' || selected.has(i.id)).map((i) => i.id)
  const close = (ids: string[] | null) => {
    checklistStore.set(null)
    req.resolve(ids)
  }
  const submit = () => close(ticked)
  const tickAllOrNone = () => setSelected(new Set(ticked.length === req.items.length ? [] : req.items.map((i) => i.id)))

  return (
    <Modal title={req.title} onClose={() => close(null)} width={640}>
      <p className="modal-msg">{req.message}</p>
      {req.summary}
      <div
        className="pane-frame checklist-frame"
        onKeyDownCapture={(e) =>
          handleShortcutBindings(
            e,
            [
              { id: 'submit', keys: 'Mod+Enter', enabled: ticked.length > 0, run: submit },
              { id: 'all', keys: 'Mod+A', enabled: !req.pending, run: tickAllOrNone }
            ],
            undefined,
            shortcutPlatform()
          )
        }
      >
        {req.pending ? (
          <div className="checklist checklist-pending" role="status">
            <span className="spinner" aria-hidden="true" />
            Checking…
          </div>
        ) : (
          <ChecklistRows req={req} ticked={ticked} selected={selected} onChange={setSelected} />
        )}
      </div>
      <DialogDetailsView warning={req.caution} />
      <div className="modal-actions">
        <span className="checklist-hint">Space ticks, Ctrl+A ticks all or none, Ctrl+Enter confirms</span>
        <button className="btn" onClick={() => close(null)}>
          Cancel
        </button>
        <button className={`btn ${req.danger?.(ticked) ? 'danger' : 'primary'}`} disabled={!ticked.length} onClick={submit}>
          {req.ok(ticked.length)}
        </button>
      </div>
    </Modal>
  )
}

/** A group's heading; with more than one row it also ticks or unticks the whole group. */
function GroupHeader({
  title,
  ids,
  ticked,
  onChange
}: {
  title: string
  ids: string[]
  ticked: string[]
  onChange: (keys: Selection) => void
}) {
  const count = ids.filter((id) => ticked.includes(id)).length
  const toggle = () => onChange(new Set(count ? ticked.filter((id) => !ids.includes(id)) : [...ticked, ...ids]))
  return (
    <GridListHeader className="checklist-group">
      {title}
      {ids.length > 1 && (
        <>
          <span className="checklist-group-count">
            {count} of {ids.length}
          </span>
          <button type="button" className="checklist-group-toggle" tabIndex={-1} onClick={toggle}>
            {count ? 'Untick all' : 'Tick all'}
          </button>
        </>
      )}
    </GridListHeader>
  )
}

interface ChecklistRowsProps {
  req: ChecklistReq
  ticked: string[]
  selected: Selection
  onChange: (keys: Selection) => void
}

function ChecklistRows({ req, ticked, selected, onChange }: ChecklistRowsProps) {
  return (
    <GridList
      className="checklist"
      data-pane="checklist"
      aria-label={req.title}
      autoFocus
      selectionMode="multiple"
      selectionBehavior="toggle"
      disallowTypeAhead
      escapeKeyBehavior="none"
      selectedKeys={selected}
      onSelectionChange={onChange}
    >
      {grouped(req.items).map(([title, items]) =>
        title ? (
          <GridListSection key={title}>
            <GroupHeader title={title} ids={items.map((i) => i.id)} ticked={ticked} onChange={onChange} />
            {items.map((item) => (
              <ChecklistRow key={item.id} item={item} />
            ))}
          </GridListSection>
        ) : (
          items.map((item) => <ChecklistRow key={item.id} item={item} />)
        )
      )}
    </GridList>
  )
}
