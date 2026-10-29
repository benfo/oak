import type { MenuItem } from '../../../shared/types'
import { NO_COMMIT_OPTIONS, type CommitOptions, type SignMode } from '../../../shared/commitOptions.ts'

/** The options a commit starts with: nothing special, except that sign-off follows its Preference. */
export const freshCommitOptions = (signoffPreference: boolean): CommitOptions => ({ ...NO_COMMIT_OPTIONS, signoff: signoffPreference })

const SIGN_LABELS: Record<SignMode, string> = {
  default: 'Follow Git config',
  sign: 'Always sign',
  skip: 'Never sign'
}

export function commitOptionsMenu(o: CommitOptions): MenuItem[] {
  return [
    { id: 'no-verify', label: 'Skip hooks (--no-verify)', checked: o.noVerify },
    { id: 'signoff', label: 'Sign off', checked: o.signoff },
    {
      label: 'Sign commit',
      submenu: (Object.keys(SIGN_LABELS) as SignMode[]).map((mode) => ({
        id: `sign:${mode}`,
        label: SIGN_LABELS[mode],
        checked: o.sign === mode
      }))
    },
    { id: 'allow-empty', label: 'Allow empty commit', checked: o.allowEmpty }
  ]
}

/** The options after choosing a menu item (unknown ids change nothing). */
export function chooseCommitOption(o: CommitOptions, id: string): CommitOptions {
  if (id === 'no-verify') return { ...o, noVerify: !o.noVerify }
  if (id === 'signoff') return { ...o, signoff: !o.signoff }
  if (id === 'allow-empty') return { ...o, allowEmpty: !o.allowEmpty }
  if (id.startsWith('sign:')) return { ...o, sign: id.slice(5) as SignMode }
  return o
}

/** Short names for what differs from a fresh commit, shown beside the button so a one-shot option is never forgotten. */
export function activeOptionLabels(o: CommitOptions, signoffPreference: boolean): string[] {
  return [
    ...(o.noVerify ? ['Hooks skipped'] : []),
    ...(o.allowEmpty ? ['Empty allowed'] : []),
    ...(o.sign === 'sign' ? ['Signed'] : o.sign === 'skip' ? ['Unsigned'] : []),
    ...(o.signoff !== signoffPreference ? [o.signoff ? 'Signed off' : 'No sign-off'] : [])
  ]
}
