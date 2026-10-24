import { useEffect, useState } from 'react'
import { hueOf, initials } from '../lib/format'
import { useSettings, type AvatarSource } from '../settings'

/*
 * Author pictures. GitHub noreply addresses (what most GitHub users commit with) name the account,
 * so their picture needs no lookup; anything else can come from Gravatar, which is asked by a SHA-256
 * hash of the email. Initials are the fallback (and what shows while a picture loads).
 */

const GITHUB_NOREPLY = /^(?:(\d+)\+)?([^@]+)@users\.noreply\.github\.com$/i

const hashes = new Map<string, Promise<string>>()
function sha256(text: string) {
  let hash = hashes.get(text)
  if (!hash) {
    hash = crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(text))
      .then((buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join(''))
    hashes.set(text, hash)
  }
  return hash
}

/** The picture URL for an email, or null when the chosen sources have none. Sizes are in device pixels. */
async function avatarUrl(email: string, source: AvatarSource, px: number): Promise<string | null> {
  if (source === 'off') return null
  const e = email.trim().toLowerCase()
  const gh = GITHUB_NOREPLY.exec(e)
  if (gh) return gh[1] ? `https://avatars.githubusercontent.com/u/${gh[1]}?s=${px}&v=4` : `https://github.com/${gh[2]}.png?size=${px}`
  if (source === 'github' || !e.includes('@')) return null
  return `https://gravatar.com/avatar/${await sha256(e)}?s=${px}&d=404`
}

/** URLs that failed once this session (no picture, offline): not asked for again. */
const failed = new Set<string>()

export function Avatar({ name, email, size }: { name: string; email: string; size: number }) {
  const { avatars } = useSettings()
  const [url, setUrl] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    avatarUrl(email, avatars, Math.round(size * window.devicePixelRatio * 1.5)).then(
      (u) => !cancelled && setUrl(u && !failed.has(u) ? u : null)
    )
    return () => {
      cancelled = true
    }
  }, [email, avatars, size])

  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.37),
        background: `hsl(${hueOf(email)} var(--avatar-sat) var(--avatar-light))`
      }}
      aria-hidden
    >
      {size >= 20 && initials(name)}
      {url && (
        <img
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          className={loaded ? 'loaded' : ''}
          onLoad={() => setLoaded(true)}
          onError={() => {
            failed.add(url)
            setUrl(null)
          }}
        />
      )}
    </span>
  )
}
