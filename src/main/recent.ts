import { app } from 'electron'
import { existsSync, promises as fs } from 'fs'
import path from 'path'
import type { RecentRepo } from '../shared/types'

const MAX_RECENT = 30

const file = () => path.join(app.getPath('userData'), 'recent-repos.json')

const samePath = (a: string, b: string) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b)

async function read(): Promise<RecentRepo[]> {
  try {
    return JSON.parse(await fs.readFile(file(), 'utf8'))
  } catch {
    return []
  }
}

async function write(list: RecentRepo[]) {
  await fs.mkdir(path.dirname(file()), { recursive: true })
  await fs.writeFile(file(), JSON.stringify(list, null, 2))
}

export async function listRecent(): Promise<RecentRepo[]> {
  return (await read()).filter((r) => existsSync(r.path)).sort((a, b) => b.lastOpened - a.lastOpened)
}

export async function addRecent(repoPath: string) {
  const list = (await read()).filter((r) => !samePath(r.path, repoPath))
  list.unshift({ path: repoPath, name: path.basename(repoPath), lastOpened: Date.now() })
  await write(list.slice(0, MAX_RECENT))
}

export async function removeRecent(repoPath: string) {
  await write((await read()).filter((r) => !samePath(r.path, repoPath)))
}
