import { useEffect, useReducer, useRef, useSyncExternalStore } from 'react'
import { formatElapsed, outputLines } from '../lib/output'
import type { OpState } from '../useRepo'
import { createStore, Modal } from '../ui'

/** Seconds since `since`, ticking once a second. */
export function Elapsed({ since, until }: { since: number; until?: number }) {
  const [, tick] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    if (until) return
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [until])
  return <>{formatElapsed((until ?? Date.now()) - since)}</>
}

/** Scrolling log of an operation's output, kept pinned to the bottom while it grows. */
export function OutputLog({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLPreElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [text])
  const lines = outputLines(text)
  return (
    <pre ref={ref} className={`op-output ${className ?? ''}`} tabIndex={0} aria-label="Command output">
      {lines.length ? lines.join('\n') : 'No output yet.'}
    </pre>
  )
}

// The output dialog is opened from the toolbar; it reads the live op from the store below.
const outputOpen = createStore(false)
export const showOutput = () => outputOpen.set(true)

export function OutputDialog({ op }: { op: OpState | null }) {
  const open = useSyncExternalStore(outputOpen.subscribe, outputOpen.get)
  if (!open) return null
  return (
    <Modal
      title={op ? `${op.label}${op.finished ? (op.ok ? ' — done' : ' — failed') : '…'}` : 'Output'}
      onClose={() => outputOpen.set(false)}
      width={720}
    >
      {op ? (
        <>
          <p className="modal-msg">
            {op.finished ? 'Took' : 'Running for'} <Elapsed since={op.started} until={op.finished} />
          </p>
          <OutputLog text={op.output} className="tall" />
        </>
      ) : (
        <p className="modal-msg">No operation has run yet.</p>
      )}
      <div className="modal-actions">
        <button className="btn primary" onClick={() => outputOpen.set(false)}>
          Close
        </button>
      </div>
    </Modal>
  )
}
