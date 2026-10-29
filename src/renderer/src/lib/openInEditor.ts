import { api } from '../api'
import { getSettings } from '../settings'
import { toast } from '../ui'

/**
 * Opens a file (at a line) or, without `file`, the repository folder in the editor chosen in Preferences > External tools.
 * `note` is shown once the editor has been launched, e.g. to say the line is approximate.
 */
export function openInEditor(repo: string, file: string | null, line?: number, note?: string) {
  const { externalEditor, externalEditorCommand } = getSettings()
  api
    .openInEditor(repo, file, line, { id: externalEditor, command: externalEditorCommand })
    .then(() => note && toast.info(note))
    .catch((e) => toast.error(e.message))
}
