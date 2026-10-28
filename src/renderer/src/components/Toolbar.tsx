import { Fragment, useEffect, useRef } from 'react'
import { Button, Menu, MenuItem, MenuTrigger, Popover, Separator, Toolbar as AriaToolbar } from 'react-aria-components'
import { api } from '../api'
import { toolbarHomeEnd } from '../lib/navigation'
import { MenuNavigation } from './MenuNavigation'
import * as act from '../actions'
import type { RepoCtx } from '../useRepo'
import type { PullMode } from '../../../shared/types'
import { Icon } from './Icon'
import { Elapsed, showOutput } from './OpStatus'
import { openPreferences } from './Preferences'
import { showBranchPicker, showRepoPicker } from '../pickers'
import { Tip } from './Tip'
import { LayoutMenu, type LayoutControls } from './LayoutMenu'

export function Toolbar({
  r,
  onSwitch,
  layoutControls
}: {
  r: RepoCtx
  onSwitch: (p: string | null) => void
  layoutControls: LayoutControls
}) {
  const st = r.status
  const barRef = useRef<HTMLDivElement>(null)
  useEffect(() => toolbarHomeEnd(barRef.current), [])
  const busy = !!r.busy
  const hasRemotes = r.branches.some((b) => b.type === 'remote')

  const branchLabel = st ? (st.branch ?? (st.head ? `detached @ ${st.head.slice(0, 7)}` : 'no commits')) : '…'

  return (
    <AriaToolbar ref={barRef} className="toolbar" aria-label="Repository actions" data-pane="toolbar">
      <Tip label={r.path}>
        <button className="tb-btn tb-repo" onClick={(e) => showRepoPicker(r.path, onSwitch, e.currentTarget)}>
          <Icon name="folder" />
          <span className="tb-repo-name">{r.name}</span>
          <Icon name="chevronDown" size={14} className="dim" />
        </button>
      </Tip>
      <Tip label={st?.upstream ? `Tracking ${st.upstream}` : 'No upstream branch'}>
        <button className="tb-branch" onClick={(e) => showBranchPicker(r, e.currentTarget)}>
          <Icon name="branch" />
          <span>{branchLabel}</span>
          {!!st?.ahead && <span className="pill">↑{st.ahead}</span>}
          {!!st?.behind && <span className="pill">↓{st.behind}</span>}
          <Icon name="chevronDown" size={12} className="dim" />
        </button>
      </Tip>
      {r.busy && r.op && (
        <Tip label="Show live output">
          <button className="tb-btn busy-chip" onClick={showOutput}>
            <span className="spinner" />
            {r.busy}… <Elapsed since={r.op.started} />
          </button>
        </Tip>
      )}
      <div className="spacer" />
      <div className="tb-group">
        <Tip label="Fetch all remotes" keys="Ctrl+Shift+F">
          <button className="tb-btn" disabled={busy || !hasRemotes} onClick={() => act.fetchAll(r)}>
            <Icon name="fetch" />
            Fetch
          </button>
        </Tip>
        <div className="tb-split">
          <Tip label={st?.upstream ? `Pull from ${st.upstream}` : 'No upstream branch'} keys={st?.upstream ? 'Ctrl+Shift+L' : undefined}>
            <button className="tb-btn" disabled={busy || !st?.upstream} onClick={() => act.pull(r)}>
              <Icon name="pull" />
              Pull
              {!!st?.behind && <span className="pill">{st.behind}</span>}
            </button>
          </Tip>
          <PullOptions r={r} disabled={busy || !st?.upstream} />
        </div>
        <Tip label={st?.upstream ? `Push to ${st.upstream}` : 'Push and set upstream'} keys="Ctrl+Shift+K">
          <button className="tb-btn" disabled={busy || !st?.branch} onClick={() => act.push(r)}>
            <Icon name="push" />
            Push
            {!!st?.ahead && <span className="pill">{st.ahead}</span>}
          </button>
        </Tip>
      </div>
      <div className="tb-group">
        <LayoutMenu {...layoutControls} />
        <RepositoryOptions r={r} />
        <Tip label="Preferences" keys="Ctrl+,">
          <button className="tb-btn" aria-label="Preferences" onClick={() => openPreferences()}>
            <Icon name="settings" />
          </button>
        </Tip>
      </div>
    </AriaToolbar>
  )
}

function RepositoryOptions({ r }: { r: RepoCtx }) {
  const actions = [
    { id: 'refresh', label: 'Refresh', keys: 'F5', run: () => r.refresh() },
    { id: 'terminal', label: 'Open terminal here', keys: 'Ctrl+`', run: () => api.openTerminal(r.path) },
    { id: 'explorer', label: 'Open in Explorer', keys: 'Ctrl+Shift+E', run: () => api.openPath(r.path) }
  ]
  return (
    <MenuTrigger>
      <Tip label="More actions">
        <Button className="tb-btn" aria-label="More actions">
          <Icon name="more" />
        </Button>
      </Tip>
      <Popover className="menu-popover" placement="bottom end" offset={6}>
        <MenuNavigation>
          <Menu
            className="menu"
            aria-label="Repository actions"
            onAction={(id) => {
              void actions.find((action) => action.id === id)?.run()
            }}
          >
            {actions.map((action) => (
              <MenuItem key={action.id} id={action.id} textValue={action.label} className="menu-item">
                <span className="menu-label">{action.label}</span>
                <span className="menu-help">{action.keys}</span>
              </MenuItem>
            ))}
          </Menu>
        </MenuNavigation>
      </Popover>
    </MenuTrigger>
  )
}

const PULL_OPTIONS: { id: PullMode | 'fetch'; label: string; help: string }[] = [
  { id: 'merge', label: 'Pull (merge)', help: 'Merge remote changes into your branch' },
  { id: 'rebase', label: 'Pull (rebase)', help: 'Replay your commits on top of the remote ones' },
  { id: 'ff-only', label: 'Pull (fast-forward only)', help: 'Only if no merge is needed' },
  { id: 'fetch', label: 'Fetch all remotes', help: 'Download without changing your branch' }
]

/** The ▾ next to Pull: a React Aria menu (themed, under its button, keyboard-first). */
function PullOptions({ r, disabled }: { r: RepoCtx; disabled: boolean }) {
  return (
    <MenuTrigger>
      <Tip label="Pull options">
        <Button className="tb-btn tb-chevron" aria-label="Pull options" isDisabled={disabled}>
          <Icon name="chevronDown" size={12} />
        </Button>
      </Tip>
      <Popover className="menu-popover" placement="bottom end" offset={6}>
        <MenuNavigation>
          <Menu className="menu" onAction={(id) => (id === 'fetch' ? act.fetchAll(r) : act.pull(r, id as PullMode))}>
            {PULL_OPTIONS.map((o) => (
              <Fragment key={o.id}>
                {o.id === 'fetch' && <Separator className="menu-separator" />}
                <MenuItem id={o.id} textValue={o.label} className="menu-item">
                  <span className="menu-label">{o.label}</span>
                  <span className="menu-help">{o.help}</span>
                </MenuItem>
              </Fragment>
            ))}
          </Menu>
        </MenuNavigation>
      </Popover>
    </MenuTrigger>
  )
}
