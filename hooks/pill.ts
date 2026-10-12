import type { ClientModule } from 'claude-code'

// `parts` draws the label in several colors at rest (the context bar); hovered it is one block.
export type Part = { text: string; color?: string; dim?: boolean }
// `hoverIcon` takes the icon's cell (cell 1) under the pointer; `fly` sends that icon off to the right on a click.
export type PillProps = { label?: string; color: string | null; parts?: Part[]; hoverIcon?: string; fly?: boolean }

// The flight: FRAMES frames, FRAME_MS apart (0.5s in all).
const FRAMES = 20
const FRAME_MS = 25

// A toggle drawn on the terminal's side: its label in its color at rest, a block of
// that color with the label reversed under the pointer, and a click posted to the
// hooks module. A Button can do the click, but not keep a color of its own.
/** Frame `t` of the flight: the icon leaves cell 1 and slides right, gone after the last cell. */
export function flyFrame(label: string, t: number): string {
  const cells = Array.from(label)
  const x = 1 + Math.round((t / FRAMES) * (cells.length - 2))
  const icon = cells[1] ?? ''
  cells[1] = ' '
  if (x < cells.length) cells[x] = icon
  return cells.join('')
}

const Pill: ClientModule<PillProps, { isHover: boolean; t: number | null }> = (p, s) => {
  if (s.state === undefined) {
    s.setState({ isHover: false, t: null })
    s.onPointer(e => {
      const t = s.state?.t ?? null
      if (e.type === 'enter') s.setState({ isHover: true, t })
      else if (e.type === 'leave') s.setState({ isHover: false, t })
      else if (e.type === 'up' && e.button === 'left') {
        s.post('press')
        if (t !== null) return
        let n = 0
        s.setState({ isHover: true, t: 0 })
        const stop = s.every(FRAME_MS, () => {
          n++
          if (n > FRAMES) stop()
          s.setState({ isHover: s.state?.isHover ?? false, t: n > FRAMES ? null : n })
        })
      }
    })
  }
  const color = p.color ?? 'text'
  const label = p.parts ? p.parts.map(t => t.text).join('') : p.label
  const hover = p.hoverIcon ? [...Array.from(label ?? '').slice(0, 1), p.hoverIcon, ...Array.from(label ?? '').slice(2)].join('') : (label ?? '')
  const t = s.state?.t ?? null
  if (p.fly && t !== null) {
    return s.elements.Text({ color: 'inverseText', backgroundColor: color, children: flyFrame(hover, t) })
  }
  return s.state?.isHover
    ? s.elements.Text({ color: 'inverseText', backgroundColor: color, children: hover })
    : p.parts
      ? s.elements.Text({ children: p.parts.map(t => s.elements.Text({ color: t.color, dimColor: t.dim, children: t.text })) })
      : s.elements.Text({ color, children: label })
}

export default Pill
