/** Which identity a commit will carry, and when the status bar should say so. Pure, so it is unit tested without a UI. */

export type ConfigValues = Record<string, string | null | undefined>

export interface Identity {
  name: string | null
  email: string | null
  /** This repository sets its own name or email, instead of using the global ones. */
  repoSpecific: boolean
  /** A commit needs both a name and an email. */
  missing: boolean
  /** The global identity, shown when this repository overrides it. */
  global: { name: string | null; email: string | null }
}

const value = (config: ConfigValues, key: string) => config[key]?.trim() || null

/** The identity in effect: the repository's own value wins over the global one, key by key. */
export function repoIdentity(global: ConfigValues, local: ConfigValues): Identity {
  const name = value(local, 'user.name') ?? value(global, 'user.name')
  const email = value(local, 'user.email') ?? value(global, 'user.email')
  return {
    name,
    email,
    repoSpecific: !!(value(local, 'user.name') || value(local, 'user.email')),
    missing: !name || !email,
    global: { name: value(global, 'user.name'), email: value(global, 'user.email') }
  }
}

/**
 * The status bar's line, only when the identity is worth noticing: missing (a commit would fail or
 * guess), or set for this repository alone (the work versus personal mix-up). The ordinary case is silent.
 */
export function identityBarText(id: Identity): string | null {
  if (id.missing) return 'No git identity'
  return id.repoSpecific ? `Committing as ${id.name}` : null
}

/** "Name <email>", tolerating a half-set identity. */
export const identityLabel = (name: string | null, email: string | null) => [name, email && `<${email}>`].filter(Boolean).join(' ')
