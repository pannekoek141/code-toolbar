export type Effort = 'high' | 'medium'
export type Progress = { done: number; total: number }
export type AgentBar = Progress & { id: string; label: string }
export type Snap = {
  ctxTokens: number | null
  fivePct: number | null
  fiveReset: string | null
  weekPct: number | null
  weekReset: string | null
  model: string
  isLight: boolean
  artifact: boolean
  main: Progress
  agents: AgentBar[]
}

declare module 'claude-code' {
  interface PluginState {
    'code-toolbar': { snap: Snap | null; effort: Effort; tasks: Record<string, Record<string, string>>; alerted: { ctx: boolean; five: boolean }; more: boolean }
  }
}
