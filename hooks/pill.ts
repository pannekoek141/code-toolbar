import type { ClientModule } from 'claude-code'

export type PillProps = { label: string; color: string | null }

// A toggle drawn on the terminal's side: its label in its color at rest, a block of
// that color with the label reversed under the pointer, and a click posted to the
// hooks module. A Button can do the click, but not keep a color of its own.
const Pill: ClientModule<PillProps, { isHover: boolean }> = (p, s) => {
  if (s.state === undefined) {
    s.setState({ isHover: false })
    s.onPointer(e => {
      if (e.type === 'enter') s.setState({ isHover: true })
      else if (e.type === 'leave') s.setState({ isHover: false })
      else if (e.type === 'up' && e.button === 'left') s.post('press')
    })
  }
  const color = p.color ?? 'text'
  return s.state?.isHover
    ? s.elements.Text({ color: 'inverseText', backgroundColor: color, children: p.label })
    : s.elements.Text({ color, children: p.label })
}

export default Pill
