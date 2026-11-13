import type { TaskRow, TaskState } from '../../../shared/taskList'
import { Icon, type IconName } from './Icon'

const SETTLED_ICON: Partial<Record<TaskState, IconName>> = { done: 'check', failed: 'x', skipped: 'minus' }

function TaskMark({ state }: { state: TaskState }) {
  const icon = SETTLED_ICON[state]
  if (icon) return <Icon name={icon} size={14} />
  return state === 'running' ? <span className="spinner" /> : <span className="task-waiting" />
}

/** Tasks running one after the other: each row shows where it stands, then its result. Rows never move. */
export function TaskList({ rows, label }: { rows: TaskRow[]; label: string }) {
  return (
    <ul className="task-list" aria-label={label} aria-live="polite">
      {rows.map((row) => (
        <li key={row.id} className="task-row" data-state={row.state}>
          <span className="task-mark" aria-hidden="true">
            <TaskMark state={row.state} />
          </span>
          <span className="task-label">{row.label}</span>
          {row.note && <span className="task-note">{row.note}</span>}
        </li>
      ))}
    </ul>
  )
}
