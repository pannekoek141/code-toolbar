import { expect, test } from 'claude-code/testing'

const count = (s: string) => (s.match(/▬/g) ?? []).length

for (const [n, cols, hasToggles] of [[5, 200, true], [30, 200, true], [30, 60, false]] as const) {
  test(`ctx bar is ${n} cells at ${cols} columns`, { options: { ctxBarCells: n } }, async ($, on) => {
    on('ui.render', ($, e) => { const { Text } = $.ui.resolve(e); return <Text>engine</Text> })
    on('session.start', () => ({ cwd: '/' }) as any)
    on('session.usage', () => ({ value: { context: { tokens: 50000 }, rateLimits: [{ kind: 'seven_day', percentUsed: 19, resetsAt: new Date(3 * 86400e3 + 22 * 3600e3 + 60e3).toISOString() }] } }) as any)
    on('session.model', () => ({ value: 'claude-opus-5-5' }) as any)
    on('agent.list', () => ({ value: [] }) as any)
    on('process.run', () => ({ value: { stdout: 'Dark' } }) as any)
    on('command.register', () => ({ value: undefined }) as any)
    on('settings.read', () => ({ value: { enableArtifact: false } }) as any)
    on('clock.now', () => ({ value: 0 }) as any)
    await $.session.start({ cwd: '/' } as any)
    const ui = await $.ui.mount({ plugin: 'code-toolbar', surface: 'terminal', component: 'AbovePrompt', props: { isWorking: false, bodyColumns: cols } } as any)
    const all = JSON.stringify(await ui.drawn())
    expect(count(all)).toBe(n)
    if (hasToggles) expect(all).toContain('effort high')
    else expect(all).not.toContain('effort high')
    expect(all).toContain('3d22h')
  })
}
