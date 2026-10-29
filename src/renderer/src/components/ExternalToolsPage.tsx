import { useEffect, useState } from 'react'
import { AUTO_EDITOR, CUSTOM_EDITOR, EDITOR_PRESETS } from '../../../shared/editors'
import { api } from '../api'
import { updateSettings, useSettings } from '../settings'
import { ConfigInput, Field } from './prefsFields'

/** Programs Oak hands files to. Oak settings, not git config (the git editor is on the Git page). */
export function ExternalToolsPage() {
  const s = useSettings()
  const [found, setFound] = useState<ReadonlySet<string> | null>(null)

  useEffect(() => {
    api.findExecutables(EDITOR_PRESETS.map((p) => p.exe)).then((names) => setFound(new Set(names)))
  }, [])

  return (
    <>
      <h4>Editor</h4>
      <Field label="Open in editor" hint="Files open at the line; the repository opens as a folder">
        <select className="select" value={s.externalEditor} onChange={(e) => updateSettings({ externalEditor: e.target.value })}>
          <option value={AUTO_EDITOR}>Automatic (first installed, else the default app)</option>
          {EDITOR_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
              {found && !found.has(p.exe) ? ' (not found)' : ''}
            </option>
          ))}
          <option value={CUSTOM_EDITOR}>Custom command…</option>
        </select>
      </Field>
      {s.externalEditor === CUSTOM_EDITOR && (
        <Field label="Command" hint="{file} is the full path, {line} the line number">
          <ConfigInput
            value={s.externalEditorCommand}
            placeholder='zed "{file}:{line}"'
            onSave={(v) => updateSettings({ externalEditorCommand: v.trim() })}
          />
        </Field>
      )}
    </>
  )
}
