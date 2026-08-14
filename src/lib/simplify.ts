import type { Point, Trail } from '@/lib/types'

export interface DotOptions {
  /**
   * Écart maximal toléré, en pixels, entre le segment tracé par l'utilisateur
   * et le trait d'origine. C'est le vrai réglage de fidélité.
   */
  tolerance?: number
  /** Distance minimale entre deux points consécutifs, pour que les numéros restent lisibles. */
  minSpacing?: number
  /** Budget de points. La tolérance est ajustée pour s'en approcher au mieux. */
  maxDots?: number
  /** Longueur minimale d'un parcours pour mériter une séquence. */
  minTrailLength?: number
}

/** Distance d'un point au segment [a, b]. */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(p.x - a.x, p.y - a.y)

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/**
 * Ramer-Douglas-Peucker, version itérative (une version récursive déborde la
 * pile sur les chaînes de plusieurs milliers de pixels).
 *
 * Renvoie les **indices** conservés plutôt que les points : garder le lien avec
 * le tracé d'origine permet ensuite de mesurer l'écart exactement, sans avoir à
 * réapparier les deux courbes après coup.
 */
export function simplifyIndices(points: Point[], tolerance: number): number[] {
  if (points.length <= 2) return points.map((_, index) => index)

  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1

  const stack: [number, number][] = [[0, points.length - 1]]

  while (stack.length > 0) {
    const [first, last] = stack.pop()!
    if (last <= first + 1) continue

    const a = points[first]!
    const b = points[last]!
    let worst = -1
    let worstDistance = 0

    for (let i = first + 1; i < last; i++) {
      const distance = distanceToSegment(points[i]!, a, b)
      if (distance > worstDistance) {
        worstDistance = distance
        worst = i
      }
    }

    if (worstDistance > tolerance && worst !== -1) {
      keep[worst] = 1
      stack.push([first, worst], [worst, last])
    }
  }

  const indices: number[] = []
  for (let i = 0; i < points.length; i++) {
    if (keep[i]) indices.push(i)
  }
  return indices
}

export function simplify(points: Point[], tolerance: number): Point[] {
  return simplifyIndices(points, tolerance).map((index) => points[index]!)
}

/**
 * Écarte les points trop rapprochés. On préserve toujours les extrémités et on
 * tolère un virage marqué plus serré que le reste, mais jamais collé : deux
 * pastilles superposées rendent les numéros illisibles.
 */
function enforceSpacingIndices(
  points: Point[],
  indices: number[],
  minSpacing: number,
  closed: boolean,
): number[] {
  if (indices.length <= 2 || minSpacing <= 0) return [...indices]

  const cornerSpacing = minSpacing * 0.6
  const kept: number[] = [indices[0]!]

  for (let i = 1; i < indices.length - 1; i++) {
    const candidate = points[indices[i]!]!
    const previous = points[kept[kept.length - 1]!]!
    const gap = Math.hypot(candidate.x - previous.x, candidate.y - previous.y)

    if (gap >= minSpacing) {
      kept.push(indices[i]!)
      continue
    }
    const next = points[indices[i + 1]!]!
    if (gap >= cornerSpacing && turnAngle(previous, candidate, next) > Math.PI / 3) {
      kept.push(indices[i]!)
    }
  }

  // L'extrémité est obligatoire : on retire plutôt les points qu'elle vient
  // serrer, sans jamais descendre sous deux points.
  const lastIndex = indices[indices.length - 1]!
  const last = points[lastIndex]!
  while (kept.length > 1) {
    const tail = points[kept[kept.length - 1]!]!
    if (Math.hypot(last.x - tail.x, last.y - tail.y) >= cornerSpacing) break
    kept.pop()
  }
  kept.push(lastIndex)

  // Sur une boucle, le dernier point revient sur le premier : il ferait doublon.
  if (closed && kept.length > 2) {
    const head = points[kept[0]!]!
    const foot = points[kept[kept.length - 1]!]!
    if (Math.hypot(head.x - foot.x, head.y - foot.y) < cornerSpacing) kept.pop()
  }

  return kept
}

export function enforceSpacing(points: Point[], minSpacing: number, closed: boolean): Point[] {
  const indices = enforceSpacingIndices(
    points,
    points.map((_, index) => index),
    minSpacing,
    closed,
  )
  return indices.map((index) => points[index]!)
}

function turnAngle(a: Point, b: Point, c: Point): number {
  const angle = Math.abs(Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x))
  return angle > Math.PI ? 2 * Math.PI - angle : angle
}

/**
 * Écart exact entre le tracé d'origine et la ligne brisée obtenue en reliant les
 * points retenus.
 *
 * Comme les points retenus sont un sous-ensemble ordonné du tracé, chaque pixel
 * d'origine se rattache sans ambiguïté au segment qui l'encadre. Pas
 * d'appariement approximatif : sur un parcours qui repasse près de lui-même, une
 * recherche du segment le plus proche donnerait n'importe quoi.
 */
export function deviationByIndices(points: Point[], indices: number[], closed: boolean): number {
  if (indices.length < 2) return 0

  let worst = 0

  for (let k = 0; k < indices.length - 1; k++) {
    const from = indices[k]!
    const to = indices[k + 1]!
    const a = points[from]!
    const b = points[to]!
    for (let i = from + 1; i < to; i++) {
      const distance = distanceToSegment(points[i]!, a, b)
      if (distance > worst) worst = distance
    }
  }

  // Le segment de fermeture couvre la queue du tracé restée après le dernier
  // point retenu.
  if (closed) {
    const a = points[indices[indices.length - 1]!]!
    const b = points[indices[0]!]!
    for (let i = indices[indices.length - 1]! + 1; i < points.length; i++) {
      const distance = distanceToSegment(points[i]!, a, b)
      if (distance > worst) worst = distance
    }
  }

  return worst
}

export interface DotPlacement {
  sequences: { dots: Point[]; closed: boolean }[]
  tolerance: number
  maxDeviation: number
  /** Parcours écartés car trop courts pour porter deux points lisibles. */
  droppedTrails: number
  /** Longueur de dessin ainsi perdue. À surveiller : rien ne doit disparaître en silence. */
  droppedLength: number
}

/**
 * Place les points sur chaque parcours. Si un budget est donné, la tolérance est
 * ajustée par dichotomie : l'utilisateur demande « environ 400 points » et le
 * moteur trouve la fidélité correspondante, plutôt que l'inverse.
 */
export function placeDots(trails: Trail[], options: DotOptions = {}): DotPlacement {
  const { tolerance = 1.8, minSpacing = 7, maxDots, minTrailLength = 0 } = options

  const eligible = trails.filter((trail) => trail.length >= minTrailLength)
  const tooShort = trails.filter((trail) => trail.length < minTrailLength)
  const droppedShortLength = tooShort.reduce((total, trail) => total + trail.length, 0)

  const run = (currentTolerance: number): DotPlacement => {
    const kept: { dots: Point[]; closed: boolean }[] = []
    let maxDeviation = 0
    let collapsedTrails = 0
    let collapsedLength = 0

    for (const trail of eligible) {
      const simplified = simplifyIndices(trail.points, currentTolerance)
      const indices = enforceSpacingIndices(trail.points, simplified, minSpacing, trail.closed)


      const usable = promoteToThreeDots(trail.points, indices, minSpacing, trail.closed)

      // Une séquence de deux points n'est qu'un segment isolé : elle coûte un
      // lever de crayon et deux numéros pour presque rien. On préfère lui ajouter
      // son point milieu, et ne l'écarter que si elle est trop courte pour le
      // porter.
      if (usable === null) {
        collapsedTrails++
        collapsedLength += trail.length
        continue
      }

      const dots = usable.map((index) => trail.points[index]!)
      if (spanOf(dots, trail.closed) < minSpacing) {
        collapsedTrails++
        collapsedLength += trail.length
        continue
      }

      kept.push({ dots, closed: trail.closed })
      maxDeviation = Math.max(maxDeviation, deviationByIndices(trail.points, indices, trail.closed))
    }

    return {
      sequences: kept,
      tolerance: currentTolerance,
      maxDeviation,
      droppedTrails: tooShort.length + collapsedTrails,
      droppedLength: droppedShortLength + collapsedLength,
    }
  }

  if (maxDots === undefined) return run(tolerance)

  // Le budget est une cible, pas seulement un plafond : on cherche la plus
  // petite tolérance (donc la meilleure fidélité) qui tienne dedans, en montant
  // ou en descendant selon le cas. Sous le plancher on ne suivrait plus que le
  // bruit de compression du JPEG.
  const FLOOR = 0.6
  let low = FLOOR
  let high = Math.max(tolerance, FLOOR)

  while (countDots(run(high)) > maxDots && high < 512) high *= 2
  if (countDots(run(low)) <= maxDots) return run(low)

  for (let i = 0; i < 20 && high - low > 0.02; i++) {
    const middle = (low + high) / 2
    if (countDots(run(middle)) > maxDots) low = middle
    else high = middle
  }

  return run(high)
}

function countDots(placement: DotPlacement): number {
  return placement.sequences.reduce((total, sequence) => total + sequence.dots.length, 0)
}

/**
 * Garantit au moins trois points par séquence.
 *
 * Un segment isolé à deux numéros n'apporte rien et coûte un lever de crayon. On
 * y insère donc le point du tracé le plus proche de son milieu, à condition que
 * les deux moitiés restent lisibles. Renvoie `null` si la séquence est trop
 * courte pour le porter : elle doit alors être écartée.
 */
function promoteToThreeDots(
  points: Point[],
  indices: number[],
  minSpacing: number,
  closed: boolean,
): number[] | null {
  if (indices.length >= 3) return indices
  if (indices.length < 2) return null

  const cornerSpacing = minSpacing * 0.6
  const spread = (chosen: number[]): number[] | null => {
    for (let i = 1; i < chosen.length; i++) {
      const previous = points[chosen[i - 1]!]!
      const current = points[chosen[i]!]!
      if (Math.hypot(current.x - previous.x, current.y - previous.y) < cornerSpacing) return null
    }
    return chosen
  }

  // Sur une boucle, les deux extrémités retenues sont le **même** point du tracé.
  // Y insérer le milieu donnerait trois pastilles dont deux exactement
  // superposées, donc deux numéros au même endroit. On répartit donc sur le tour.
  if (closed) {
    const third = Math.floor(points.length / 3)
    if (third < 1) return null
    const candidates = [0, third, 2 * third]
    if (new Set(candidates).size < 3) return null
    return spread(candidates)
  }

  const first = indices[0]!
  const last = indices[1]!
  const middle = Math.floor((first + last) / 2)
  if (middle === first || middle === last) return null

  return spread([first, middle, last])
}

/** Longueur de la ligne brisée reliant les pastilles, fermeture comprise. */
function spanOf(dots: Point[], closed: boolean): number {
  let total = 0
  for (let i = 1; i < dots.length; i++) {
    total += Math.hypot(dots[i]!.x - dots[i - 1]!.x, dots[i]!.y - dots[i - 1]!.y)
  }
  if (closed && dots.length > 2) {
    const head = dots[0]!
    const foot = dots[dots.length - 1]!
    total += Math.hypot(head.x - foot.x, head.y - foot.y)
  }
  return total
}
