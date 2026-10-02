import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

// `frame` drives the terminal's cell animation; `word` only changes the spinner
// word, so the desktop SVGs (animated on their own) redraw just that often.
const frame = atom({ plugin: 'claude-pet', key: 'frame' } as const, 0)
const word = atom({ plugin: 'claude-pet', key: 'word' } as const, 0)
const isHidden = atom({ plugin: 'claude-pet', key: 'isHidden' } as const, false)

const ORANGE = '#D97757'
const SHINE = '#FFC2A8'
const EYE = '#1F1410'

// The verbs claude-cli cycles through while it works.
const WORDS = [
  'Accomplishing', 'Actioning', 'Actualizing', 'Architecting', 'Baking', 'Beaming', "Beboppin'", 'Befuddling',
  'Billowing', 'Blanching', 'Bloviating', 'Boogieing', 'Boondoggling', 'Booping', 'Bootstrapping', 'Brewing',
  'Bunning', 'Burrowing', 'Calculating', 'Canoodling', 'Caramelizing', 'Cascading', 'Catapulting', 'Cerebrating',
  'Channeling', 'Channelling', 'Choreographing', 'Churning', 'Clauding', 'Coalescing', 'Cogitating',
  'Combobulating', 'Composing', 'Computing', 'Concocting', 'Considering', 'Contemplating', 'Cooking', 'Crafting',
  'Creating', 'Crunching', 'Crystallizing', 'Cultivating', 'Deciphering', 'Deliberating', 'Determining',
  'Dilly-dallying', 'Discombobulating', 'Doing', 'Doodling', 'Drizzling', 'Ebbing', 'Effecting', 'Elucidating',
  'Embellishing', 'Enchanting', 'Envisioning', 'Evaporating', 'Fermenting', 'Fiddle-faddling', 'Finagling',
  'Flambéing', 'Flibbertigibbeting', 'Flowing', 'Flummoxing', 'Fluttering', 'Forging', 'Forming', 'Frolicking',
  'Frosting', 'Gallivanting', 'Galloping', 'Garnishing', 'Generating', 'Gesticulating', 'Germinating',
  'Gitifying', 'Grooving', 'Gusting', 'Harmonizing', 'Hashing', 'Hatching', 'Herding', 'Honking',
  'Hullaballooing', 'Hyperspacing', 'Ideating', 'Imagining', 'Improvising', 'Incubating', 'Inferring', 'Infusing',
  'Ionizing', 'Jitterbugging', 'Levitating', 'Lollygagging', 'Manifesting', 'Marinating', 'Meandering',
  'Metamorphosing', 'Misting', 'Moonwalking', 'Moseying', 'Mulling', 'Mustering', 'Musing', 'Nebulizing',
  'Nesting', 'Newspapering', 'Noodling', 'Nucleating', 'Orbiting', 'Orchestrating', 'Osmosing', 'Perambulating',
  'Percolating', 'Perusing', 'Philosophising', 'Photosynthesizing', 'Pollinating', 'Pondering', 'Pontificating',
  'Pouncing', 'Precipitating', 'Prestidigitating', 'Processing', 'Proofing', 'Propagating', 'Puttering',
  'Puzzling', 'Quantumizing', 'Razzle-dazzling', 'Razzmatazzing', 'Recombobulating', 'Reticulating', 'Roosting',
  'Ruminating', 'Sautéing', 'Scampering', 'Schlepping', 'Scurrying', 'Sketching', 'Slithering', 'Smooshing',
  'Sock-hopping', 'Spelunking', 'Spinning', 'Sprouting', 'Stewing', 'Sublimating', 'Swirling', 'Swooping',
  'Symbioting', 'Synthesizing', 'Tempering', 'Thinking', 'Thundering', 'Tinkering', 'Tomfoolering',
  'Topsy-turvying', 'Transfiguring', 'Transmuting', 'Twisting', 'Undulating', 'Unfurling', 'Unravelling',
  'Vibing', 'Waddling', 'Wandering', 'Warping', 'Whatchamacalliting', 'Whirlpooling', 'Whirring', 'Whisking',
  'Wibbling', 'Working', 'Wrangling', 'Zesting', 'Zigzagging',
]

// The glyph cycle claude-cli spins in front of the word.
const GLYPHS = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢']

// A deterministic shuffle so consecutive words differ.
const wordAt = (n: number) => WORDS[(n * 71 + 13) % WORDS.length]

// The critter, 12 × 7 pixels: O body, D eye, A/B the two leg pairs that trot.
const SPRITE = [
  '.OOOOOOOOOO.',
  '.OODOOOODOO.',
  'OOODOOOODOOO',
  'OOOOOOOOOOOO',
  '.OOOOOOOOOO.',
  '..A.B..A.B..',
  '..A.B..A.B..',
]
const W = 12
const H = 7

// ── desktop: SVG, animated by SMIL inside the frame ─────────────────────────

const PX = 4
const PET_W = W * PX
const PET_H = H * PX + 2
const STRIDE = 0.18 // seconds per leg swap

// A small seeded generator, so one turn keeps one path across redraws.
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

type Leg = { to: number; secs: number; isPause: boolean }

// A wander that ends where it starts: random strolls and pauses, then a stroll
// home, so the loop's restart lands on the very spot it began from.
const wander = (seed: number, lane: number) => {
  const r = rng(seed)
  const max = lane - PET_W
  const home = Math.round(r() * max)
  const legs: Leg[] = []
  let x = home
  const stroll = (to: number) => {
    legs.push({ to, secs: Math.max(0.6, Math.abs(to - x) / (35 + r() * 25)), isPause: false })
    x = to
  }
  const pause = () => legs.push({ to: x, secs: 0.6 + r() * 2.2, isPause: true })
  for (let i = 0; i < 6; i++) {
    stroll(Math.round(r() * max))
    if (r() < 0.6) pause()
  }
  stroll(home)
  pause()

  return { home, legs, total: legs.reduce((sum, leg) => sum + leg.secs, 0) }
}

const fmt = (n: number) => +n.toFixed(4)

// `now` sets the phase, so a redrawn SVG resumes mid-stride instead of restarting.
const petSvg = (working: boolean, now: number, seed: number, lane: number) => {
  const rects: string[] = []
  SPRITE.slice(0, 5).forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === 'O') rects.push(`<rect x="${x * PX}" y="${y * PX}" width="${PX}" height="${PX}"/>`)
    }),
  )
  const eye = (x: number) =>
    !working
      ? `<rect x="${x * PX - 1}" y="${PX * 2 + 1}" width="${PX + 2}" height="1.5" fill="${EYE}"/>`
      : `<rect x="${x * PX}" y="${PX}" width="${PX}" height="${PX * 2}" fill="${EYE}">` +
        `<animate attributeName="height" values="${PX * 2};${PX * 2};1;${PX * 2}" keyTimes="0;0.94;0.97;1" dur="4.5s" repeatCount="indefinite"/>` +
        `<animate attributeName="y" values="${PX};${PX};${PX * 2};${PX}" keyTimes="0;0.94;0.97;1" dur="4.5s" repeatCount="indefinite"/>` +
        `</rect>`

  const path = wander(seed, lane)
  const T = path.total
  const begin = `-${((now / 1000) % T).toFixed(2)}s`

  // Position: eased between waypoints, held through pauses.
  let t = 0
  const xs = [path.home]
  const times = [0]
  for (const leg of path.legs) {
    t += leg.secs
    xs.push(leg.to)
    times.push(fmt(t / T))
  }
  times[times.length - 1] = 1
  const splines = path.legs.map(() => '0.45 0 0.55 1').join(';')
  const walk = working
    ? `<animateTransform attributeName="transform" type="translate" values="${xs.map(x => `${x} 0`).join(';')}" keyTimes="${times.join(';')}" calcMode="spline" keySplines="${splines}" dur="${fmt(T)}s" begin="${begin}" repeatCount="indefinite"/>`
    : ''

  // Legs trot only while strolling; one discrete timeline on the same clock.
  const steps: { at: number; lifted: 'A' | 'B' | null }[] = []
  t = 0
  for (const leg of path.legs) {
    if (leg.isPause) {
      steps.push({ at: t, lifted: null })
    } else {
      for (let k = 0; k * STRIDE < leg.secs; k++) steps.push({ at: t + k * STRIDE, lifted: k % 2 === 0 ? 'A' : 'B' })
    }
    t += leg.secs
  }
  const trot = (pair: 'A' | 'B') => {
    const values = steps.map(st => (st.lifted === pair ? PX : PX * 2))
    return (
      `<animate attributeName="height" values="${values.join(';')}" keyTimes="${steps.map(st => fmt(st.at / T)).join(';')}" ` +
      `calcMode="discrete" dur="${fmt(T)}s" begin="${begin}" repeatCount="indefinite"/>`
    )
  }
  const legs = (xs: number[], pair: 'A' | 'B') =>
    xs
      .map(
        x =>
          `<rect x="${x * PX}" y="${5 * PX}" width="${PX}" height="${PX * 2}">` +
          (working ? trot(pair) : '') +
          `</rect>`,
      )
      .join('')

  const bob = working
    ? `<animateTransform attributeName="transform" type="translate" values="0 0;0 -1;0 0" dur="${STRIDE * 2}s" repeatCount="indefinite"/>`
    : `<animateTransform attributeName="transform" type="translate" values="0 0;0 1;0 0" dur="3.2s" repeatCount="indefinite"/>`
  const zzz = working
    ? ''
    : [0, 1, 2]
        .map(
          i =>
            `<text x="${PET_W + 4 + i * 5}" y="${PET_H - 8}" font-family="ui-monospace, Consolas, monospace" font-size="${7 + i * 2}" font-weight="bold" fill="${ORANGE}" opacity="0">z` +
            `<animate attributeName="opacity" values="0;0.8;0" dur="3.6s" begin="${i * 1.2}s" repeatCount="indefinite"/>` +
            `<animate attributeName="y" values="${PET_H - 8};${6}" dur="3.6s" begin="${i * 1.2}s" repeatCount="indefinite"/>` +
            `</text>`,
        )
        .join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${lane}" height="${PET_H}" viewBox="0 -2 ${lane} ${PET_H}" shape-rendering="crispEdges">` +
    `<g>${walk}<g fill="${ORANGE}">${bob}${rects.join('')}${eye(3)}${eye(8)}</g>` +
    `<g fill="${ORANGE}">${legs([2, 7], 'A')}${legs([4, 9], 'B')}</g></g>${zzz}</svg>`
  )
}

const CH = 7.8 // monospace advance the word is fitted to
const FONT = `font-family="ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace" font-size="13"`

const WORD_H = 20
const X0 = 18
const wordWidth = (text: string) => Math.ceil(X0 + text.length * CH + 4 + 22)

const wordSvg = (text: string, working: boolean) => {
  const textW = text.length * CH
  const x0 = X0
  const dotsX = x0 + textW + 4
  const width = wordWidth(text)
  const glyphs = working
    ? GLYPHS.map((g, i) => {
        const values = GLYPHS.map((_, j) => (j === i ? 1 : 0)).join(';')
        return `<text x="0" y="15" ${FONT} fill="${ORANGE}" opacity="0">${g}<animate attributeName="opacity" values="${values}" calcMode="discrete" dur="1.2s" repeatCount="indefinite"/></text>`
      }).join('')
    : `<text x="0" y="15" ${FONT} fill="${ORANGE}" opacity="0.5">✻</text>`
  const fill = working ? 'url(#shine)' : ORANGE
  const shine = working
    ? `<defs><filter id="glow" x="-10%" y="-60%" width="120%" height="220%">` +
      `<feGaussianBlur stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
      `<linearGradient id="shine" gradientUnits="userSpaceOnUse" x1="-60" y1="0" x2="0" y2="0">` +
      `<stop offset="0" stop-color="${ORANGE}"/><stop offset="0.5" stop-color="${SHINE}"/><stop offset="1" stop-color="${ORANGE}"/>` +
      `<animate attributeName="x1" values="${-60};${width}" dur="2s" repeatCount="indefinite"/>` +
      `<animate attributeName="x2" values="0;${width + 60}" dur="2s" repeatCount="indefinite"/>` +
      `</linearGradient></defs>`
    : ''
  const dots = [0, 1, 2]
    .map(
      i =>
        `<circle cx="${dotsX + i * 6}" cy="13" r="1.6" fill="${ORANGE}"${working ? '' : ' opacity="0.5"'}>` +
        (working
          ? `<animate attributeName="cy" values="13;8;13;13" keyTimes="0;0.2;0.4;1" dur="1.1s" begin="${i * 0.15}s" repeatCount="indefinite"/>`
          : '') +
        `</circle>`,
    )
    .join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${WORD_H}" viewBox="0 0 ${width} ${WORD_H}">` +
    shine +
    glyphs +
    `<text x="${x0}" y="15" ${FONT} fill="${fill}" textLength="${textW}" lengthAdjust="spacingAndGlyphs" font-weight="600"${working ? ' filter="url(#glow)"' : ' opacity="0.5"'}>${text}</text>` +
    dots +
    `</svg>`
  )
}

// ── terminal: half-block cells, animated by the `frame` tick ────────────────

type Cell = { ch: string; fg?: string; bg?: string }

const spriteRows = (f: number, working: boolean, blink: boolean) =>
  SPRITE.map((row, y) =>
    [...row].map(ch => {
      if (ch === 'D') return blink ? ORANGE : EYE
      if (ch === 'O') return ORANGE
      // A lifted leg loses its lower pixel.
      if (ch === 'A' || ch === 'B') {
        const lifted = working && y === H - 1 && (ch === 'A') === (f % 2 === 0)
        return lifted ? null : ORANGE
      }
      return null
    }),
  )

const halfBlocks = (px: (string | null)[][]) => {
  const out: Cell[][] = []
  for (let y = 0; y < px.length; y += 2) {
    out.push(
      px[y].map((top, x) => {
        const bottom = px[y + 1]?.[x] ?? null
        if (top && bottom) return { ch: '▀', fg: top, bg: bottom }
        if (top) return { ch: '▀', fg: top }
        if (bottom) return { ch: '▄', fg: bottom }
        return { ch: ' ' }
      }),
    )
  }
  return out
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pet',
      description: 'Show or hide the Claude critter above the prompt',
    })
    $.clock.every(180, () => {
      void update($, frame, n => n + 1)
    })
    // claude-cli keeps one verb per turn; a very long turn gets a fresh one.
    $.clock.every(4 * 60_000, () => {
      void update($, word, n => n + 1)
    })

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await update($, word, n => n + 1)

    return next(e)
  })

  on('command.run', { command: 'pet' }, async $ => {
    const hidden = !(await read($, isHidden))
    await update($, isHidden, () => hidden)

    return { text: hidden ? 'Critter hidden.' : 'Critter is back.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) {
      return next(e)
    }

    const working = e.props.isWorking
    const w = await read($, word)
    const text = wordAt(w)

    if (e.surface !== 'terminal') {
      const { Box, Svg } = $.ui.resolve(e)
      // The gray band's width, roughly, in CSS pixels.
      const lane = Math.max(200, Math.min(620, e.props.bodyColumns * 7))

      return (
        <Box flexDirection="column">
          {working && <Svg source={wordSvg(text, working)} alt={`${text}…`} width={wordWidth(text)} height={WORD_H} />}
          <Svg source={petSvg(working, await $.clock.now(), w, lane)} alt="Claude critter" width={lane} height={PET_H} />
        </Box>
      )
    }

    const { Box, Text } = $.ui.resolve(e)
    const f = await read($, frame)

    const span = Math.max(0, Math.min(e.props.bodyColumns, 60) - W - 2)
    const stops = Math.max(1, span)
    const walkPhase = Math.floor(f / 2) % (stops * 2)
    const at = working ? (walkPhase < stops ? walkPhase : stops * 2 - walkPhase) : 0
    const pad = ' '.repeat(at)
    const blink = !working || f % 26 === 0
    const cells = halfBlocks(spriteRows(Math.floor(f / 2), working, blink))
    const zzz = ['z  ', 'zZ ', 'zZz', '   '][Math.floor(f / 6) % 4]

    // A highlight band sweeping through the word, as claude-cli shimmers it.
    const sweep = working ? (f % (text.length + 8)) - 4 : -99
    const glyph = working ? GLYPHS[f % GLYPHS.length] : '✻'
    const dots = working ? ['   ', '.  ', '.. ', '...'][Math.floor(f / 2) % 4] : '…'

    return (
      <Box flexDirection="column">
        {!working && (
          <Text color={ORANGE} dimColor>
            {' '.repeat(W)}
            {zzz}
          </Text>
        )}
        {working && <Box>
          <Text>{pad}</Text>
          <Text color={ORANGE} dimColor={!working}>
            {glyph}{' '}
          </Text>
          {[...text].map((ch, i) => (
            <Text color={Math.abs(i - sweep) <= 1 ? SHINE : ORANGE} dimColor={!working}>
              {ch}
            </Text>
          ))}
          <Text color={ORANGE} dimColor={!working}>
            {dots}
          </Text>
        </Box>}
        {cells.map(row => (
          <Box>
            <Text>{pad}</Text>
            {row.map(c => (
              <Text color={c.fg} backgroundColor={c.bg}>
                {c.ch}
              </Text>
            ))}
          </Box>
        ))}
      </Box>
    )
  })
}
