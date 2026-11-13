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

export interface ChecklistOptions {
  title: string
  message: string
  /** Read-only findings shown above the list. */
  summary?: ReactNode
  /** What ticking a row can cost, shown under the list. */
  caution?: string
  items: ChecklistItem[]
  /** The confirm button's text for the number of ticked rows. */
  ok: (count: number) => string
  /** Whether confirming the ticked rows is destructive. */
  danger?: (ids: string[]) => boolean
}

type ChecklistReq = ChecklistOptions & { resolve: (ids: string[] | null) => void }

const checklistStore = createStore<ChecklistReq | null>(null)

/** A dialog to tick rows of a list; resolves with the ticked ids in list order, or null when cancelled. */
export const chooseFromList = (opts: ChecklistOptions) =>
  new Promise<string[] | null>((resolve) => checklistStore.set({ ...opts, resolve }))

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

function ChecklistDialog({ req }: { req: ChecklistReq }) {
  const [selected, setSelected] = useState<Selection>(() => new Set(req.items.filter((i) => i.checked).map((i) => i.id)))
  const ticked = req.items.filter((i) => selected === 'all' || selected.has(i.id)).map((i) => i.id)
  const close = (ids: string[] | null) => {
    checklistStore.set(null)
    req.resolve(ids)
  }
  const submit = () => close(ticked)

  return (
    <Modal title={req.title} onClose={() => close(null)} width={640}>
      <p className="modal-msg">{req.message}</p>
      {req.summary}
      <div
        className="pane-frame checklist-frame"
        onKeyDownCapture={(e) =>
          handleShortcutBindings(
            e,
            [{ id: 'submit', keys: 'Mod+Enter', enabled: ticked.length > 0, run: submit }],
            undefined,
            shortcutPlatform()
          )
        }
      >
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
          onSelectionChange={setSelected}
        >
          {grouped(req.items).map(([title, items]) =>
            title ? (
              <GridListSection key={title}>
                <GridListHeader className="checklist-group">{title}</GridListHeader>
                {items.map((item) => (
                  <ChecklistRow key={item.id} item={item} />
                ))}
              </GridListSection>
            ) : (
              items.map((item) => <ChecklistRow key={item.id} item={item} />)
            )
          )}
        </GridList>
      </div>
      <DialogDetailsView warning={req.caution} />
      <div className="modal-actions">
        <span className="checklist-hint">Space ticks, Ctrl+A ticks all, Ctrl+Enter confirms</span>
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
