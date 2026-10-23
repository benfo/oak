import { useEffect, useRef, useState, type ReactNode } from 'react'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="prefs-field">
      <span className="prefs-label">
        {label}
        {hint && <span className="prefs-hint">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

/** A text field for a stored value: saves on Enter or when focus leaves (or the dialog closes), not per keystroke. */
export function ConfigInput({ value, placeholder, onSave }: { value: string | null | undefined; placeholder: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value ?? '')
  const latest = useRef({ draft, value, onSave })
  latest.current = { draft, value, onSave }
  useEffect(() => setDraft(value ?? ''), [value])
  const save = () => {
    const { draft, value, onSave } = latest.current
    if (draft.trim() !== (value ?? '')) onSave(draft)
  }
  useEffect(() => () => save(), [])
  return (
    <input
      className="input"
      value={draft}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === 'Enter' && save()}
    />
  )
}
