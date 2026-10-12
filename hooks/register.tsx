import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionUsage } from 'claude-code'

import type { Effort, Snap } from '../types'

const snap = atom({ plugin: 'code-toolbar', key: 'snap' } as const, null)
// The effort the main loop's requests are sent with; Claude Code's own setting is left alone.
const effort = atom({ plugin: 'code-toolbar', key: 'effort' } as const, 'high')
// Per loop ('main' or an agent id): task id -> status, from TodoWrite / TaskCreate / TaskUpdate.
const tasks = atom({ plugin: 'code-toolbar', key: 'tasks' } as const, {})

// Which gauges are in the red, so each warns once on the way in.
const alerted = atom({ plugin: 'code-toolbar', key: 'alerted' } as const, { ctx: false, five: false })
// Whether the > menu is open.
const more = atom({ plugin: 'code-toolbar', key: 'more' } as const, false)
// A handoff is running: the context bar shows it in blue.
const handing = atom({ plugin: 'code-toolbar', key: 'handing' } as const, false)

// Aussie palette, flatuicolors.com/palette/au
const GREEN = '#6ab04c' // Pure Apple
const ORANGE = '#f0932b' // Quince Jelly
const RED = '#eb4d4b' // Carmine Pink
const BLUE = '#686de0' // Exodus Fruit
const TEAL = '#22a6b3' // Greenland Green
const PINK = '#e056fd' // Heliotrope

export const modelColor = (id: string) => (/opus/.test(id) ? TEAL : /sonnet/.test(id) ? PINK : undefined)

/** The /config model choice to switch to: Opus <-> Sonnet, always the plain window. */
export const otherModel = (id: string) => (/sonnet/.test(id) ? 'opus' : 'sonnet')

// Nerd Font icons (Ghostty bundles them); drawn as text, so they take a color.
const ICON = {
  ctx: '\u{f09d1}', // nf-md-brain
  five: '\u{f0150}', // nf-md-clock_outline
  week: '\u{f00ed}', // nf-md-calendar
  model: '\u{f06a9}', // nf-md-robot
  tasks: '\u{f0756}', // nf-md-format_list_checks
  agent: '\u{f062c}', // nf-md-source_branch
  open: '\uf105', // nf-fa-angle_right
  close: '\uf104', // nf-fa-angle_left
  handoff: '\u{f048a}', // nf-md-send
}

const LIVE = new Set(['pending', 'running', 'waiting'])

export type Levels = { caution: number; warn: number }

export const colorFor = (n: number, l: Levels) => (n >= l.warn ? RED : n >= l.caution ? ORANGE : GREEN)

// The 5h window, in percent.
const FIVE_LEVELS: Levels = { caution: 60, warn: 85 }

export type Config = Levels & { target: number; ctxBar: boolean; ctxCells: number; taskCells: number; alerts: boolean; five: boolean; week: boolean; show: Record<string, boolean> }

export function configFrom(options: Readonly<Record<string, unknown>>): Config {
  const num = (key: string, fallback: number) => {
    const v = Number(options[key])
    return Number.isFinite(v) && v > 0 ? v : fallback
  }
  const isOn = (key: string) => options[key] !== false && options[key] !== 'false'
  const cells = (key: string, fallback: number) => Math.min(60, Math.max(1, Math.round(num(key, fallback))))
  return {
    target: num('ctxTarget', 200_000),
    caution: num('ctxCaution', 150_000),
    warn: num('ctxWarn', 170_000),
    ctxBar: options.ctxBar !== false && options.ctxBar !== 'false',
    ctxCells: cells('ctxBarCells', 15),
    taskCells: cells('taskBarCells', 18),
    alerts: isOn('alerts'),
    five: isOn('five'),
    week: isOn('week'),
    // Which toggles the bar shows, by toggle key.
    show: { effort: isOn('showEffort'), model: isOn('showModel'), handoff: isOn('ctxHandoff'), artifact: isOn('showArtifact') },
  }
}

/** The bar's unfilled track: `hex` mixed toward black on dark, toward white on light. */
export const shade = (hex: string, isLight: boolean) =>
  '#' +
  [1, 3, 5]
    .map(i => {
      const c = parseInt(hex.slice(i, i + 2), 16)
      return Math.round(isLight ? c + (255 - c) * 0.6 : c * 0.35)
        .toString(16)
        .padStart(2, '0')
    })
    .join('')

// macOS appearance, which Ghostty's light:/dark: theme follows. Reads "Dark" in dark
// mode and fails in light mode.
async function readIsLight($: EngineInterface): Promise<boolean> {
  const r = await $.process.run(['/usr/bin/defaults', 'read', '-g', 'AppleInterfaceStyle']).catch(() => null)
  return r !== null && !r.stdout.includes('Dark')
}

type TaskMap = Record<string, string>

/** The loop's task map after a successful task tool call, or null if it did not change. */
export function applyTask(map: TaskMap, tool: string, input: any, result: any): TaskMap | null {
  if (tool === 'TodoWrite' && Array.isArray(input?.todos))
    return Object.fromEntries(input.todos.map((t: { status: string }, i: number) => [`todo${i}`, t.status]))
  if (tool === 'TaskCreate' && result?.task?.id) return { ...map, [result.task.id]: 'pending' }
  if (tool === 'TaskUpdate' && input?.taskId && input.status) {
    const { [input.taskId]: _, ...rest } = map
    return input.status === 'deleted' ? rest : { ...rest, [input.taskId]: input.status }
  }
  return null
}

export const progress = (map: TaskMap = {}) => {
  const all = Object.values(map)
  return { done: all.filter(s => s === 'completed').length, total: all.length }
}

export const isDone = (map: TaskMap = {}) => {
  const { done, total } = progress(map)
  return total > 0 && done === total
}

export const fmtTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`)

/** '3d22h' / '4h55m' / '45m' until `iso`, or '' if past or missing. */
export function fmtLeft(iso: string | null, nowMs: number): string {
  const s = iso ? (Date.parse(iso) - nowMs) / 1000 : NaN
  if (!(s > 0)) return ''
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d) return `${d}d${h}h`
  return h ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`
}

/** 'claude-opus-5-5[1m]' -> 'Opus 5.5 1M'; anything else as is. */
export function fmtModel(id: string): string {
  const m = /^(?:claude-)?([a-z]+)-(\d+)-(\d+)/.exec(id)
  if (!m) return id
  const name = `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}.${m[3]}`
  return /\[1m\]$/.test(id) ? `${name} 1M` : name
}

// register() sets it; a reload reads the options again.
let cfg: Config = configFrom({})

/** The toasts for gauges that just entered the red, and which are red now. */
export function newAlerts(was: { ctx: boolean; five: boolean }, s: Snap, c: Config, nowMs: number) {
  const is = { ctx: (s.ctxTokens ?? 0) >= c.warn, five: (s.fivePct ?? 0) >= FIVE_LEVELS.warn }
  const texts: string[] = []
  if (is.ctx && !was.ctx) texts.push(`Context at ${fmtTokens(s.ctxTokens ?? 0)}, past ${fmtTokens(c.warn)}`)
  if (is.five && !was.five) {
    const left = fmtLeft(s.fiveReset, nowMs)
    texts.push(`5h limit at ${Math.round(s.fivePct ?? 0)}%${left ? `, resets in ${left}` : ''}`)
  }
  return { is, texts }
}

async function refresh($: EngineInterface, usage?: Pick<SessionUsage, 'context' | 'rateLimits'>) {
  const u = usage ?? (await $.session.usage())
  const five = u.rateLimits.find(r => r.kind === 'five_hour')
  const week = u.rateLimits.find(r => r.kind === 'seven_day')
  const t = await read($, tasks)
  const agents = (await $.agent.list())
    .filter(a => LIVE.has(a.status))
    .map(a => ({ id: a.id, label: (a.name ?? a.type).slice(0, 14), ...progress(t[a.id]) }))
  const next: Snap = {
    ctxTokens: u.context.tokens ?? null,
    fivePct: five?.percentUsed ?? null,
    fiveReset: five?.resetsAt ?? null,
    weekPct: week?.percentUsed ?? null,
    weekReset: week?.resetsAt ?? null,
    model: await $.session.model(),
    isLight: await readIsLight($),
    artifact: (await $.settings.read({ source: 'user' })).enableArtifact !== false,
    main: progress(t.main),
    agents,
  }
  await update($, snap, () => next)

  const { is, texts } = newAlerts(await read($, alerted), next, cfg, await $.clock.now())
  if (cfg.alerts) for (const text of texts) $.ui.toast(text, { timeoutMs: 8000 })
  await update($, alerted, () => is)
}

/** high -> medium, anything else -> high. */
export const nextEffort = (e: string): Effort => (e === 'high' ? 'medium' : 'high')
// Claude Code's own theme colors, as its /effort picker draws them: high blue, medium green.
export const effortColor = (e: string) => (e === 'high' ? 'suggestion' : 'success')

// modelSettings is keyed by the plain model id, without the [1m] suffix.
const modelKey = (id: string) => id.replace(/\[1m\]$/, '')

/** The effort Claude Code itself uses for `model`, as settings.json holds it. */
export const settingsEffort = (s: any, model: string): string | undefined =>
  s?.modelSettings?.[modelKey(model)]?.effortLevel ?? s?.effortLevel

/** settings.json text with `model`'s effortLevel set; every other key kept. */
export function withEffort(text: string, model: string, level: Effort): string {
  const s = JSON.parse(text)
  const key = modelKey(model)
  s.modelSettings = { ...s.modelSettings, [key]: { ...s.modelSettings?.[key], effortLevel: level } }
  return JSON.stringify(s, null, 2) + '\n'
}

const settingsPath = async ($: EngineInterface) => `${await $.env.get('HOME')}/.claude/settings.json`

// The toggle starts from Claude Code's own setting, so the two never disagree.
async function syncEffort($: EngineInterface) {
  const level = settingsEffort(await $.settings.read(), await $.session.model())
  if (level === 'high' || level === 'medium') await update($, effort, () => level)
}

// Flips the toggle and writes the same choice to settings.json, where Claude Code reads its effort.
async function toggle($: EngineInterface) {
  await update($, effort, nextEffort)
  const path = await settingsPath($)
  await $.fs.write(path, withEffort(await $.fs.read(path), await $.session.model(), await read($, effort)))
}

// The same as picking it in /config (or /model).
async function swapModel($: EngineInterface) {
  const { deny } = await $.config.set({ key: 'model', value: otherModel(await $.session.model()) })
  if (deny) $.ui.toast(`Model not switched: ${deny}`)
  await syncEffort($).catch(() => undefined)
  await refresh($).catch(() => undefined)
}

/** settings.json text with `enableArtifact` set; every other key kept. */
export function withArtifact(text: string, isOn: boolean): string {
  const s = JSON.parse(text)
  if (isOn) delete s.enableArtifact // unset means on
  else s.enableArtifact = false
  return JSON.stringify(s, null, 2) + '\n'
}

// Writes ~/.claude/settings.json; the tool list is fixed at startup, so it takes a restart.
async function toggleArtifact($: EngineInterface) {
  const path = await settingsPath($)
  const isOn = !(await read($, snap))?.artifact
  await $.fs.write(path, withArtifact(await $.fs.read(path), isOn))
  $.ui.toast(`Artifact ${isOn ? 'on' : 'off'}: restart Claude Code to apply`, { timeoutMs: 8000 })
  await refresh($).catch(() => undefined)
}

/** How many toggles stay on the bar: the most that fit after the fixed pieces. */
export function fit(budget: number, fixedWidth: number, toggleWidths: number[]): number {
  let used = fixedWidth
  let n = 0
  for (const w of toggleWidths) {
    if (used + w > budget) break
    used += w
    n++
  }
  return n
}

// One-click handoff: write the note, /clear, then hand the note to the fresh conversation.
// A module variable, because the process outlives /clear (a reload drops it).
let pendingHandoff: string | null = null

async function startHandoff($: EngineInterface) {
  const dir = ((await $.env.get('TMPDIR')) ?? '/tmp').replace(/\/$/, '')
  pendingHandoff = `${dir}/handoff-${await $.clock.now()}.md`
  await update($, handing, () => true)
  $.ui.toast('Handoff: writing the note, then starting fresh')
  void $.command.run({ command: 'mattpocock-skills:handoff', args: `Save the document to exactly ${pendingHandoff}` })
}

async function finishHandoff($: EngineInterface) {
  const path = pendingHandoff
  pendingHandoff = null
  await update($, handing, () => false)
  if (!path || !(await $.fs.exists(path))) {
    $.ui.toast('Handoff note not found; nothing cleared')
    return
  }
  await $.command.run({ command: 'clear' })
  await $.prompt.submit({ text: `Read ${path} and continue the work from there.`, asUser: true })
}

export const register: Register = (on, options) => {
  cfg = configFrom(options)

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: 'toggle-effort', description: 'Switch effort between high and medium' })
    await syncEffort($).catch(() => undefined)
    await refresh($).catch(() => undefined)
    // Keeps the 5h countdown and the agent list moving between turns.
    $.clock.every(5_000, () => void refresh($).catch(() => undefined))
    return started
  })

  on('prompt.submit', async ($, e, next) => {
    // A finished list goes away on the next prompt, so a new one starts at 0.
    await update($, tasks, m => (isDone(m.main) ? { ...m, main: {} } : m))
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await refresh($, e).catch(() => undefined)
    return next(e)
  })

  on('command.run', { command: 'toggle-effort' }, async $ => {
    await toggle($)
    return { text: `Effort: ${await read($, effort)}` }
  })

  on('tool.call', async ($, e, next) => {
    const res = await next(e)
    const loop = e.agentId ?? 'main'
    if (!['TodoWrite', 'TaskCreate', 'TaskUpdate'].includes(e.tool) || res.deny !== undefined || res.isError) return res
    const all = await read($, tasks)
    const changed = applyTask(all[loop] ?? {}, e.tool, e, res.result)
    if (changed) {
      await update($, tasks, m => ({ ...m, [loop]: changed }))
      await refresh($).catch(() => undefined)
    }
    return res
  })

  // The handoff turn has ended: clear and carry on in a fresh conversation.
  on('turn.complete', async ($, e, next) => {
    const res = await next(e)
    if (pendingHandoff && !e.agentId) {
      if (e.reason === 'answer') void finishHandoff($).catch(err => $.ui.toast(`Handoff stopped: ${err}`))
      else {
        pendingHandoff = null
        await update($, handing, () => false)
      }
    }
    return res
  })

  // Clicks on the toggles (hooks/pill.ts).
  on('ui.message', async ($, e, next) => {
    if (e.data !== 'press') return next(e)
    if (e.element === 'model') await swapModel($)
    else if (e.element === 'effort') await toggle($)
    else if (e.element === 'more') await update($, more, v => !v)
    else if (e.element === 'artifact') await toggleArtifact($)
    else if (e.element === 'ctx') {
      if (cfg.show.handoff && !pendingHandoff) await startHandoff($)
    }
    else return next(e)
    return {}
  })

  // Main loop only; subagents keep their own effort, and models without effort are left alone.
  // A hidden effort toggle leaves Claude Code's own effort alone.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId || e.effort === undefined || !cfg.show.effort) return yield* next(e)
    return yield* next({ ...e, effort: await read($, effort) })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, snap)
    if (e.props.hasSurvey || !s) return next(e)

    const { Box, Text, Client } = $.ui.resolve(e)
    const now = await $.clock.now()
    const sep = <Text dimColor>|</Text>
    const level = await read($, effort)
    const isOpen = await read($, more)
    const isHanding = await read($, handing)

    const track = (color: string, n: number) => <Text color={shade(color, s.isLight)}>{'▬'.repeat(n)}</Text>

    // A bar on its track, then its text in the bar's color.
    const bar = (cells: number, frac: number, color: string, text: string) => {
      if (!(frac >= 0)) frac = 0
      const filled = Math.max(0, Math.min(cells, Math.round(frac * cells)))
      return (
        <Text>
          <Text color={color}>{'▬'.repeat(filled)}</Text>
          {track(color, cells - filled)}
          <Text color={color}>  {text}</Text>
        </Text>
      )
    }

    // A loop shows a bar while it has a task list, nothing without one.
    const loops = [{ id: 'main', label: 'main', ...s.main }, ...s.agents].filter(l => l.total)

    // A toggle: its label in its color; hovered, a block of that color with the
    // label reversed; a click lands in the ui.message hook. (hooks/pill.ts)
    const pill = (key: string, label: string, color: string | undefined) => (
      <Client
        key={key}
        module="./pill.ts"
        props={{ label: ` ${label} `, color: color ?? null }}
        width={Array.from(label).length + 2}
        height={1}
      />
    )

    const ctx = s.ctxTokens ?? 0
    const ctxPct = Math.round((ctx / cfg.target) * 100)
    const cells = (t: string) => Array.from(t).length

    // One row that never wraps: the pieces sit in a clipped Box and whatever does
    // not fit slides under the arrow, which always shows at the right.
    // A toggle pads itself, so its hover block has room around the label.
    const piece = (key: string, isFirst: boolean, body: any, isPill = false) => (
      <Box key={key} flexShrink={0}>
        {isFirst ? '' : sep}
        {isPill ? body : <Text> {body} </Text>}
      </Box>
    )
    // A rate-limit window: icon, name and time left in its color, % used dim.
    const limit = (key: string, icon: string, name: string, pct: number | null, reset: string | null) => {
      if (pct === null) return null
      const color = colorFor(pct, FIVE_LEVELS)
      const left = fmtLeft(reset, now)
      const text = `${icon} ${name} ${left ? `${left} ` : ''}${Math.round(pct)}%`
      return {
        width: 1 + cells(text) + 2,
        node: piece(
          key,
          false,
          <Text>
            <Text color={color}>{icon} {name} </Text>
            {left ? <Text color={color}>{left} </Text> : ''}
            <Text dimColor>{Math.round(pct)}%</Text>
          </Text>,
        ),
      }
    }

    // The context bar is the handoff button: blue with the send icon while one runs.
    const ctxColor = isHanding ? BLUE : colorFor(ctx, cfg)
    const filled = Math.max(0, Math.min(cfg.ctxCells, Math.round((ctx / cfg.target) * cfg.ctxCells))) || 0
    const ctxParts = [
      { text: ` ${isHanding ? ICON.handoff : ICON.ctx} `, color: ctxColor },
      ...(cfg.ctxBar
        ? [
            { text: '▬'.repeat(filled), color: ctxColor },
            { text: '▬'.repeat(cfg.ctxCells - filled), color: shade(ctxColor, s.isLight) },
            { text: `  ${fmtTokens(ctx)}`, color: ctxColor },
          ]
        : [{ text: `ctx ${fmtTokens(ctx)}`, color: ctxColor }]),
      { text: ` ${ctxPct}% `, dim: true },
    ]
    const ctxText = ctxParts.map(p => p.text).join('')
    const fixed = [
      {
        width: cells(ctxText),
        node: piece(
          'ctx',
          true,
          cfg.show.handoff ? (
            <Client
              key="ctx"
              module="./pill.ts"
              props={{ color: ctxColor, parts: ctxParts }}
              width={cells(ctxText)}
              height={1}
            />
          ) : (
            <Text>
              {ctxParts.map((p, i) => (
                <Text key={String(i)} color={p.color} dimColor={p.dim}>
                  {p.text}
                </Text>
              ))}
            </Text>
          ),
          true,
        ),
      },
      cfg.five ? limit('five', ICON.five, '5h', s.fivePct, s.fiveReset) : null,
      cfg.week ? limit('week', ICON.week, '7d', s.weekPct, s.weekReset) : null,
    ].filter(p => p !== null)

    // The toggles, in bar order. All of them show when the row has room; else the
    // last ones move behind an arrow, one by one as it narrows.
    const toggles = [
      { key: 'effort', label: `effort ${level}`, color: effortColor(level) },
      { key: 'model', label: `${ICON.model} ${fmtModel(s.model)}`, color: modelColor(s.model) },
      { key: 'artifact', label: `artifact ${s.artifact ? 'on' : 'off'}`, color: s.artifact ? GREEN : undefined },
    ].filter(t => cfg.show[t.key])
    const budget = e.props.bodyColumns - 1 // paddingLeft
    const fixedWidth = fixed.reduce((n, p) => n + p.width, 0)
    const widths = toggles.map(t => 1 + cells(t.label) + 2)
    const all = fit(budget, fixedWidth, widths)
    const inline = all === toggles.length ? all : fit(budget, fixedWidth + 4, widths) // 4: the arrow
    const menu = toggles.slice(inline)
    const arrow = (icon: string) => piece('more', false, pill('more', icon, undefined), true)

    // Open, the hidden toggles take the bar's own row, so nothing above it moves.
    if (isOpen && menu.length)
      return (
        <Box paddingLeft={1} width={e.props.bodyColumns}>
          {menu.map((t, i) => piece(t.key, i === 0, pill(t.key, t.label, t.color), true))}
          {arrow(ICON.close)}
        </Box>
      )

    return (
      <Box paddingLeft={1} width={e.props.bodyColumns}>
        <Box flexShrink={1} overflow="hidden">
          {fixed.map(p => p.node)}
          {toggles.slice(0, inline).map(t => piece(t.key, false, pill(t.key, t.label, t.color), true))}
          {loops.map(l =>
            piece(
              l.id,
              false,
              <Text>
                <Text color={BLUE}>{l.id === 'main' ? ICON.tasks : ICON.agent} </Text>
                <Text dimColor>{l.label} </Text>
                {bar(cfg.taskCells, l.done / l.total, BLUE, `${l.done}/${l.total}`)}
              </Text>,
            ),
          )}
        </Box>
        {menu.length ? arrow(ICON.open) : ''}
      </Box>
    )
  })
}
