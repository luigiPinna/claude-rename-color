import type { EngineInterface as Engine, Register } from 'claude-code'

// The colors /color accepts in Claude Code 2.1.326.
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'] as const
const KEEP = new Set<string>([...COLORS, 'default'])

const basename = (path: string) => path.replace(/\/+$/, '').split('/').pop() || path

// Same folder name, same color, every session.
function colorFor(key: string): string {
  let hash = 0
  for (const ch of key) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0
  return COLORS[hash % COLORS.length] ?? 'blue'
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

async function auto($: Engine): Promise<{ name: string; color: string }> {
  const root = await $.session.root()
  const project = basename(root)
  const branch = await branchOf($, root)
  return { name: branch ? `${project} · ${branch}` : project, color: colorFor(project) }
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
          const { name, color } = await auto($)
          apply($, name, color)
        })().catch(fail($))
      })
    }

    return next(e)
  })

  on('command.run', { command: 'rnc' }, async ($, e) => {
    const words = e.args.trim().split(/\s+/).filter(Boolean)
    const last = words.at(-1)?.toLowerCase()

    if (words.length === 0) {
      const { name, color } = await auto($)
      return { text: apply($, name, color) }
    }

    if (last !== undefined && KEEP.has(last) && words.length > 1) {
      return { text: apply($, words.slice(0, -1).join(' '), last) }
    }

    if (last !== undefined && KEEP.has(last) && words.length === 1) {
      $.clock.after(0, () => {
        $.command.run({ command: 'color', args: last }).catch(fail($))
      })
      return { text: `Color: ${last}` }
    }

    const name = words.join(' ')
    return { text: apply($, name, colorFor(basename(await $.session.root()))) }
  })
}
