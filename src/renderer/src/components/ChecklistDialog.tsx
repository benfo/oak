import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { GridList, GridListHeader, GridListItem, GridListSection, type Selection } from 'react-aria-components'
import { createStore } from '../lib/createStore'
import { handleShortcutBindings } from '../lib/shortcuts'
import { shortcutPlatform } from '../lib/useShortcuts'
import { Modal } from '../ui'
import { DialogDetailsView } from './DialogDetails'
import { TaskList } from './TaskList'
import { reportTask, settleTasks, startTasks, type Task, type TaskRow, type TaskUpdate } from '../../../shared/taskList'

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

/** What the dialog says once the work has stopped; the task rows themselves stay as the record of what ran. */
export interface ChecklistOutcome {
  message: string
  summary?: ReactNode
}

export interface ChecklistOptions extends ChecklistContent {
  title: string
  /** The confirm button's text for the number of ticked rows. */
  ok: (count: number) => string
  /** Whether confirming the ticked rows is destructive. */
  danger?: (ids: string[]) => boolean
  /** Slow content: the dialog opens at once with the content above and swaps this in when it arrives. */
  loading?: Promise<ChecklistContent>
  /** The tasks confirming the ticked rows will run, in order. With `run`, they take the list's place when confirmed. */
  tasks?: (ids: string[]) => Task[]
  /** The line under the title while tasks run. */
  runningMessage?: string
  /**
   * Does the ticked rows' work while the dialog stays open, reporting each task as it starts, finishes or fails.
   * Report a failure instead of throwing: tasks left unfinished when this resolves show as skipped.
   */
  run?: (ids: string[], report: (taskId: string, update: TaskUpdate) => void) => Promise<ChecklistOutcome>
}

/** After confirming with `run`: the tasks as they stand, and the outcome once the work has stopped. */
interface Work {
  rows: TaskRow[]
  outcome?: ChecklistOutcome
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

/** Loading reads as the first task, in the same rows the work uses later. */
const CHECKING: TaskRow[] = [{ id: 'checking', label: 'Checking…', state: 'running' }]

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
  const [work, setWork] = useState<Work | null>(null)
  const outcome = work?.outcome
  const working = !!work && !outcome
  // The list that held focus is gone by then, so the only button left takes it.
  const closeButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (outcome) closeButton.current?.focus()
  }, [outcome])
  const submit = () => {
    if (!req.run) return close(ticked)
    setWork({ rows: startTasks(req.tasks?.(ticked) ?? []) })
    req
      .run(ticked, (id, update) => setWork((now) => now && { rows: reportTask(now.rows, id, update) }))
      .then(
        (result) => setWork((now) => now && { rows: settleTasks(now.rows), outcome: result }),
        () => close(null)
      )
  }
  const tickAllOrNone = () => setSelected(new Set(ticked.length === req.items.length ? [] : req.items.map((i) => i.id)))

  return (
    <Modal title={req.title} onClose={() => !working && close(outcome ? ticked : null)} width={640}>
      <p className="modal-msg">{outcome?.message ?? (working ? req.runningMessage : undefined) ?? req.message}</p>
      {outcome?.summary ?? req.summary}
      {/* Content that arrives late fills a body of fixed height, so the dialog never resizes under the pointer. */}
      <div className={`checklist-body ${req.loading ? 'steady' : ''}`}>
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
          {work ? (
            <TaskList rows={work.rows} label={req.runningMessage ?? req.title} />
          ) : req.pending ? (
            <TaskList rows={CHECKING} label="Checking" />
          ) : (
            <ChecklistRows req={req} ticked={ticked} selected={selected} onChange={setSelected} />
          )}
        </div>
        {!work && <DialogDetailsView warning={req.caution} />}
      </div>
      {outcome ? (
        <div className="modal-actions">
          <button ref={closeButton} className="btn primary" onClick={() => close(ticked)}>
            Close
          </button>
        </div>
      ) : (
        <div className="modal-actions">
          {!working && <span className="checklist-hint">Space ticks, Ctrl+A ticks all or none, Ctrl+Enter confirms</span>}
          <button className="btn" disabled={working} onClick={() => close(null)}>
            Cancel
          </button>
          <button className={`btn ${req.danger?.(ticked) ? 'danger' : 'primary'}`} disabled={!ticked.length || working} onClick={submit}>
            {req.ok(ticked.length)}
          </button>
        </div>
      )}
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
