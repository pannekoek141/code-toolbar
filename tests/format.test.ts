import { expect, test } from 'claude-code/testing'

import { colorFor, configFrom, fmtLeft, fmtModel, fmtTokens, fit, withArtifact, withEffort, settingsEffort } from '../hooks/register'

test('formats', () => {
  expect(fmtTokens(52_800)).toBe('52.8k')
  expect(fmtModel('claude-opus-5-5[1m]')).toBe('Opus 5.5 1M')
  expect(fmtModel('claude-sonnet-5-5')).toBe('Sonnet 5.5')
  expect(fmtLeft(new Date(1000 * (4 * 3600 + 55 * 60)).toISOString(), 0)).toBe('4h55m')
  expect(fmtLeft(null, 0)).toBe('')
})

test('context color changes at caution and warn', () => {
  expect(configFrom({ showArtifact: false, ctxHandoff: 'false' }).show).toEqual({ effort: true, model: true, handoff: false, artifact: false })
  const c = configFrom({ ctxCaution: 150000, ctxWarn: '170000', ctxBarCells: 999, ctxBar: false })
  expect(c).toEqual({ target: 200000, caution: 150000, warn: 170000, ctxBar: false, ctxCells: 60, taskCells: 18, alerts: true, five: true, week: true, show: { effort: true, model: true, handoff: true, artifact: true } })
  const colors = [10_000, 150_000, 170_000].map(n => colorFor(n, c))
  expect(new Set(colors).size).toBe(3)
  expect(colorFor(149_999, c)).toBe(colors[0])
  expect(colorFor(169_999, c)).toBe(colors[1])
})

test('task progress follows todo and task tools', async () => {
  const { applyTask, progress } = await import('../hooks/register')
  const todos = applyTask({}, 'TodoWrite', { todos: [{ status: 'completed' }, { status: 'in_progress' }, { status: 'pending' }] }, {})!
  expect(progress(todos)).toEqual({ done: 1, total: 3 })

  let m = applyTask({}, 'TaskCreate', {}, { task: { id: '1' } })!
  m = applyTask(m, 'TaskCreate', {}, { task: { id: '2' } })!
  m = applyTask(m, 'TaskUpdate', { taskId: '1', status: 'completed' }, {})!
  expect(progress(m)).toEqual({ done: 1, total: 2 })
  m = applyTask(m, 'TaskUpdate', { taskId: '2', status: 'deleted' }, {})!
  expect(progress(m)).toEqual({ done: 1, total: 1 })
  expect(applyTask(m, 'TaskUpdate', { taskId: '1', subject: 'x' }, {})).toBeNull()
  const { isDone } = await import('../hooks/register')
  expect(isDone(m)).toBe(true)
  expect(isDone(todos)).toBe(false)
  expect(isDone({})).toBe(false)
})

test('warns once when a gauge enters the red', async () => {
  const { newAlerts, configFrom } = await import('../hooks/register')
  const c = configFrom({})
  const snap = { ctxTokens: 180_000, fivePct: 88, fiveReset: null, weekPct: null, weekReset: null, model: '', isLight: false, artifact: true, main: { done: 0, total: 0 }, agents: [] }
  const first = newAlerts({ ctx: false, five: false }, snap, c, 0)
  expect(first.texts).toEqual(['Context at 180.0k, past 170.0k', '5h limit at 88%'])
  expect(newAlerts(first.is, snap, c, 0).texts).toEqual([])
  expect(newAlerts(first.is, { ...snap, ctxTokens: 1000, fivePct: 10 }, c, 0).is).toEqual({ ctx: false, five: false })
})

test('track is darker on dark, lighter on light', async () => {
  const { shade } = await import('../hooks/register')
  expect(shade('#6ab04c', false)).toBe('#253e1b')
  expect(shade('#6ab04c', true)).toBe('#c3dfb7')
})

test('model swap and colors', async () => {
  const { otherModel, modelColor } = await import('../hooks/register')
  expect(otherModel('claude-opus-5-5[1m]')).toBe('sonnet')
  expect(otherModel('claude-sonnet-5-5')).toBe('opus')
  expect(otherModel('claude-sonnet-5-5[1m]')).toBe('opus')
  expect(modelColor('claude-opus-5-5')).toBe('#22a6b3')
  expect(modelColor('claude-sonnet-5-5[1m]')).toBe('#e056fd')
  expect(modelColor('claude-haiku-4-5')).toBeUndefined()
})

test('effort toggles and takes its color', async () => {
  const { nextEffort, effortColor } = await import('../hooks/register')
  expect(nextEffort('high')).toBe('medium')
  expect(nextEffort('medium')).toBe('high')
  expect(effortColor('high')).not.toBe(effortColor('medium'))
})

test('time left counts days past 24h', () => {
  expect(fmtLeft(new Date(1000 * (3 * 86400 + 22 * 3600 + 5 * 60)).toISOString(), 0)).toBe('3d22h')
})

test('artifact switch keeps every other setting', () => {
  const off = JSON.parse(withArtifact('{"model":"opus","enableArtifact":true}', false))
  expect(off).toEqual({ model: 'opus', enableArtifact: false })
  expect(JSON.parse(withArtifact(JSON.stringify(off), true))).toEqual({ model: 'opus' })
})

test('effort is read from and written to Claude Code settings', () => {
  const s = { effortLevel: 'high', modelSettings: { 'claude-opus-5-5': { effortLevel: 'medium' } } }
  expect(settingsEffort(s, 'claude-opus-5-5[1m]')).toBe('medium')
  expect(settingsEffort(s, 'claude-sonnet-5-5')).toBe('high')
  const out = JSON.parse(withEffort(JSON.stringify({ ...s, model: 'opus' }), 'claude-opus-5-5', 'high'))
  expect(out).toEqual({ effortLevel: 'high', model: 'opus', modelSettings: { 'claude-opus-5-5': { effortLevel: 'high' } } })
})

test('toggles move behind the arrow one by one as the row narrows', () => {
  expect(fit(100, 60, [15, 15])).toBe(2)
  expect(fit(85, 60, [15, 15])).toBe(1)
  expect(fit(70, 60, [15, 15])).toBe(0)
})

test('the send icon flies right across the label', async () => {
  const { flyFrame } = await import('../hooks/pill')
  expect(flyFrame(' P ab ', 0)).toBe(' P    ')
  expect(flyFrame(' P ab ', 10)).toBe('   P  ')
  expect(flyFrame(' P ab ', 20)).toBe('     P')
})
