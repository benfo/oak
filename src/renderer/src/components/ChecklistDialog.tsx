import { useState, useSyncExternalStore } from 'react'
import { GridList, GridListItem, type Selection } from 'react-aria-components'
import { createStore } from '../lib/createStore'
import { handleShortcutBindings } from '../lib/shortcuts'
import { shortcutPlatform } from '../lib/useShortcuts'
import { Modal } from '../ui'

export interface ChecklistItem {
  id: string
  label: string
  /** Why the row is listed, shown beside the label. */
  note?: string
  /** Draws the note as a warning. */
  warn?: boolean
  checked?: boolean
}

export interface ChecklistOptions {
  title: string
  message: string
  items: ChecklistItem[]
  /** The confirm button's text for the number of ticked rows. */
  ok: (count: number) => string
  danger?: boolean
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

function ChecklistDialog({ req }: { req: ChecklistReq }) {
  const [selected, setSelected] = useState<Selection>(() => new Set(req.items.filter((i) => i.checked).map((i) => i.id)))
  const ticked = req.items.filter((i) => selected === 'all' || selected.has(i.id)).map((i) => i.id)
  const close = (ids: string[] | null) => {
    checklistStore.set(null)
    req.resolve(ids)
  }
  const submit = () => close(ticked)

  return (
    <Modal title={req.title} onClose={() => close(null)} width={520}>
      <p className="modal-msg">{req.message}</p>
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
          {req.items.map((item) => (
            <GridListItem key={item.id} id={item.id} textValue={item.label} className="checklist-row">
              {({ isSelected }) => (
                <>
                  <input type="checkbox" checked={isSelected} readOnly tabIndex={-1} aria-hidden />
                  <span className="checklist-label">{item.label}</span>
                  {item.note && <span className={`checklist-note ${item.warn ? 'warn' : ''}`}>{item.note}</span>}
                </>
              )}
            </GridListItem>
          ))}
        </GridList>
      </div>
      <div className="modal-actions">
        <span className="checklist-hint">Space ticks, Ctrl+A ticks all, Ctrl+Enter confirms</span>
        <button className="btn" onClick={() => close(null)}>
          Cancel
        </button>
        <button className={`btn ${req.danger ? 'danger' : 'primary'}`} disabled={!ticked.length} onClick={submit}>
          {req.ok(ticked.length)}
        </button>
      </div>
    </Modal>
  )
}
