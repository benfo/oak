import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Dialog, Heading, Modal as AriaModal, ModalOverlay } from 'react-aria-components'
import { useShortcutOverlay, shortcutPlatform } from './lib/useShortcuts'
import { handleShortcutBindings } from './lib/shortcuts'
import { ZoomIndicator } from './components/ZoomIndicator'
import { Tip } from './components/Tip'

export function createStore<T>(initial: T) {
  let value = initial
  const subs = new Set<() => void>()
  return {
    get: () => value,
    set(next: T) {
      value = next
      subs.forEach((s) => s())
    },
    subscribe(s: () => void) {
      subs.add(s)
      return () => {
        subs.delete(s)
      }
    }
  }
}

// ---------- toasts ----------

type ToastKind = 'error' | 'info' | 'success'
interface ToastAction {
  label: string
  run: () => void
}
interface ToastItem {
  id: number
  kind: ToastKind
  text: string
  actions?: ToastAction[]
  brief?: boolean
}

const toastStore = createStore<ToastItem[]>([])
let toastId = 0

function dismissToast(id: number) {
  toastStore.set(toastStore.get().filter((t) => t.id !== id))
}

/** Errors stay until clicked; messages with buttons wait longer so they can be used. */
function toastDuration(t: ToastItem) {
  if (t.actions) return 10000
  if (t.brief) return 1500
  return t.kind === 'error' ? null : 5000
}

function showToast(kind: ToastKind, text: string, actions?: ToastAction[], brief?: boolean) {
  const id = ++toastId
  toastStore.set([...toastStore.get(), { id, kind, text, actions, brief }].slice(-4))
}

export const toast = {
  error: (text: string) => showToast('error', text),
  info: (text: string) => showToast('info', text),
  success: (text: string) => showToast('success', text),
  /** A quick confirmation that needs no reading time, such as "Copied". */
  brief: (text: string) => showToast('success', text, undefined, true),
  /** A success message with buttons; any button dismisses the toast. */
  withActions: (text: string, actions: ToastAction[]) => showToast('success', text, actions)
}

function ToastView({ t }: { t: ToastItem }) {
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    const ms = toastDuration(t)
    if (paused || ms === null) return
    const timer = setTimeout(() => dismissToast(t.id), ms)
    return () => clearTimeout(timer)
  }, [paused, t.id])
  return (
    <Tip label="Click to dismiss" focusable={false}>
      <div
        className={`toast ${t.kind}`}
        onClick={() => dismissToast(t.id)}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {t.text}
        {t.actions && (
          <div className="toast-actions">
            {t.actions.map((a) => (
              <button
                key={a.label}
                className="btn"
                onClick={(e) => {
                  e.stopPropagation()
                  dismissToast(t.id)
                  a.run()
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </Tip>
  )
}

export function Toasts() {
  const items = useSyncExternalStore(toastStore.subscribe, toastStore.get)
  return (
    <div className="toasts">
      {items.map((t) => (
        <ToastView key={t.id} t={t} />
      ))}
      <ZoomIndicator />
    </div>
  )
}

// ---------- modal ----------

/**
 * A modal dialog (React Aria): traps Tab, closes on Escape or a click outside, hides the rest of
 * the page from screen readers and gives focus back to whatever had it before.
 */
export function Modal({
  title,
  onClose,
  children,
  width = 440,
  overlayClassName
}: {
  title: string
  onClose: () => void
  children: ReactNode
  width?: number
  /** Extra class on the backdrop (e.g. `see-through`). */
  overlayClassName?: string
}) {
  useShortcutOverlay('dialog')
  return (
    <ModalOverlay className={`modal-backdrop ${overlayClassName ?? ''}`} isOpen isDismissable onOpenChange={(open) => !open && onClose()}>
      <AriaModal className="modal" style={{ width }}>
        <Dialog className="modal-dialog">
          <Heading slot="title" level={2}>
            {title}
          </Heading>
          {children}
        </Dialog>
      </AriaModal>
    </ModalOverlay>
  )
}

// ---------- prompt / confirm ----------

export interface PromptOptions {
  title: string
  message?: string
  label?: string
  initial?: string
  placeholder?: string
  ok?: string
  checkbox?: string
  checked?: boolean
  multiline?: boolean
  /** Allow submitting an empty value. */
  optional?: boolean
  validate?: (v: string) => string | null
}
export interface PromptResult {
  value: string
  checked: boolean
}
export interface ConfirmOptions {
  title: string
  message: string
  ok?: string
  danger?: boolean
}

export interface ChoicesOptions {
  title: string
  message: string
  ok?: string
  checks: { id: string; label: string; checked?: boolean }[]
}

type DialogReq =
  | (PromptOptions & { kind: 'prompt'; resolve: (v: PromptResult | null) => void })
  | (ConfirmOptions & { kind: 'confirm'; resolve: (v: boolean) => void })
  | (ChoicesOptions & { kind: 'choices'; resolve: (v: Record<string, boolean> | null) => void })

const dialogStore = createStore<DialogReq | null>(null)

/** A confirmation with checkboxes; resolves with each box's state, or null when cancelled. */
export const confirmWithChoices = (opts: ChoicesOptions) =>
  new Promise<Record<string, boolean> | null>((resolve) => dialogStore.set({ ...opts, kind: 'choices', resolve }))

export const prompt = (opts: PromptOptions) =>
  new Promise<PromptResult | null>((resolve) => dialogStore.set({ ...opts, kind: 'prompt', resolve }))

export const confirm = (opts: ConfirmOptions) => new Promise<boolean>((resolve) => dialogStore.set({ ...opts, kind: 'confirm', resolve }))

export function DialogHost() {
  const req = useSyncExternalStore(dialogStore.subscribe, dialogStore.get)
  if (!req) return null
  return req.kind === 'prompt' ? (
    <PromptDialog key={Math.random()} req={req} />
  ) : req.kind === 'choices' ? (
    <ChoicesDialog req={req} />
  ) : (
    <ConfirmDialog req={req} />
  )
}

function ChoicesDialog({ req }: { req: Extract<DialogReq, { kind: 'choices' }> }) {
  const [state, setState] = useState(() => Object.fromEntries(req.checks.map((c) => [c.id, c.checked ?? false])))
  const okRef = useRef<HTMLButtonElement>(null)
  useEffect(() => okRef.current?.focus(), [])
  return (
    <Modal title={req.title} onClose={() => close(req.resolve, null)}>
      <p className="modal-msg">{req.message}</p>
      {req.checks.map((c) => (
        <label key={c.id} className="check">
          <input type="checkbox" checked={state[c.id]} onChange={(e) => setState({ ...state, [c.id]: e.target.checked })} />
          {c.label}
        </label>
      ))}
      <div className="modal-actions">
        <button className="btn" onClick={() => close(req.resolve, null)}>
          Cancel
        </button>
        <button ref={okRef} className="btn primary" onClick={() => close(req.resolve, state)}>
          {req.ok ?? 'OK'}
        </button>
      </div>
    </Modal>
  )
}

function close<T>(resolve: (v: T) => void, value: T) {
  dialogStore.set(null)
  resolve(value)
}

function PromptDialog({ req }: { req: Extract<DialogReq, { kind: 'prompt' }> }) {
  const [value, setValue] = useState(req.initial ?? '')
  const [checked, setChecked] = useState(req.checked ?? false)
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const error = value.trim() ? (req.validate?.(value.trim()) ?? null) : null
  const canSubmit = (req.optional || !!value.trim()) && !error

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = () => canSubmit && close(req.resolve, { value: value.trim(), checked })
  const Input = req.multiline ? 'textarea' : 'input'

  return (
    <Modal title={req.title} onClose={() => close(req.resolve, null)}>
      {req.message && <p className="modal-msg">{req.message}</p>}
      <label className="field">
        {req.label && <span>{req.label}</span>}
        <Input
          ref={inputRef}
          value={value}
          placeholder={req.placeholder}
          spellCheck={false}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) =>
            handleShortcutBindings(
              e,
              [
                {
                  id: 'submit',
                  keys: req.multiline ? 'Mod+Enter' : ['Enter', 'Mod+Enter'],
                  allowInInput: true,
                  enabled: canSubmit,
                  run: submit
                }
              ],
              { editing: true },
              shortcutPlatform()
            )
          }
        />
        {error && <span className="field-error">{error}</span>}
      </label>
      {req.checkbox && (
        <label className="check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          {req.checkbox}
        </label>
      )}
      <div className="modal-actions">
        <button className="btn" onClick={() => close(req.resolve, null)}>
          Cancel
        </button>
        <button className="btn primary" disabled={!canSubmit} onClick={submit}>
          {req.ok ?? 'OK'}
        </button>
      </div>
    </Modal>
  )
}

function ConfirmDialog({ req }: { req: Extract<DialogReq, { kind: 'confirm' }> }) {
  const okRef = useRef<HTMLButtonElement>(null)
  useEffect(() => okRef.current?.focus(), [])
  return (
    <Modal title={req.title} onClose={() => close(req.resolve, false)}>
      <p className="modal-msg">{req.message}</p>
      <div className="modal-actions">
        <button className="btn" onClick={() => close(req.resolve, false)}>
          Cancel
        </button>
        <button ref={okRef} className={`btn ${req.danger ? 'danger' : 'primary'}`} onClick={() => close(req.resolve, true)}>
          {req.ok ?? 'OK'}
        </button>
      </div>
    </Modal>
  )
}
