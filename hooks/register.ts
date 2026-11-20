import type { EngineInterface as Engine, Register } from 'claude-code'

// The colors /color accepts in Claude Code 2.1.326.
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'] as const
const PICKABLE = new Set<string>(COLORS)
const KEEP = new Set<string>([...COLORS, 'default'])

const trimSlashes = (path: string) => path.replace(/\/+$/, '') || '/'
const basename = (path: string) => trimSlashes(path).split('/').pop() || path
// A path with no "/" (not a POSIX path) is its own parent, which ends the walk up.
const parentOf = (path: string) => {
  const cut = path.lastIndexOf('/')
  return cut < 0 ? path : path.slice(0, cut) || '/'
}

// Same name, same color, every session.
function hashColor(label: string): string {
  let hash = 0
  for (const ch of label) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0
  return COLORS[hash % COLORS.length] ?? 'blue'
}

// A color picked with /rnc is kept per name (folder or typed name), case-insensitive.
const storeKey = (label: string) => `color:${label.trim().toLowerCase()}`

async function colorFor($: Engine, label: string): Promise<string> {
  try {
    const saved = await $.store.get(storeKey(label))
    if (typeof saved === 'string' && PICKABLE.has(saved)) return saved
  } catch {
    // An unreadable store falls back to the computed color.
  }
  return hashColor(label)
}

// "default" forgets the saved color, so the computed one comes back next time.
async function remember($: Engine, label: string, color: string): Promise<void> {
  if (color === 'default') await $.store.delete(storeKey(label))
  else await $.store.set(storeKey(label), color)
}

// The nearest folder at or above `dir` holding a .git (directory or worktree file).
async function gitRootOf($: Engine, dir: string): Promise<string | undefined> {
  let current = trimSlashes(dir)
  // Bounded walk: stops at "/" or after 64 levels, whichever comes first.
  for (let i = 0; i < 64; i++) {
    if (await $.fs.exists(current === '/' ? '/.git' : `${current}/.git`)) return current
    const parent = parentOf(current)
    if (parent === current) return undefined
    current = parent
  }
  return undefined
}

// Where the session works now, not only where it started: the git repo around the
// current directory; outside git, the start folder when the current one is inside it.
async function projectDir($: Engine): Promise<string> {
  const root = trimSlashes(await $.session.root())
  const cwd = trimSlashes(await $.session.cwd())
  try {
    const repo = await gitRootOf($, cwd)
    if (repo !== undefined) return repo
  } catch {
    // Unreadable folders: use the directories as they are.
  }
  return cwd === root || cwd.startsWith(`${root}/`) ? root : cwd
}

// Reads .git/HEAD directly, following a worktree's "gitdir:" pointer; no git process.
async function branchOf($: Engine, root: string): Promise<string | undefined> {
  try {
    let gitDir = `${root}/.git`
    let head: string
    try {
      head = await $.fs.read(`${gitDir}/HEAD`)
    } catch {
      const pointer = (await $.fs.read(gitDir)).trim()
      if (!pointer.startsWith('gitdir:')) return undefined
      gitDir = pointer.slice('gitdir:'.length).trim()
      if (!gitDir.startsWith('/')) gitDir = `${root}/${gitDir}`
      head = await $.fs.read(`${gitDir}/HEAD`)
    }
    const ref = head.trim().match(/^ref: refs\/heads\/(.+)$/)
    return ref ? ref[1] : undefined
  } catch {
    return undefined
  }
}

// The automatic name, and the label its color is computed and saved under.
async function auto($: Engine): Promise<{ name: string; label: string }> {
  const dir = await projectDir($)
  const project = basename(dir)
  const branch = await branchOf($, dir)
  return { name: branch ? `${project} · ${branch}` : project, label: project }
}

const fail = ($: Engine) => (err: unknown) => $.ui.log(`rnc: failed: ${String(err)}`)

// A command.run hook can't run commands itself, so a timer runs them once /rnc has returned.
function apply($: Engine, name: string, color: string): string {
  $.clock.after(0, () => {
    void (async () => {
      await $.command.run({ command: 'rename', args: name })
      await $.command.run({ command: 'color', args: color })
    })().catch(fail($))
  })
  return `Session: ${name} · ${color}`
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'rnc',
      description: 'Rename and color this session in one go (no args: from folder and branch)',
      argumentHint: '[name] [color]',
    })

    if (options.autoOnStart === true && e.isInteractive) {
      // Defer: commands can't run while the session's start waits on this hook.
      $.clock.after(0, () => {
        void (async () => {
          // A resumed session or a reload already has messages: keep its name.
          const seen = await $.session.messages({ last: 1 })
          if (!('deny' in seen) && seen.length > 0) return
          const { name, label } = await auto($)
          apply($, name, await colorFor($, label))
        })().catch(fail($))
      })
    }

    return next(e)
  })

  // Only /rnc reaches this hook: the /rename and /color it runs don't come back here.
  on('command.run', { command: 'rnc' }, async ($, e) => {
    const words = e.args.trim().split(/\s+/).filter(Boolean)
    const last = words.at(-1)?.toLowerCase()
    const color = last !== undefined && KEEP.has(last) ? last : undefined

    if (words.length === 0) {
      const { name, label } = await auto($)
      return { text: apply($, name, await colorFor($, label)) }
    }

    if (color !== undefined) {
      // "/rnc <name> <color>" keeps the color for that name; "/rnc <color>" for the project.
      const name = words.length > 1 ? words.slice(0, -1).join(' ') : undefined
      const label = name ?? (await auto($)).label
      await remember($, label, color).catch(fail($))
      if (name !== undefined) return { text: apply($, name, color) }
      $.clock.after(0, () => {
        $.command.run({ command: 'color', args: color }).catch(fail($))
      })
      return { text: `Color: ${color}` }
    }

    const name = words.join(' ')
    return { text: apply($, name, await colorFor($, name)) }
  })
}
