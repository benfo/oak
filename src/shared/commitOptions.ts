/** Whether to sign a commit: follow `commit.gpgsign` (default), force a signature, or force none. */
export type SignMode = 'default' | 'sign' | 'skip'

/** The per-commit options behind the Commit button's options menu. */
export interface CommitOptions {
  /** Skip the pre-commit and commit-msg hooks (and, when pushing along, the pre-push hook). */
  noVerify: boolean
  signoff: boolean
  sign: SignMode
  allowEmpty: boolean
}

export const NO_COMMIT_OPTIONS: CommitOptions = { noVerify: false, signoff: false, sign: 'default', allowEmpty: false }

/** The `git commit` flags for the options. */
export function commitFlags(o: CommitOptions): string[] {
  return [
    ...(o.noVerify ? ['--no-verify'] : []),
    ...(o.signoff ? ['--signoff'] : []),
    ...(o.sign === 'sign' ? ['--gpg-sign'] : o.sign === 'skip' ? ['--no-gpg-sign'] : []),
    ...(o.allowEmpty ? ['--allow-empty'] : [])
  ]
}

/** The subject of a work-in-progress commit made by Oak, which "Undo WIP commit" recognises. */
export const WIP_MESSAGE = 'WIP'

/** A WIP commit is a throwaway save point: no hooks, no signature prompt, no sign-off. */
export const WIP_OPTIONS: CommitOptions = { ...NO_COMMIT_OPTIONS, noVerify: true, sign: 'skip' }

export const isWipSubject = (subject: string) => /^WIP\b/i.test(subject.trim())
