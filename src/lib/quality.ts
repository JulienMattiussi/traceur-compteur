import type { Ambiguity, DotSequence, Point } from '@/lib/types'

/**
 * Index spatial à cases régulières. Suffisant ici : les points d'un puzzle sont
 * répartis de façon assez homogène, et ça évite un O(n²) sur 800 points.
 */
class PointGrid {
  private readonly cells = new Map<number, number[]>()
  private readonly columns: number
  private readonly points: Point[]
  private readonly cellSize: number

  constructor(points: Point[], cellSize: number, width: number) {
    this.points = points
    this.cellSize = cellSize
    this.columns = Math.max(1, Math.ceil(width / cellSize) + 1)
    for (let i = 0; i < points.length; i++) {
      const key = this.keyOf(points[i]!)
      const bucket = this.cells.get(key)
      if (bucket) bucket.push(i)
      else this.cells.set(key, [i])
    }
  }

  private keyOf(point: Point): number {
    const cx = Math.floor(point.x / this.cellSize)
    const cy = Math.floor(point.y / this.cellSize)
    return cy * this.columns + cx
  }

  /** Indices des points situés à moins de `radius` de `from`. */
  within(from: Point, radius: number): number[] {
    const span = Math.ceil(radius / this.cellSize)
    const cx = Math.floor(from.x / this.cellSize)
    const cy = Math.floor(from.y / this.cellSize)
    const found: number[] = []

    for (let dy = -span; dy <= span; dy++) {
      for (let dx = -span; dx <= span; dx++) {
        const bucket = this.cells.get((cy + dy) * this.columns + (cx + dx))
        if (!bucket) continue
        for (const index of bucket) {
          const point = this.points[index]!
          if (Math.hypot(point.x - from.x, point.y - from.y) <= radius) found.push(index)
        }
      }
    }

    return found
  }
}

export interface QualityReport {
  ambiguities: Ambiguity[]
  minSpacing: number
}

/**
 * Le critère qui décide si un puzzle est jouable : depuis le point n, le point
 * n+1 doit être le plus proche. Sinon l'utilisateur part vers un voisin plus
 * tentant et le dessin se casse.
 *
 * Aucun des générateurs existants ne mesure ça, parce qu'un contour extérieur
 * unique est trivialement non ambigu. Dès qu'on ajoute des traits intérieurs qui
 * se croisent, c'est la contrainte dominante.
 */
export function checkQuality(sequences: DotSequence[], width: number): QualityReport {
  const flat = sequences.flatMap((sequence) => sequence.dots)
  if (flat.length < 2) return { ambiguities: [], minSpacing: Infinity }

  const grid = new PointGrid(flat, 24, width)
  const offsets: number[] = []
  let running = 0
  for (const sequence of sequences) {
    offsets.push(running)
    running += sequence.dots.length
  }

  const ambiguities: Ambiguity[] = []
  let minSpacing = Infinity

  for (let s = 0; s < sequences.length; s++) {
    const sequence = sequences[s]!
    const dots = sequence.dots
    const base = offsets[s]!
    const lastIndex = sequence.closed ? dots.length - 1 : dots.length - 2

    for (let i = 0; i <= lastIndex; i++) {
      const from = dots[i]!
      const nextIndex = (i + 1) % dots.length
      const to = dots[nextIndex]!
      const expected = Math.hypot(to.x - from.x, to.y - from.y)
      minSpacing = Math.min(minSpacing, expected)

      const selfIndex = base + i
      const targetIndex = base + nextIndex
      // Le point d'où l'on vient reste visuellement proche mais n'induit pas en
      // erreur : l'utilisateur sait qu'il en sort.
      const previousIndex = i > 0 ? base + i - 1 : sequence.closed ? base + dots.length - 1 : -1

      let closest = expected
      let culprit = -1
      for (const candidate of grid.within(from, expected)) {
        if (candidate === selfIndex || candidate === targetIndex) continue
        if (candidate === previousIndex) continue
        const point = flat[candidate]!
        const distance = Math.hypot(point.x - from.x, point.y - from.y)
        if (distance < closest) {
          closest = distance
          culprit = candidate
        }
      }

      if (culprit !== -1) {
        ambiguities.push({
          sequence: s,
          index: i,
          number: sequence.firstNumber + i,
          expected,
          actual: closest,
        })
      }
    }
  }

  return { ambiguities, minSpacing }
}
