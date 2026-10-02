# claude-pet 🦀

A little orange, four-legged Claude critter that lives in the band above your prompt in Claude Code.

- **While Claude works** it wanders around the band, trotting on its four legs, with one of claude-cli's spinner words over its head (`✻ Percolating…`): the glyph spins, the word shimmers and glows, the dots bounce.
- **One word per prompt**, like claude-cli. A very long turn (4+ minutes) gets a fresh one.
- **While idle** there's no text: the critter closes its eyes, breathes slowly and floats a few `z`s.
- `/pet` hides or shows it.

Works on the Claude Code desktop app (crisp animated SVG) and in the terminal (half-block pixels).

![claude-pet wandering above the prompt](docs/preview.svg)

## Install

Inside Claude Code:

```
/plugin marketplace add Brunonnzn/claude-pet-marketplace
/plugin install claude-pet@claude-pet-marketplace
```

Requires a Claude Code version with function-hook mods (`hooks/register.tsx`); older versions won't load it.

## Try it locally

```bash
claude --plugin-dir ./claude-pet
```

## Credits

Spinner verbs from [claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice/blob/main/reports/claude-spinner-verbs-and-tips.md).

## License

MIT
