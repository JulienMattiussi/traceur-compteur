import { baselineOf } from '@/lib/labels'
import { metricsFor } from '@/lib/page'
import type { Puzzle } from '@/lib/types'

export interface SvgOptions {
  /** Affiche le tracé solution en fond, pour vérifier le rendu. */
  showSolution?: boolean
  /** Colore chaque séquence différemment (lecture du découpage). */
  colorBySequence?: boolean
  /** N'affiche que le tracé, sans les points ni les numéros. */
  solutionOnly?: boolean
  /**
   * Omet le fond blanc, pour superposer le puzzle à l'image source. Jamais utilisé
   * à l'export : un SVG transparent s'imprimerait sur n'importe quoi.
   */
  transparent?: boolean
}

const PALETTE = [
  '#2563eb',
  '#db2777',
  '#16a34a',
  '#ea580c',
  '#7c3aed',
  '#0891b2',
  '#ca8a04',
  '#be123c',
]

/**
 * Numérotation continue sur tout le puzzle, avec un anneau sur le premier point
 * de chaque séquence pour dire « lève le crayon ici ».
 *
 * C'est ce qui permet de garder le tracé intérieur sans casser l'habitude du
 * 1-2-3 : l'utilisateur suit une seule suite de numéros, et l'anneau lui signale
 * les rares ruptures.
 */
export function renderSvg(puzzle: Puzzle, options: SvgOptions = {}): string {
  const { width, height, sequences } = puzzle

  // Mêmes métriques que celles utilisées pour placer les étiquettes, sinon les
  // numéros seraient positionnés à une taille et dessinés à une autre.
  const { dotRadius, fontSize } = metricsFor(width, height)
  const {
    showSolution = false,
    colorBySequence = false,
    solutionOnly = false,
    transparent = false,
  } = options
  const parts: string[] = []

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
  )
  if (!transparent) parts.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`)

  if (showSolution || solutionOnly) {
    for (let s = 0; s < sequences.length; s++) {
      const sequence = sequences[s]!
      const colour = colorBySequence ? PALETTE[s % PALETTE.length]! : '#94a3b8'
      const path = sequence.dots.map((dot) => `${round(dot.x)},${round(dot.y)}`).join(' ')
      const tag = sequence.closed ? 'polygon' : 'polyline'
      parts.push(
        `<${tag} points="${path}" fill="none" stroke="${colour}" stroke-width="${solutionOnly ? 1.4 : 1}" stroke-linejoin="round" stroke-linecap="round"/>`,
      )
    }
  }

  if (!solutionOnly) {
    for (let s = 0; s < sequences.length; s++) {
      const sequence = sequences[s]!
      const colour = colorBySequence ? PALETTE[s % PALETTE.length]! : '#111827'

      for (let i = 0; i < sequence.dots.length; i++) {
        const dot = sequence.dots[i]!
        const number = sequence.firstNumber + i
        const isStart = i === 0

        if (isStart) {
          // Anneau : nouvelle séquence, on lève le crayon.
          parts.push(
            `<circle cx="${round(dot.x)}" cy="${round(dot.y)}" r="${dotRadius + 1.4}" fill="none" stroke="${colour}" stroke-width="1"/>`,
          )
        }
        parts.push(
          `<circle cx="${round(dot.x)}" cy="${round(dot.y)}" r="${dotRadius}" fill="${colour}"/>`,
        )

        const label = puzzle.labels[number - 1]
        if (label) {
          parts.push(
            `<text x="${round(label.x)}" y="${round(baselineOf(label))}" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" fill="${colour}">${number}</text>`,
          )
        }
      }
    }
  }

  parts.push('</svg>')
  return parts.join('\n')
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}
