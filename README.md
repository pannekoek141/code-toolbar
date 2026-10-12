# code-toolbar

One colored line above the Claude Code prompt. It shows how full your context is, how much of your plan limits you've used, and how far your task list has got. It also has buttons for the things you'd otherwise type a command for.

```
󰧑 ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬  62.7k 31% | 󰅐 5h 4h55m 12% | 󰃭 7d 3d22h 40% | effort high | 󰚩 Opus 5.5 | artifact on | 󰝖 main ▬▬▬▬▬▬ 3/5
```

## Why use it

- **You see the context fill up before it costs you.** A long chat gets slower, pricier and worse at remembering what you said early on. The bar goes green, then orange, then red, at token counts you choose. That tells you when to start fresh, before Claude starts forgetting.
- **You see your limits without asking.** The 5-hour and 7-day windows show how much you've used and when they reset. No more hitting the limit by surprise halfway through a task.
- **You see the work move.** While Claude has a task list, a blue bar shows how much of it is done. Running agents get their own bar.
- **One click instead of a command.** The toggles below do in one click what would otherwise be a slash command, a trip into `/config`, or a hand edit of `settings.json`.
- **It stays out of the way.** It's always one row, and it never wraps or pushes your chat up. When the window gets narrow, the toggles fold behind a `` arrow, one at a time. Click the arrow and the hidden toggles take the bar's place, so nothing above it moves.

## The toggles, and why each one exists

Each toggle can be switched off on its own (see [Settings](#settings)), because not everyone needs every one.

| Toggle | Click to | Why |
| --- | --- | --- |
| `effort high` / `effort medium` | Switch between high and medium effort. | Medium is faster and uses fewer tokens, and it's plenty for small edits and quick questions. Save high for hard problems. The choice goes into `settings.json` too, so the toolbar and Claude Code always agree. |
| ` Opus` / ` Sonnet` | Switch between Opus and Sonnet. | Sonnet is cheaper and quicker for simple jobs, and Opus is better for hard ones. Switching is the same as picking a model in `/model`. |
| `artifact on` / `artifact off` | Turn Claude Code's Artifact tools on or off. | The Artifact tools add about 6–7k tokens to every chat, whether you use them or not. If you never make artifacts, turn them off and get that room back. Restart Claude Code for the change to take effect. |

## Click the context bar to hand off

When the context bar turns red, you want a clean chat without losing your place. Hover and the brain turns into a paper plane. Click, and the plane flies off to the right. Then it writes a handoff note about where you are, runs `/clear`, and gives the note to the new chat. While that runs, the bar turns blue and the brain icon becomes a paper plane, so you can see it's working.

This needs the `handoff` skill from [mattpocock/skills](https://github.com/mattpocock/skills). If you don't use it, turn `ctxHandoff` off and the bar won't respond to clicks.

## Install

```
/plugin marketplace add pannekoek141/code-toolbar
/plugin install code-toolbar@code-toolbar
```

You need:

- A Claude Code version with mods (function-hook plugins).
- A [Nerd Font](https://www.nerdfonts.com/) in your terminal for the icons. Ghostty has one built in.
- For the handoff click: `/plugin marketplace add mattpocock/skills`, then install `mattpocock-skills`. You can also turn it off.

## Settings

Open `/config` and find **code-toolbar**. The same options also live in `~/.claude/settings.json` under `pluginConfigs["code-toolbar@code-toolbar"].options`.

| Option | Default | What it does |
| --- | --- | --- |
| `showEffort` | on | Show the effort toggle. When it's off, Claude Code's own effort setting is used and nothing overrides it. |
| `showModel` | on | Show the model toggle. |
| `ctxHandoff` | on | Click the context bar to hand off. |
| `showArtifact` | on | Show the artifact toggle. |
| `ctxTarget` | 200000 | The token count where the context bar is full. The % is measured against it. |
| `ctxCaution` | 150000 | The bar turns orange at this many tokens. |
| `ctxWarn` | 170000 | The bar turns red at this many tokens. |
| `ctxBar` | on | Draw the context as a bar. When it's off, you get a short `ctx 62.7k` label. |
| `ctxBarCells` | 15 | How wide the context bar is (1–60). |
| `taskBarCells` | 18 | How wide each task bar is (1–60). |
| `five` | on | Show the 5-hour limit. |
| `week` | on | Show the 7-day limit. |
| `alerts` | on | Pop up a one-time warning when the context passes `ctxWarn` or the 5-hour limit passes 85%. |

There's also `/toggle-effort`, which does the same as clicking the effort toggle.

## Develop

```
claude plugin validate .
claude plugin test .
```

To load your own copy, put its path in `CLAUDE_CODE_PLUGIN_DIRS`, then run `/reload-plugins` after each edit.

## License

MIT
