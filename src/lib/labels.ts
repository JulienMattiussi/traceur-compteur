import { PAGE_WIDTH_MM } from '@/lib/settings'
import type { DotSequence, Point } from '@/lib/types'

export interface LabelMetrics {
  /** Hauteur de la police, en pixels de l'image. */
  fontSize: number
  /** Rayon de la pastille : l'étiquette ne doit pas la recouvrir. */
  dotRadius: number
  /** Dimensions de l'image : une étiquette ne doit pas déborder de la page. */
  canvasWidth: number
  canvasHeight: number
}

/** Étiquette résolue : où écrire le numéro, et si on a réussi à le caser. */
export interface PlacedLabel {
  number: number
  /** Coin haut-gauche du rectangle occupé par le texte. */
  x: number
  y: number
  width: number
  height: number
  /** Faux si aucune position libre n'a été trouvée autour de la pastille. */
  placed: boolean
}

/**
 * Chiffres en Helvetica : tous la même avance, 0,556 em. Pas besoin de mesurer le
 * texte, un numéro n'est fait que de chiffres.
 */
const DIGIT_ADVANCE = 0.556
/** Hauteur des capitales, ce que le texte occupe réellement au-dessus de la ligne de base. */
const CAP_HEIGHT = 0.72

/** Écart entre la pastille et son numéro, en fraction de la taille de police. */
const GAP = 0.2

export function labelSize(value: number, fontSize: number): { width: number; height: number } {
  const digits = String(value).length
  return { width: digits * DIGIT_ADVANCE * fontSize, height: CAP_HEIGHT * fontSize }
}

/** Ligne de base à passer à `<text>` pour un rectangle dont le haut est en `y`. */
export function baselineOf(label: PlacedLabel): number {
  return label.y + label.height
}

/**
 * Positions candidates autour de la pastille, par ordre de préférence. La
 * première reproduit le placement classique en haut à droite ; les suivantes
 * servent quand la place est déjà prise.
 */
function candidates(
  dot: Point,
  size: { width: number; height: number },
  metrics: LabelMetrics,
): { x: number; y: number }[] {
  const { width: w, height: h } = size
  const offset = metrics.dotRadius + GAP * metrics.fontSize
  const right = dot.x + offset
  const left = dot.x - offset - w
  const above = dot.y - offset - h
  const below = dot.y + offset

  return [
    { x: right, y: above },
    { x: left, y: above },
    { x: right, y: below },
    { x: left, y: below },
    { x: right, y: dot.y - h / 2 },
    { x: left, y: dot.y - h / 2 },
    { x: dot.x - w / 2, y: above },
    { x: dot.x - w / 2, y: below },
  ]
}

function overlaps(a: PlacedLabel, x: number, y: number, w: number, h: number): boolean {
  return a.x < x + w && x < a.x + a.width && a.y < y + h && y < a.y + a.height
}

/** Une étiquette qui dépasse de l'image est tout simplement coupée à l'impression. */
function insideCanvas(
  x: number,
  y: number,
  size: { width: number; height: number },
  metrics: LabelMetrics,
): boolean {
  return (
    x >= 0 &&
    y >= 0 &&
    x + size.width <= metrics.canvasWidth &&
    y + size.height <= metrics.canvasHeight
  )
}

/**
 * Place chaque numéro autour de sa pastille sans qu'aucun ne chevauche un autre,
 * ni ne recouvre une pastille.
 *
 * C'est le bon critère de lisibilité : deux points peuvent être très proches, et
 * c'est même souvent utile pour suivre une courbe serrée. Ce qui rend un puzzle
 * illisible, c'est deux **numéros** superposés. Les déplacer coûte beaucoup moins
 * cher que de supprimer des points.
 */
export function placeLabels(sequences: DotSequence[], metrics: LabelMetrics): PlacedLabel[] {
  const dots: Point[] = []
  const numbers: number[] = []
  for (const sequence of sequences) {
    for (let i = 0; i < sequence.dots.length; i++) {
      dots.push(sequence.dots[i]!)
      numbers.push(sequence.firstNumber + i)
    }
  }

  const placed: PlacedLabel[] = []
  // Une pastille voisine masquée par un numéro est presque aussi gênante que deux
  // numéros superposés : on l'évite aussi.
  const dotClearance = metrics.dotRadius + 0.5

  for (let i = 0; i < dots.length; i++) {
    const dot = dots[i]!
    const size = labelSize(numbers[i]!, metrics.fontSize)

    let chosen: { x: number; y: number } | null = null
    for (const candidate of candidates(dot, size, metrics)) {
      if (!insideCanvas(candidate.x, candidate.y, size, metrics)) continue

      const hitsLabel = placed.some((other) =>
        overlaps(other, candidate.x, candidate.y, size.width, size.height),
      )
      if (hitsLabel) continue

      const hitsDot = dots.some(
        (other, index) =>
          index !== i &&
          other.x + dotClearance > candidate.x &&
          other.x - dotClearance < candidate.x + size.width &&
          other.y + dotClearance > candidate.y &&
          other.y - dotClearance < candidate.y + size.height,
      )
      if (hitsDot) continue

      chosen = candidate
      break
    }

    // À défaut de place libre, on ramène au moins l'étiquette dans la page :
    // débordante, elle serait purement et simplement coupée.
    const fallback = candidates(dot, size, metrics)[0]!
    const position = chosen ?? {
      x: clamp(fallback.x, 0, metrics.canvasWidth - size.width),
      y: clamp(fallback.y, 0, metrics.canvasHeight - size.height),
    }

    placed.push({
      number: numbers[i]!,
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      placed: chosen !== null,
    })
  }

  return placed
}

/**
 * Métriques dérivées de la largeur de l'image, exprimées en millimètres
 * imprimés. Une seule source pour le rendu et pour le placement : sinon les
 * étiquettes seraient calculées à une taille et dessinées à une autre.
 */
export function metricsFor(width: number, height: number): LabelMetrics {
  const pixelsPerMm = width / PAGE_WIDTH_MM
  return {
    dotRadius: 0.55 * pixelsPerMm,
    fontSize: 2.4 * pixelsPerMm,
    canvasWidth: width,
    canvasHeight: height,
  }
}

/**
 * Retire les points dont le numéro n'a trouvé aucune place, puis renumérote. Une
 * séquence ne descend jamais sous trois points : mieux vaut un numéro serré qu'une
 * séquence amputée.
 */
export function dropUnplaceable(
  sequences: DotSequence[],
  labels: PlacedLabel[],
  floor = 3,
): DotSequence[] {
  const doomed = new Set<number>()
  for (const label of labels) {
    if (!label.placed) doomed.add(label.number)
  }
  if (doomed.size === 0) return sequences

  const kept: DotSequence[] = []
  let running = 1

  for (const sequence of sequences) {
    const survivors = sequence.dots.filter(
      (_, index) => !doomed.has(sequence.firstNumber + index),
    )
    const dots = survivors.length >= floor ? survivors : sequence.dots
    kept.push({ dots, closed: sequence.closed, firstNumber: running })
    running += dots.length
  }

  return kept
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value))
}
