import { PAGE_WIDTH_MM } from '@/lib/settings'
import type { Puzzle } from '@/lib/types'

export interface SvgOptions {
  /** Rayon des pastilles. */
  dotRadius?: number
  /** Taille des numéros. */
  fontSize?: number
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

  // Pastilles et numéros sont dimensionnés en millimètres imprimés puis convertis
  // en pixels de l'image : le rendu reste identique quelle que soit la résolution
  // de l'image d'entrée.
  const pixelsPerMm = width / PAGE_WIDTH_MM
  const {
    dotRadius = 0.55 * pixelsPerMm,
    fontSize = 2.4 * pixelsPerMm,
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
        parts.push(
          `<text x="${round(dot.x + dotRadius + 1.5)}" y="${round(dot.y - dotRadius - 0.5)}" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" fill="${colour}">${number}</text>`,
        )
      }
    }
  }

  parts.push('</svg>')
  return parts.join('\n')
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}
