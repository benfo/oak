/** Where a task in a running list stands. */
export type TaskState = 'waiting' | 'running' | 'done' | 'failed' | 'skipped'

export interface Task {
  id: string
  label: string
}

export interface TaskRow extends Task {
  state: TaskState
  /** The result once done, or why it failed. */
  note?: string
}

/** What the work reports about one task: it started, it finished with a result, or it failed with a reason. */
export type TaskUpdate = 'running' | { done: string } | { failed: string }

export const startTasks = (tasks: Task[]): TaskRow[] => tasks.map((task) => ({ ...task, state: 'waiting' }))

export function reportTask(rows: TaskRow[], id: string, update: TaskUpdate): TaskRow[] {
  return rows.map((row) => {
    if (row.id !== id) return row
    if (update === 'running') return { ...row, state: 'running' }
    return 'done' in update ? { ...row, state: 'done', note: update.done } : { ...row, state: 'failed', note: update.failed }
  })
}

/** Once the work has stopped, whatever never finished was skipped. */
export const settleTasks = (rows: TaskRow[]): TaskRow[] =>
  rows.map((row) => (row.state === 'waiting' || row.state === 'running' ? { ...row, state: 'skipped', note: 'skipped' } : row))
