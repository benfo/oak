import { getSettings, updateSettings } from './settings'
import { api, errorMessage } from './api'
import type { RepoCtx } from './useRepo'
import { confirm, prompt, toast } from './ui'
import type { Branch, CheckoutKind, Commit, PullMode, ResetMode } from '../../shared/types'

const short = (h: string) => h.slice(0, 8)

export function validRefName(v: string) {
  if (/[\s~^:?*[\\]|\.\.|@\{|^[-/.]|[/.]$|\.lock$|\/\//.test(v)) return 'Not a valid Git ref name'
  return null
}

/** Conflicts need no message: Changes opens by itself and shows them. */
function reportOpError(r: RepoCtx, e: unknown) {
  const msg = errorMessage(e)
  if (!/conflict/i.test(msg)) toast.error(msg)
}

async function runOp(r: RepoCtx, label: string, fn: () => Promise<unknown>, success?: string) {
  try {
    await r.withBusy(label, fn)
    if (success) toast.success(success)
  } catch (e) {
    reportOpError(r, e)
  }
}

// ---------- branches ----------

export async function checkout(r: RepoCtx, ref: string, kind: CheckoutKind) {
  await r.run(`Checking out ${ref}`, () => api.checkout(r.path, ref, kind))
}

export async function newBranch(r: RepoCtx, start?: string, startLabel?: string, name?: string) {
  const res = await prompt({
    title: 'Create branch',
    message: start ? `Starting at ${startLabel ?? short(start)}` : 'Starting at the current HEAD',
    label: 'Branch name',
    placeholder: 'feature/my-change',
    initial: name,
    checkbox: 'Check out the new branch',
    checked: true,
    ok: 'Create',
    validate: validRefName
  })
  if (res) await r.run('Creating branch', () => api.createBranch(r.path, res.value, start ?? null, res.checked))
}

export async function renameBranch(r: RepoCtx, b: Branch) {
  const res = await prompt({ title: 'Rename branch', label: 'New name', initial: b.name, ok: 'Rename', validate: validRefName })
  if (res && res.value !== b.name) await r.run('Renaming branch', () => api.renameBranch(r.path, b.name, res.value))
}

export async function deleteBranch(r: RepoCtx, name: string) {
  if (!(await confirm({ title: 'Delete branch', message: `Delete the local branch "${name}"?`, ok: 'Delete', danger: true }))) return
  try {
    await r.withBusy('Deleting branch', () => api.deleteBranch(r.path, name, false))
  } catch (e) {
    const msg = errorMessage(e)
    if (!/not fully merged/i.test(msg)) return toast.error(msg)
    const force = await confirm({
      title: 'Branch not fully merged',
      message: `"${name}" has commits that aren't merged anywhere else. Delete it anyway? Those commits may be lost.`,
      ok: 'Force delete',
      danger: true
    })
    if (force) await r.run('Deleting branch', () => api.deleteBranch(r.path, name, true))
  }
}

export async function deleteRemoteBranch(r: RepoCtx, name: string) {
  const ok = await confirm({ title: 'Delete remote branch', message: `Delete "${name}" on the remote? This affects everyone using it.`, ok: 'Delete', danger: true })
  if (ok) await r.run('Deleting remote branch', () => api.deleteRemoteBranch(r.path, name))
}

export async function merge(r: RepoCtx, ref: string, label = ref) {
  const into = r.status?.branch ?? 'HEAD'
  if (!(await confirm({ title: 'Merge', message: `Merge ${label} into ${into}?`, ok: 'Merge' }))) return
  try {
    const out = await r.withBusy('Merging', () => api.merge(r.path, ref))
    if (/already up.to.date/i.test(out)) toast.info(`Nothing to merge: ${into} already contains ${label}`)
    else toast.success(`Merged ${label}`)
  } catch (e) {
    reportOpError(r, e)
  }
}

export async function rebase(r: RepoCtx, onto: string, label = onto) {
  const cur = r.status?.branch ?? 'HEAD'
  if (await confirm({ title: 'Rebase', message: `Rebase ${cur} onto ${label}? This rewrites the commits on ${cur}.`, ok: 'Rebase' }))
    await runOp(r, 'Rebasing', () => api.rebase(r.path, onto), `Rebased onto ${label}`)
}

// ---------- commits ----------

export async function cherryPick(r: RepoCtx, c: Commit) {
  await runOp(r, 'Cherry-picking', () => api.cherryPick(r.path, c.hash, c.parents.length > 1), `Cherry-picked ${short(c.hash)}`)
}

export async function revert(r: RepoCtx, c: Commit) {
  if (await confirm({ title: 'Revert commit', message: `Create a new commit that undoes "${c.subject}"?`, ok: 'Revert' }))
    await runOp(r, 'Reverting', () => api.revert(r.path, c.hash, c.parents.length > 1), `Reverted ${short(c.hash)}`)
}

const RESET_TEXT: Record<ResetMode, string> = {
  soft: 'Keeps all changes staged.',
  mixed: 'Keeps all changes in the working tree, unstaged.',
  hard: 'DISCARDS all uncommitted changes and the commits after this one. This cannot be undone.'
}

export async function reset(r: RepoCtx, c: Commit, mode: ResetMode) {
  const branch = r.status?.branch ?? 'HEAD'
  const ok = await confirm({
    title: `${mode[0].toUpperCase() + mode.slice(1)} reset`,
    message: `Reset ${branch} to ${short(c.hash)} "${c.subject}"?\n\n${RESET_TEXT[mode]}`,
    ok: 'Reset',
    danger: mode === 'hard'
  })
  if (ok) await r.run('Resetting', () => api.reset(r.path, c.hash, mode))
}

export async function createTag(r: RepoCtx, hash: string) {
  const res = await prompt({
    title: 'Create tag',
    message: `At ${short(hash)}`,
    label: 'Tag name',
    placeholder: 'v1.0.0',
    ok: 'Create',
    validate: validRefName
  })
  if (!res) return
  const msg = await prompt({ title: 'Tag message', message: 'Optional: enter a message to create an annotated tag.', label: 'Message', ok: 'Create', multiline: true, optional: true })
  if (!msg) return
  await r.run('Creating tag', () => api.createTag(r.path, res.value, hash, msg?.value ?? ''))
}

export async function deleteTag(r: RepoCtx, name: string) {
  if (await confirm({ title: 'Delete tag', message: `Delete the local tag "${name}"?`, ok: 'Delete', danger: true }))
    await r.run('Deleting tag', () => api.deleteTag(r.path, name))
}

// ---------- remotes ----------

export async function fetchAll(r: RepoCtx) {
  await runOp(r, 'Fetching', () => api.fetch(r.path, getSettings().fetchPrune), 'Fetched')
}

/** Pull; without a mode, the Preferences default (which itself defaults to git config). */
export async function pull(r: RepoCtx, mode: PullMode = getSettings().pullMode) {
  try {
    await r.withBusy('Pulling', () => api.pull(r.path, mode))
    toast.success('Pulled')
  } catch (e) {
    const msg = errorMessage(e)
    if (/divergent|reconcile/i.test(msg)) toast.error('Your branch and its upstream have diverged. Use the Pull menu to choose Merge or Rebase.')
    else if (/no tracking information/i.test(msg)) toast.error('This branch has no upstream yet. Push it first.')
    else reportOpError(r, e)
  }
}

export async function push(r: RepoCtx) {
  try {
    const prUrl = await r.withBusy('Pushing', () => api.push(r.path, false))
    if (prUrl && getSettings().pullRequestPrompt) {
      toast.withActions('Pushed', [
        { label: 'Open pull request', run: () => void api.openUrl(prUrl) },
        { label: 'Don’t show again', run: () => { updateSettings({ pullRequestPrompt: false }); toast.info('Turn this back on in Preferences → Git.') } }
      ])
    } else toast.success('Pushed')
  } catch (e) {
    const msg = errorMessage(e)
    if (!/rejected|non-fast-forward|fetch first/i.test(msg)) return toast.error(msg)
    const force = await confirm({
      title: 'Push rejected',
      message: 'The remote has commits you don’t have locally. Pull first to combine them, or force push (with lease) to overwrite the remote branch.',
      ok: 'Force push',
      danger: true
    })
    if (force) await r.run('Force pushing', () => api.push(r.path, true))
  }
}

export async function openPullRequest(r: RepoCtx, branch?: string) {
  try {
    await api.openUrl(await api.pullRequestUrl(r.path, branch))
  } catch (e) {
    toast.error(errorMessage(e))
  }
}

export async function pushTag(r: RepoCtx, name: string) {
  await runOp(r, 'Pushing tag', () => api.pushTag(r.path, name), `Pushed ${name}`)
}

// ---------- stash ----------

export async function stash(r: RepoCtx) {
  const res = await prompt({ title: 'Stash changes', message: 'Includes untracked files.', label: 'Message (optional)', ok: 'Stash', optional: true })
  if (res) await r.run('Stashing', () => api.stash(r.path, res.value.trim()))
}

export async function stashPop(r: RepoCtx, ref?: string) {
  await runOp(r, 'Popping stash', () => api.stashPop(r.path, ref))
}

export async function stashApply(r: RepoCtx, ref: string) {
  await runOp(r, 'Applying stash', () => api.stashApply(r.path, ref))
}

export async function stashDrop(r: RepoCtx, ref: string, message: string) {
  if (await confirm({ title: 'Drop stash', message: `Permanently delete ${ref} "${message}"?`, ok: 'Drop', danger: true }))
    await r.run('Dropping stash', () => api.stashDrop(r.path, ref))
}
