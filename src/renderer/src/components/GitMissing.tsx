import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { updateSettings } from '../settings'
import { Icon } from './Icon'

const DOWNLOAD_URL = 'https://git-scm.com/download/win'

/**
 * Shown instead of the app when git can't be run: Oak drives the installed git, so nothing works
 * without it. Explains what to do and checks again (which also finds a Git installed just now).
 */
export function GitMissing({ error, onFixed }: { error: string; onFixed: () => void }) {
  const [checking, setChecking] = useState(false)
  const [lastError, setLastError] = useState(error)
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => first.current?.focus(), [])

  const check = async () => {
    setChecking(true)
    const info = await api.gitInfo()
    setChecking(false)
    if (info.error) setLastError(info.error)
    else onFixed()
  }

  const choose = async () => {
    const exe = await api.pickFile('Choose git.exe', [{ name: 'git', extensions: ['exe'] }])
    if (!exe) return
    updateSettings({ gitPath: exe })
    await api.setGitPath(exe)
    await check()
  }

  return (
    <div className="welcome">
      <div className="titlebar-drag" />
      <div className="welcome-inner git-missing">
        <div className="brand">
          <div className="brand-mark warn">
            <Icon name="info" size={26} />
          </div>
          <div>
            <h1>Oak can&apos;t find Git</h1>
            <p>Oak works with the Git installed on this computer, and couldn&apos;t run it.</p>
          </div>
        </div>
        <ol className="git-missing-steps">
          <li>
            Download and install <strong>Git for Windows</strong> (the default options are fine).
          </li>
          <li>
            Come back here and choose <strong>Check again</strong>.
          </li>
        </ol>
        <div className="git-missing-actions">
          <button ref={first} className="btn primary" onClick={() => api.openUrl(DOWNLOAD_URL)}>
            Download Git for Windows
          </button>
          <button className="btn" disabled={checking} onClick={check}>
            {checking ? 'Checking…' : 'Check again'}
          </button>
          <button className="btn" onClick={choose}>
            Choose git.exe…
          </button>
        </div>
        <p className="git-missing-detail">Details: {lastError}</p>
      </div>
    </div>
  )
}
