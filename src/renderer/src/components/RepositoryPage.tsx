import { useRef, useState } from 'react'
import { ListBox, ListBoxItem, type Key, type Selection } from 'react-aria-components'
import type { RepoCtx } from '../useRepo'
import { useActiveRepo } from '../sidebar/activeRepo'
import { branchesHiddenBy, hiddenBranchCount, hiddenBranchRefs, type SidebarBranchOptions } from '../sidebar/sidebarBranches'
import { Field } from './prefsFields'

const PREVIEW_LIMIT = 100
const branchCount = (n: number) => `${n} ${n === 1 ? 'branch' : 'branches'}`
const optionKey = (el: Element | null) => el?.closest<HTMLElement>('[role=option]')?.dataset.key

/** Branch display settings for the open repository. They are kept per repository and apply as you change them. */
export function RepositoryPage() {
  const r = useActiveRepo()
  if (!r) return <p className="prefs-note">Open a repository to change its settings.</p>
  return <RepositorySettings r={r} />
}

function RepositorySettings({ r }: { r: RepoCtx }) {
  const options = r.branchOptions
  const patterns = options.hiddenPatterns
  const current = r.status?.branch
  const update = (change: Partial<SidebarBranchOptions>) => r.setBranchOptions({ ...options, ...change })
  const [draft, setDraft] = useState('')
  const [selected, setSelected] = useState<Selection>(new Set())
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const editingRef = useRef<string | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const pattern = draft.trim()
  const duplicate = patterns.includes(pattern)
  const remoteOnlyCount = hiddenBranchRefs(r.branches, current, { ...options, hiddenPatterns: [], hideRemoteOnly: true }, r.remoteHead).size
  const selectedKeys = selected === 'all' ? new Set<Key>(patterns) : selected
  const previewKey = focusedKey && patterns.includes(focusedKey) ? focusedKey : null
  const preview = previewKey ? branchesHiddenBy(r.branches, current, previewKey) : []

  const add = () => {
    if (!pattern || duplicate) return
    update({ hiddenPatterns: [...patterns, pattern] })
    setDraft('')
  }
  const remove = (keys: Set<Key>) => {
    if (!keys.size) return
    const left = patterns.filter((p) => !keys.has(p))
    update({ hiddenPatterns: left, showHidden: left.length || options.hideRemoteOnly ? options.showHidden : false })
    setSelected(new Set())
  }
  const focusRow = (key: string) =>
    requestAnimationFrame(() =>
      Array.from(frameRef.current?.querySelectorAll<HTMLElement>('[role=option]') ?? [])
        .find((el) => el.dataset.key === key)
        ?.focus()
    )
  const startEdit = (key: string) => {
    editingRef.current = key
    setEditing(key)
    setEditDraft(key)
  }
  const finishEdit = (save: boolean) => {
    const from = editingRef.current
    if (from === null) return
    editingRef.current = null
    setEditing(null)
    const next = editDraft.trim()
    const renamed = save && !!next && next !== from && !patterns.includes(next)
    if (renamed) update({ hiddenPatterns: patterns.map((p) => (p === from ? next : p)) })
    focusRow(renamed ? next : from)
  }

  const hint = !pattern
    ? 'Use * as a wildcard, for example dependabot/* or *-wip. A name without * hides just that branch.'
    : duplicate
      ? 'Already hidden.'
      : `Matches ${branchCount(hiddenBranchCount(r.branches, current, [pattern]))} now.`

  return (
    <>
      <p className="prefs-note">
        Settings for <strong>{r.name}</strong>. The checked-out branch always stays visible. Pickers and the palette still list hidden
        branches.
      </p>
      <Field label="Sort branches">
        <select className="select" value={options.sort} onChange={(e) => update({ sort: e.target.value === 'latest' ? 'latest' : 'name' })}>
          <option value="name">By name</option>
          <option value="latest">By latest commit</option>
        </select>
      </Field>
      <label className="check">
        <input type="checkbox" checked={options.hideGone} onChange={(e) => update({ hideGone: e.target.checked })} />
        Hide branches with a gone upstream
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={options.hideRemoteOnly}
          onChange={(e) => update({ hideRemoteOnly: e.target.checked, showHidden: false })}
        />
        Hide remote branches without a local copy ({remoteOnlyCount} now)
      </label>
      <p className="prefs-note">
        Remote branches stay visible when a local branch tracks them or shares their name, and for the remote&apos;s default branch.
      </p>
      <h4>Hidden branches</h4>
      <div className="field">
        <span>Hide branches matching</span>
        <div className="input-row">
          <input
            className="input"
            aria-label="Branch name pattern"
            value={draft}
            placeholder="dependabot/*"
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault()
                add()
              }
            }}
          />
          <button className="btn" disabled={!pattern || duplicate} onClick={add}>
            Hide
          </button>
        </div>
        <span className="hidden-branches-hint">{hint}</span>
      </div>
      <div
        ref={frameRef}
        className="pane-frame hidden-branches-frame"
        onFocusCapture={(e) => {
          const key = optionKey(e.target as Element)
          if (key) setFocusedKey(key)
        }}
        onKeyDownCapture={(e) => {
          const target = e.target as HTMLElement
          if (target.tagName === 'INPUT' || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return
          const key = optionKey(target)
          if (e.key === 'Delete') {
            e.preventDefault()
            remove(selectedKeys.size ? selectedKeys : new Set<Key>(key ? [key] : []))
          } else if ((e.key === 'F2' || e.key === 'Enter') && key) {
            e.preventDefault()
            e.stopPropagation()
            startEdit(key)
          }
        }}
      >
        <ListBox
          className="hidden-branches-list"
          data-pane="hidden-branches"
          aria-label="Hidden branch patterns"
          selectionMode="multiple"
          selectedKeys={selected}
          onSelectionChange={setSelected}
          renderEmptyState={() => <div className="pane-empty">No hidden branches yet.</div>}
        >
          {patterns.map((p) => (
            <ListBoxItem key={p} id={p} textValue={p} className="hidden-pattern-row" onDoubleClick={() => startEdit(p)}>
              {editing === p ? (
                <input
                  className="input"
                  aria-label={`Edit pattern ${p}`}
                  autoFocus
                  value={editDraft}
                  spellCheck={false}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onBlur={() => finishEdit(true)}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) finishEdit(true)
                    else if (e.key === 'Escape') {
                      e.preventDefault()
                      finishEdit(false)
                    }
                  }}
                />
              ) : (
                <>
                  <code>{p}</code>
                  <span className="muted small">{branchCount(hiddenBranchCount(r.branches, current, [p]))}</span>
                </>
              )}
            </ListBoxItem>
          ))}
        </ListBox>
      </div>
      <div className="hidden-branches-preview small muted" role="region" aria-label="Branches the pattern hides">
        {previewKey ? (
          preview.length ? (
            <>
              <strong>{previewKey}</strong> hides {preview.slice(0, PREVIEW_LIMIT).join(', ')}
              {preview.length > PREVIEW_LIMIT ? ` and ${preview.length - PREVIEW_LIMIT} more` : ''}
            </>
          ) : (
            <>
              <strong>{previewKey}</strong> matches no branches right now.
            </>
          )
        ) : (
          'Move to a pattern to see the branches it hides. Enter or F2 edits it, Delete stops hiding it.'
        )}
      </div>
      <div className="prefs-row">
        <label className="check">
          <input
            type="checkbox"
            checked={options.showHidden}
            disabled={!patterns.length && !options.hideRemoteOnly}
            onChange={(e) => update({ showHidden: e.target.checked })}
          />
          Show hidden branches for now
        </label>
        <span className="spacer" />
        <button className="btn" disabled={!selectedKeys.size} onClick={() => remove(selectedKeys)}>
          Stop hiding selected
        </button>
      </div>
    </>
  )
}
