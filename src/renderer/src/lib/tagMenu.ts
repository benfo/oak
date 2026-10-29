import { copyText } from './copy'
import { showMenu } from '../api'
import * as act from '../actions'
import type { Branch, MenuItem } from '../../../shared/types'
import type { RepoCtx } from '../useRepo'

/** One definition for tag menus in the sidebar and History. */
export async function showTagMenu(r: RepoCtx, b: Branch, anchor?: Element | null) {
  const cur = r.status?.branch ?? 'HEAD'
  const items: MenuItem[] = [
    { id: 'checkout', label: 'Checkout (detached)' },
    { id: 'new', label: 'New branch from here…' },
    {
      label: 'Merge / Rebase',
      submenu: [
        { id: 'merge', label: `Merge into ${cur}` },
        { id: 'rebase', label: `Rebase ${cur} onto ${b.name}` }
      ]
    },
    { type: 'separator' },
    {
      label: 'Copy',
      submenu: [
        { id: 'copy', label: 'Tag name' },
        { id: 'copyhash', label: 'Commit hash' }
      ]
    },
    { type: 'separator' },
    {
      label: 'Manage',
      submenu: [
        { id: 'push', label: 'Push tag' },
        { id: 'delete', label: 'Delete…' }
      ]
    }
  ]
  const id = await showMenu(items, anchor)
  if (id === 'checkout') act.checkout(r, b.name, 'detached')
  else if (id === 'new') act.newBranch(r, b.name, b.name)
  else if (id === 'merge') act.merge(r, b.name)
  else if (id === 'rebase') act.rebase(r, b.name)
  else if (id === 'push') act.pushTag(r, b.name)
  else if (id === 'delete') act.deleteTag(r, b.name)
  else if (id === 'copy') copyText(b.name, 'tag name')
  else if (id === 'copyhash') copyText(b.hash, 'commit hash')
}
