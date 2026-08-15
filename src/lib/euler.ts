import type { GraphEdge } from '@/lib/types'

/**
 * Circuit eulérien et découpage en parcours.
 *
 * Hierholzer (1873) construit un circuit qui emprunte chaque arête exactement une
 * fois. Les arêtes virtuelles ajoutées en amont pour rendre tous les degrés pairs
 * sont ensuite retirées : chaque coupure sépare deux séquences du puzzle.
 */

export interface Link {
  /** Identifiant unique parmi arêtes réelles et arêtes virtuelles. */
  key: number
  /** Arête réelle, ou null pour une arête virtuelle d'appariement. */
  edge: GraphEdge | null
  to: number
}

/** Un pas du circuit : une arête empruntée dans un sens donné. */
export interface TourStep {
  edge: GraphEdge | null
  from: number
  to: number
}

/** Un pas d'un parcours réel (arête garantie non virtuelle). */
export interface Step extends TourStep {
  edge: GraphEdge
}

/** Hierholzer itératif : renvoie le circuit eulérien comme une suite de pas. */
export function eulerTour(start: number, adjacency: Map<number, Link[]>, used: Uint8Array): TourStep[] {
  const stack: { node: number; via: Link | null }[] = [{ node: start, via: null }]
  const cursor = new Map<number, number>()
  const popped: { node: number; via: Link | null }[] = []

  while (stack.length > 0) {
    const top = stack[stack.length - 1]!
    const links = adjacency.get(top.node) ?? []

    let index = cursor.get(top.node) ?? 0
    while (index < links.length && used[links[index]!.key]) index++
    cursor.set(top.node, index)

    if (index === links.length) {
      popped.push(stack.pop()!)
      continue
    }

    const next = links[index]!
    used[next.key] = 1
    stack.push({ node: next.to, via: next })
  }

  // Hierholzer produit le circuit à l'envers : popped[0] est la fin.
  popped.reverse()

  const tour: TourStep[] = []
  for (let i = 1; i < popped.length; i++) {
    tour.push({
      edge: popped[i]!.via!.edge,
      from: popped[i - 1]!.node,
      to: popped[i]!.node,
    })
  }
  return tour
}

/**
 * Coupe le circuit à chaque arête virtuelle. On fait d'abord tourner le circuit
 * pour qu'il commence sur une coupure : sinon le premier et le dernier fragment
 * appartiendraient au même parcours et il faudrait les recoller.
 */
export function splitAtVirtualLinks(tour: TourStep[]): Step[][] {
  const firstCut = tour.findIndex((step) => step.edge === null)
  if (firstCut === -1) return tour.length > 0 ? [tour as Step[]] : []

  const rotated = [...tour.slice(firstCut), ...tour.slice(0, firstCut)]
  const groups: Step[][] = []
  let current: Step[] = []

  for (const step of rotated) {
    if (step.edge === null) {
      if (current.length > 0) groups.push(current)
      current = []
    } else {
      current.push(step as Step)
    }
  }
  if (current.length > 0) groups.push(current)

  return groups
}
