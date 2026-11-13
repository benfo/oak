import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reportTask, settleTasks, startTasks } from '../src/shared/taskList.ts'

const tasks = [
  { id: 'a', label: 'First' },
  { id: 'b', label: 'Second' },
  { id: 'c', label: 'Third' }
]

test('tasks start waiting and take each report in turn', () => {
  let rows = startTasks(tasks)
  assert.deepEqual(
    rows.map((row) => row.state),
    ['waiting', 'waiting', 'waiting']
  )
  rows = reportTask(rows, 'a', 'running')
  assert.equal(rows[0].state, 'running')
  rows = reportTask(rows, 'a', { done: 'freed 2 KB' })
  assert.deepEqual(rows[0], { id: 'a', label: 'First', state: 'done', note: 'freed 2 KB' })
  assert.equal(rows[1].state, 'waiting')
})

test('when the work stops, a failed task keeps its reason and unfinished ones are skipped', () => {
  let rows = reportTask(startTasks(tasks), 'a', { done: 'done' })
  rows = reportTask(reportTask(rows, 'b', 'running'), 'b', { failed: 'locked' })
  assert.deepEqual(
    settleTasks(rows).map((row) => [row.state, row.note]),
    [
      ['done', 'done'],
      ['failed', 'locked'],
      ['skipped', 'skipped']
    ]
  )
})
