import { useEffect, useMemo, useState } from 'react'
import type { GitConfigScope } from '../../../main/handlers'
import type { PullMode } from '../../../shared/types'
import {
  DIFF_TOOL_PRESETS,
  EDITOR_PRESETS,
  LINE_ENDINGS,
  MERGE_TOOL_PRESETS,
  findPreset,
  type ConfigPreset
} from '../../../shared/gitTools'
import { api } from '../api'
import { openRepoOrGlobalConfig, useGitConfig, type GitConfig } from '../lib/useGitConfig'
import { updateSettings, useSettings } from '../settings'
import { ConfigInput, Field } from './prefsFields'
import { Tip } from './Tip'

const CONFIG_KEYS = [
  'user.name',
  'user.email',
  'commit.gpgsign',
  'init.defaultBranch',
  'core.autocrlf',
  'core.editor',
  'merge.tool',
  'diff.tool'
] as const

type GitInfo = Awaited<ReturnType<typeof api.gitInfo>>
type ConfigContext = Awaited<ReturnType<typeof api.gitConfigContext>>
type Write = (scope: GitConfigScope, entries: Record<string, string>) => Promise<void>

const CUSTOM = '__custom__'
const ALL_EXES = [...new Set([...EDITOR_PRESETS, ...MERGE_TOOL_PRESETS, ...DIFF_TOOL_PRESETS].flatMap((p) => (p.exe ? [p.exe] : [])))]

/** One key as seen from the chosen scope: its own value, what it inherits, and (from global) what this repository overrides. */
function scopedValue(config: GitConfig | null, scope: GitConfigScope, key: string) {
  const own = config?.[scope][key] ?? null
  const inherited = scope === 'local' ? (config?.global[key] ?? null) : null
  const override = scope === 'global' ? (config?.local[key] ?? null) : null
  return { own, inherited, override: override !== null && override !== own ? override : null }
}

/**
 * Identity, signing, line endings, the editor and the merge and diff tools are real git config
 * (global, or this repository's own), so Oak and the command line always agree. The rest are Oak settings.
 */
export function GitPage({ repo }: { repo: string | null }) {
  const s = useSettings()
  const num = (v: string) => Number(v)
  const { config, write } = useGitConfig(repo, CONFIG_KEYS)
  const [scope, setScope] = useState<GitConfigScope>('global')
  const [info, setInfo] = useState<GitInfo | null>(null)
  const [context, setContext] = useState<ConfigContext | null>(null)
  const [found, setFound] = useState<ReadonlySet<string> | null>(null)

  useEffect(() => {
    api.gitInfo().then(setInfo)
  }, [s.gitPath])
  useEffect(() => {
    api.gitConfigContext(repo).then(setContext)
  }, [repo])
  useEffect(() => {
    api.findExecutables(ALL_EXES).then((names) => setFound(new Set(names)))
  }, [])

  const save = (key: string, value: string, at: GitConfigScope = scope) => write(at, { [key]: value })
  const name = scopedValue(config, scope, 'user.name')
  const email = scopedValue(config, scope, 'user.email')
  const effective = (key: string) => config?.local[key] ?? config?.global[key]
  const missing = config && (!effective('user.name') || !effective('user.email'))
  const gpgsign = scopedValue(config, scope, 'commit.gpgsign')
  const signing = (gpgsign.own ?? gpgsign.inherited) === 'true'

  return (
    <>
      {repo && (
        <Field label="Applies to" hint="A repository's own setting wins over the global one">
          <select className="select" value={scope} onChange={(e) => setScope(e.target.value as GitConfigScope)}>
            <option value="global">All repositories</option>
            <option value="local">This repository only</option>
          </select>
        </Field>
      )}

      <h4>Identity</h4>
      <Field label="Name" hint="user.name">
        <ConfigInput value={name.own} placeholder={name.inherited ?? 'Your Name'} onSave={(v) => save('user.name', v)} />
      </Field>
      <Field label="Email" hint="user.email">
        <ConfigInput value={email.own} placeholder={email.inherited ?? 'you@example.com'} onSave={(v) => save('user.email', v)} />
      </Field>
      {missing && <p className="prefs-warn">Commits will fail until both a name and an email are set.</p>}
      {scope === 'local' && <p className="prefs-note">Leave a field empty to use the global value (shown greyed out).</p>}

      <h4>Commits</h4>
      <Field label="Commit subject guide" hint="The length counter turns amber past this">
        <select className="select" value={s.subjectLimit} onChange={(e) => updateSettings({ subjectLimit: num(e.target.value) })}>
          <option value={0}>Off</option>
          {[50, 72, 100].map((n) => (
            <option key={n} value={n}>
              {n} characters
            </option>
          ))}
        </select>
      </Field>
      <label className="check">
        <input type="checkbox" checked={signing} onChange={(e) => save('commit.gpgsign', e.target.checked ? 'true' : '')} />
        Sign commits <span className="prefs-hint">commit.gpgsign · needs a signing key set up in git</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={s.signoff} onChange={(e) => updateSettings({ signoff: e.target.checked })} />
        Add a Signed-off-by line <span className="prefs-hint">git commit --signoff</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={s.autoStageOnCommit} onChange={(e) => updateSettings({ autoStageOnCommit: e.target.checked })} />
        Stage changes automatically when committing with nothing staged{' '}
        <span className="prefs-hint">tracked files; new files only when nothing else changed</span>
      </label>

      <h4>Files and tools</h4>
      <PresetField
        label="Line endings"
        hint="core.autocrlf"
        configKey="core.autocrlf"
        presets={LINE_ENDINGS.map((o) => ({ value: o.value, label: o.label }))}
        config={config}
        scope={scope}
        write={write}
      />
      {context?.attributesSetLineEndings && (
        <p className="prefs-note">This repository's .gitattributes takes precedence for the files it matches.</p>
      )}
      <PresetField
        label="Editor"
        hint="core.editor · commit messages and rebases"
        configKey="core.editor"
        presets={EDITOR_PRESETS}
        config={config}
        scope={scope}
        write={write}
        found={found}
        allowCustom
        customPlaceholder="my-editor --wait"
      />
      {context?.editorEnv && (
        <p className="prefs-warn">The GIT_EDITOR environment variable ({context.editorEnv}) overrides this setting.</p>
      )}
      <PresetField
        label="Merge tool"
        hint="merge.tool"
        configKey="merge.tool"
        presets={MERGE_TOOL_PRESETS}
        config={config}
        scope={scope}
        write={write}
        found={found}
        hideMissing
        allowCustom
        customPlaceholder="tool name (define mergetool.<name>.cmd in your git config)"
        alsoSet={{ 'mergetool.keepBackup': 'false' }}
      />
      <PresetField
        label="Diff tool"
        hint="diff.tool"
        configKey="diff.tool"
        presets={DIFF_TOOL_PRESETS}
        config={config}
        scope={scope}
        write={write}
        found={found}
        hideMissing
        allowCustom
        customPlaceholder="tool name (define difftool.<name>.cmd in your git config)"
      />
      <ConfigFiles repo={repo} />

      <h4>Remotes</h4>
      <Field label="Pull" hint="What the Pull button does. Other modes stay in its menu.">
        <select className="select" value={s.pullMode} onChange={(e) => updateSettings({ pullMode: e.target.value as PullMode })}>
          <option value="default">Use git config</option>
          <option value="merge">Merge</option>
          <option value="rebase">Rebase</option>
          <option value="ff-only">Fast-forward only</option>
        </select>
      </Field>
      <Field label="Fetch automatically" hint="In the background, without asking for credentials">
        <select className="select" value={s.autoFetchMinutes} onChange={(e) => updateSettings({ autoFetchMinutes: num(e.target.value) })}>
          <option value={0}>Off</option>
          {[5, 15, 30].map((n) => (
            <option key={n} value={n}>
              Every {n} minutes
            </option>
          ))}
        </select>
      </Field>
      <label className="check">
        <input type="checkbox" checked={s.fetchPrune} onChange={(e) => updateSettings({ fetchPrune: e.target.checked })} />
        Remove branches deleted on the remote when fetching <span className="prefs-hint">--prune</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={s.pullRequestPrompt} onChange={(e) => updateSettings({ pullRequestPrompt: e.target.checked })} />
        Offer to open a pull request after pushing a new branch
      </label>

      <h4>Setup</h4>
      <Field label="Default branch for new repositories" hint="init.defaultBranch (global)">
        <ConfigInput
          value={config?.global['init.defaultBranch'] ?? null}
          placeholder="master (git default)"
          onSave={(v) => save('init.defaultBranch', v, 'global')}
        />
      </Field>
      <Field label="Git executable" hint="Leave empty to use git from PATH">
        <ConfigInput value={s.gitPath || null} placeholder="git" onSave={(v) => updateSettings({ gitPath: v.trim() })} />
      </Field>
      <p className={info?.error ? 'prefs-warn' : 'prefs-note'}>
        {!info ? 'Checking git…' : info.error ? `Cannot run "${info.binary}": ${info.error}` : `${info.version} · ${info.location}`}
      </p>
    </>
  )
}

interface PresetFieldProps {
  label: string
  hint: string
  configKey: string
  presets: ConfigPreset[]
  config: GitConfig | null
  scope: GitConfigScope
  write: Write
  /** Executables found on this machine; null while still looking. */
  found?: ReadonlySet<string> | null
  /** List only presets that were found (plus the one in use). */
  hideMissing?: boolean
  allowCustom?: boolean
  customPlaceholder?: string
  /** Written together with the key whenever a preset is chosen. */
  alsoSet?: Record<string, string>
}

/** A git config key chosen from presets, with an inherited/override explanation and an optional free-text escape hatch. */
function PresetField({
  label,
  hint,
  configKey,
  presets,
  config,
  scope,
  write,
  found,
  hideMissing,
  allowCustom,
  customPlaceholder,
  alsoSet
}: PresetFieldProps) {
  const [customChosen, setCustomChosen] = useState(false)
  const { own, inherited, override } = scopedValue(config, scope, configKey)
  const current = own ?? ''
  const matched = findPreset(presets, current)
  const isCustom = allowCustom && (customChosen || (!!current && !matched))
  const notFound = (p: ConfigPreset) => !!p.exe && !!found && !found.has(p.exe)

  const options = useMemo(
    () => presets.filter((p) => !(hideMissing && !!p.exe && !!found && !found.has(p.exe)) || p.value === current),
    [presets, hideMissing, found, current]
  )
  const defaultLabel =
    scope === 'local' ? `Same as global${inherited ? ` (${findPreset(presets, inherited)?.label ?? inherited})` : ''}` : 'Not set'

  const choose = (value: string) => {
    if (value === CUSTOM) return setCustomChosen(true)
    setCustomChosen(false)
    const preset = findPreset(presets, value)
    write(scope, value ? { [configKey]: value, ...preset?.extra, ...alsoSet } : { [configKey]: '' })
  }

  return (
    <>
      <Field label={label} hint={hint}>
        <select className="select" value={isCustom ? CUSTOM : current} onChange={(e) => choose(e.target.value)}>
          <option value="">{defaultLabel}</option>
          {options.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
          {allowCustom && <option value={CUSTOM}>Custom…</option>}
        </select>
      </Field>
      {isCustom && (
        <Field label="Custom" hint={configKey}>
          <ConfigInput value={own} placeholder={customPlaceholder ?? ''} onSave={(v) => write(scope, { [configKey]: v })} />
        </Field>
      )}
      {matched && notFound(matched) && (
        <p className="prefs-warn">
          {matched.label} was not found on this machine. Git will fail to start it until it is installed or on your PATH.
        </p>
      )}
      {override !== null && (
        <p className="prefs-note">This repository overrides this with {findPreset(presets, override)?.label ?? override}.</p>
      )}
      {scope === 'local' && own && (
        <p className="prefs-note">
          <button className="link" onClick={() => choose('')}>
            Remove this repository's override
          </button>
        </p>
      )}
    </>
  )
}

/** Opens the real config files: aliases, hooks, credential helpers and everything else not offered here live there. */
function ConfigFiles({ repo }: { repo: string | null }) {
  const [paths, setPaths] = useState<{ global: string; local: string | null } | null>(null)
  useEffect(() => {
    Promise.all([api.gitConfigPath(repo, 'global'), repo ? api.gitConfigPath(repo, 'local') : Promise.resolve(null)])
      .then(([global, local]) => setPaths({ global, local }))
      .catch(() => setPaths(null))
  }, [repo])
  const open = (scope: GitConfigScope) => openRepoOrGlobalConfig(repo, scope)
  return (
    <>
      <p className="prefs-note">Aliases and everything else not listed here live in your git config files.</p>
      <div className="prefs-row">
        <Tip label={paths?.global}>
          <button className="btn" onClick={() => open('global')}>
            Open global git config
          </button>
        </Tip>
        {repo && (
          <Tip label={paths?.local ?? undefined}>
            <button className="btn" onClick={() => open('local')}>
              Open repository git config
            </button>
          </Tip>
        )}
      </div>
    </>
  )
}
