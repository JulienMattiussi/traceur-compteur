import { execFileSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { spacingInPixels } from '@/lib/page'
import { generatePuzzle } from '@/lib/pipeline'
import type { Mask, Point } from '@/lib/types'

/**
 * Fabrique l'image de partage (1200x630).
 *
 * Le dessin de droite n'est pas une illustration : c'est un vrai puzzle produit
 * par le moteur, sur un dessin original tracé ici même. L'image montre donc
 * exactement ce que l'outil sait faire, tracé intérieur compris.
 */
const WIDTH = 1200
const HEIGHT = 630

function createMask(width: number, height: number): Mask {
  return { width, height, data: new Uint8Array(width * height) }
}

function line(mask: Mask, from: Point, to: Point, thickness = 3): void {
  let x = Math.round(from.x)
  let y = Math.round(from.y)
  const x1 = Math.round(to.x)
  const y1 = Math.round(to.y)
  const dx = Math.abs(x1 - x)
  const dy = Math.abs(y1 - y)
  const stepX = x < x1 ? 1 : -1
  const stepY = y < y1 ? 1 : -1
  let error = dx - dy
  const reach = Math.floor((thickness - 1) / 2)

  for (;;) {
    for (let oy = -reach; oy <= reach; oy++) {
      for (let ox = -reach; ox <= reach; ox++) {
        const px = x + ox
        const py = y + oy
        if (px >= 0 && py >= 0 && px < mask.width && py < mask.height) {
          mask.data[py * mask.width + px] = 1
        }
      }
    }
    if (x === x1 && y === y1) break
    const doubled = 2 * error
    if (doubled > -dy) {
      error -= dy
      x += stepX
    }
    if (doubled < dx) {
      error += dx
      y += stepY
    }
  }
}

/** Arc de cercle, en degrés, sens trigonométrique. */
function arc(mask: Mask, cx: number, cy: number, r: number, from: number, to: number): void {
  const steps = Math.max(12, Math.ceil((Math.abs(to - from) / 360) * 2 * Math.PI * r))
  let previous: Point | null = null
  for (let i = 0; i <= steps; i++) {
    const angle = ((from + ((to - from) * i) / steps) * Math.PI) / 180
    const point = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
    if (previous) line(mask, previous, point)
    previous = point
  }
}

/** Un chat schématique : contour, oreilles, et surtout du tracé intérieur. */
function catFace(): Mask {
  const mask = createMask(520, 520)

  arc(mask, 260, 300, 185, 0, 360)
  // Oreilles posées sur le crâne.
  line(mask, { x: 132, y: 190 }, { x: 118, y: 60 })
  line(mask, { x: 118, y: 60 }, { x: 232, y: 132 })
  line(mask, { x: 388, y: 190 }, { x: 402, y: 60 })
  line(mask, { x: 402, y: 60 }, { x: 288, y: 132 })

  // Ce que les générateurs par contour jettent : les yeux, le museau, les moustaches.
  arc(mask, 195, 265, 34, 0, 360)
  arc(mask, 325, 265, 34, 0, 360)
  line(mask, { x: 260, y: 330 }, { x: 238, y: 358 })
  line(mask, { x: 238, y: 358 }, { x: 282, y: 358 })
  line(mask, { x: 282, y: 358 }, { x: 260, y: 330 })
  arc(mask, 222, 372, 40, 350, 60)
  arc(mask, 298, 372, 120, 190, 0)

  for (const [y, spread] of [
    [352, 18],
    [372, 0],
    [392, -18],
  ] as const) {
    line(mask, { x: 150, y: y - spread }, { x: 32, y: y - spread * 2 })
    line(mask, { x: 370, y: y - spread }, { x: 488, y: y - spread * 2 })
  }

  return mask
}

const mask = catFace()
const gray = new Uint8Array(mask.data.length)
for (let i = 0; i < gray.length; i++) gray[i] = mask.data[i] === 1 ? 0 : 255

const puzzle = generatePuzzle(gray, mask.width, mask.height, {
  maxDots: 130,
  minSpacing: spacingInPixels(mask.width, 7),
  minTrailLength: spacingInPixels(mask.width, 14),
  bridgeGap: spacingInPixels(mask.width, 12),
})

const INK = '#f8fafc'
const ACCENT = '#38bdf8'
const parts: string[] = []
const round = (value: number): number => Math.round(value * 10) / 10

// Le puzzle, mis à l'échelle dans le cadre de droite.
const frame = { x: 668, y: 55, size: 520 }
const scale = frame.size / mask.width
const px = (x: number): number => frame.x + x * scale
const py = (y: number): number => frame.y + y * scale

// Le tracé en sous-couche : des points nus ne racontent rien, alors qu'ici on
// voit d'un coup et le puzzle et le dessin qu'il cache.
for (const sequence of puzzle.sequences) {
  const path = sequence.dots.map((dot) => `${round(px(dot.x))},${round(py(dot.y))}`).join(' ')
  parts.push(
    `<${sequence.closed ? 'polygon' : 'polyline'} points="${path}" fill="none" stroke="#334155" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`,
  )
}

for (const sequence of puzzle.sequences) {
  for (let i = 0; i < sequence.dots.length; i++) {
    const dot = sequence.dots[i]!
    if (i === 0) {
      parts.push(
        `<circle cx="${round(px(dot.x))}" cy="${round(py(dot.y))}" r="7" fill="none" stroke="${ACCENT}" stroke-width="1.6"/>`,
      )
    }
    parts.push(`<circle cx="${round(px(dot.x))}" cy="${round(py(dot.y))}" r="3.4" fill="${INK}"/>`)
  }
}
for (const label of puzzle.labels) {
  parts.push(
    `<text x="${round(px(label.x))}" y="${round(py(label.y + label.height))}" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#94a3b8">${label.number}</text>`,
  )
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <pattern id="grid" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="1.5" cy="1.5" r="1.5" fill="#1e293b"/>
    </pattern>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#0f172a"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)"/>

  <g transform="translate(80 96)">
    <polyline points="4,26 22,4 40,20 60,2" fill="none" stroke="${ACCENT}" stroke-width="3"
      stroke-dasharray="4 6" stroke-linecap="round"/>
    <circle cx="4" cy="26" r="9" fill="none" stroke="${INK}" stroke-width="2.4"/>
    <circle cx="4" cy="26" r="4.6" fill="${INK}"/>
    <circle cx="22" cy="4" r="4.6" fill="${INK}"/>
    <circle cx="40" cy="20" r="4.6" fill="${INK}"/>
    <circle cx="60" cy="2" r="4.6" fill="${INK}"/>
  </g>

  <text x="80" y="232" font-family="Helvetica, Arial, sans-serif" font-size="66" font-weight="700" fill="${INK}">Traceur</text>
  <g transform="translate(346 210)">
    <line x1="6" y1="0" x2="46" y2="0" stroke="${ACCENT}" stroke-width="4" stroke-dasharray="4 7" stroke-linecap="round"/>
    <circle cx="3" cy="0" r="5" fill="${INK}"/>
    <circle cx="49" cy="0" r="5" fill="${INK}"/>
  </g>
  <text x="404" y="232" font-family="Helvetica, Arial, sans-serif" font-size="66" font-weight="700" fill="${INK}">compteur</text>

  <text x="80" y="300" font-family="Helvetica, Arial, sans-serif" font-size="27" fill="#cbd5e1">Le relier-les-points qui garde le</text>
  <text x="80" y="338" font-family="Helvetica, Arial, sans-serif" font-size="27" fill="#cbd5e1"><tspan fill="${ACCENT}" font-weight="600">tracé intérieur</tspan> du dessin.</text>

  <g font-family="Helvetica, Arial, sans-serif" font-size="19" fill="#94a3b8">
    <text x="80" y="426">100 % dans le navigateur, aucune image envoyée</text>
    <text x="80" y="460">Séquences minimales, prouvées par le théorème d'Euler</text>
    <text x="80" y="494">Export PDF A4 prêt à imprimer</text>
  </g>

  ${parts.join('\n  ')}
</svg>`

const temp = 'public/og.svg'
writeFileSync(temp, svg)
execFileSync('google-chrome', [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--hide-scrollbars',
  `--window-size=${WIDTH},${HEIGHT}`,
  '--screenshot=public/og.png',
  `file://${process.cwd()}/${temp}`,
])
unlinkSync(temp)
console.log(`public/og.png : ${puzzle.stats.dots} points, ${puzzle.stats.sequences} sequences`)
