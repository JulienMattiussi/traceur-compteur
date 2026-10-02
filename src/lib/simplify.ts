import type { Point } from '@/lib/types'

/**
 * Géométrie pure sur des lignes brisées : distance à un segment, simplification
 * de Ramer-Douglas-Peucker, et mesure exacte de l'écart au tracé d'origine.
 * Rien ici ne connaît la notion de puzzle.
 */

/** Longueur d'une ligne brisée, segment de fermeture compris pour une boucle. */
export function polylineLength(points: Point[], closed = false): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y)
  }
  if (closed && points.length > 2) {
    const head = points[0]!
    const foot = points[points.length - 1]!
    total += Math.hypot(head.x - foot.x, head.y - foot.y)
  }
  return total
}

/**
 * Prolonge `target` par `points` sans répéter le point de jonction : deux traits
 * mis bout à bout partagent leur extrémité commune.
 */
export function appendPath(target: Point[], points: Point[]): void {
  for (const point of points) {
    const last = target[target.length - 1]
    if (last && last.x === point.x && last.y === point.y) continue
    target.push(point)
  }
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
