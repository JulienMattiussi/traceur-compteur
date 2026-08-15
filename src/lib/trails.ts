import { eulerTour, splitAtVirtualLinks, type Link, type Step } from '@/lib/euler'
import type { GraphEdge, Point, SkeletonGraph, Trail } from '@/lib/types'

/**
 * Découpe le dessin en un nombre **minimal** de séquences numérotées, chacune
 * parcourant ses traits sans jamais repasser deux fois au même endroit.
 */

/**
 * Nombre minimal de séquences nécessaires pour couvrir tout le dessin sans
 * repasser sur un trait.
 *
 * Pour chaque composante connexe, le théorème d'Euler donne exactement
 * `max(1, impairs / 2)` : un dessin dont tous les sommets sont de degré pair se
 * parcourt d'un seul trait, sinon il faut une séquence par paire de sommets de
 * degré impair. C'est cette borne que `decomposeTrails` atteint, ce qui rend le
 * résultat optimal et pas seulement correct.
 */
export function minimumTrailCount(graph: SkeletonGraph): number {
  let total = 0
  for (const component of components(graph)) {
    const odd = component.nodes.filter((id) => graph.nodes[id]!.degree % 2 === 1).length
    total += Math.max(1, odd / 2)
  }
  return total
}

/** Découpe le graphe en un nombre minimal de parcours couvrant chaque arête une fois. */
export function decomposeTrails(graph: SkeletonGraph): Trail[] {
  const trails: Trail[] = []

  for (const component of components(graph)) {
    const oddNodes = component.nodes.filter((id) => graph.nodes[id]!.degree % 2 === 1)
    const pairs = pairUpByProximity(oddNodes, graph)

    const adjacency = new Map<number, Link[]>()
    for (const id of component.nodes) adjacency.set(id, [])

    const link = (from: number, to: number, key: number, edge: GraphEdge | null): void => {
      adjacency.get(from)!.push({ key, edge, to })
    }

    for (const edgeId of component.edges) {
      const edge = graph.edges[edgeId]!
      link(edge.a, edge.b, edge.id, edge)
      if (edge.a !== edge.b) link(edge.b, edge.a, edge.id, edge)
    }

    // Les arêtes virtuelles rendent tous les degrés pairs, donc un circuit
    // eulérien existe. On les retire ensuite : chaque coupure sépare deux
    // séquences.
    let virtualKey = graph.edges.length
    for (const [a, b] of pairs) {
      link(a, b, virtualKey, null)
      link(b, a, virtualKey, null)
      virtualKey++
    }

    const start = pairs.length > 0 ? pairs[0]![0] : component.nodes[0]!
    const tour = eulerTour(start, adjacency, new Uint8Array(virtualKey))

    for (const steps of splitAtVirtualLinks(tour)) {
      if (steps.length > 0) trails.push(buildTrail(steps))
    }
  }

  return orderTrails(trails)
}

interface Component {
  nodes: number[]
  edges: number[]
}

function components(graph: SkeletonGraph): Component[] {
  const incident = new Map<number, number[]>()
  for (const node of graph.nodes) incident.set(node.id, [])
  for (const edge of graph.edges) {
    incident.get(edge.a)!.push(edge.id)
    if (edge.a !== edge.b) incident.get(edge.b)!.push(edge.id)
  }

  const seen = new Set<number>()
  const result: Component[] = []

  for (const node of graph.nodes) {
    if (seen.has(node.id)) continue

    const nodes: number[] = []
    const edges = new Set<number>()
    const stack = [node.id]
    seen.add(node.id)

    while (stack.length > 0) {
      const id = stack.pop()!
      nodes.push(id)
      for (const edgeId of incident.get(id)!) {
        edges.add(edgeId)
        const edge = graph.edges[edgeId]!
        const other = edge.a === id ? edge.b : edge.a
        if (seen.has(other)) continue
        seen.add(other)
        stack.push(other)
      }
    }

    if (edges.size > 0) result.push({ nodes, edges: [...edges] })
  }

  return result
}

/**
 * Apparie les sommets de degré impair deux à deux, au plus proche. Le choix des
 * paires ne change pas le nombre de séquences (il est déjà optimal) mais dicte
 * où le crayon se lève : apparier des sommets voisins donne des séquences
 * spatialement cohérentes plutôt que des zigzags à travers le dessin.
 */
function pairUpByProximity(oddNodes: number[], graph: SkeletonGraph): [number, number][] {
  const remaining = new Set(oddNodes)
  const pairs: [number, number][] = []

  for (const a of oddNodes) {
    if (!remaining.has(a)) continue
    remaining.delete(a)

    const from = graph.nodes[a]!
    let best = -1
    let bestDistance = Infinity
    for (const b of remaining) {
      const to = graph.nodes[b]!
      const distance = Math.hypot(to.x - from.x, to.y - from.y)
      if (distance < bestDistance) {
        bestDistance = distance
        best = b
      }
    }

    if (best !== -1) {
      remaining.delete(best)
      pairs.push([a, best])
    }
  }

  return pairs
}

function buildTrail(steps: Step[]): Trail {
  const points: Point[] = []
  const edgeIds: number[] = []

  for (const step of steps) {
    edgeIds.push(step.edge.id)
    const forward = step.edge.a === step.from
    const chain = forward ? step.edge.points : [...step.edge.points].reverse()

    for (const point of chain) {
      const last = points[points.length - 1]
      if (last && last.x === point.x && last.y === point.y) continue
      points.push(point)
    }
  }

  let length = 0
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!
    const cur = points[i]!
    length += Math.hypot(cur.x - prev.x, cur.y - prev.y)
  }

  const closed = steps[0]!.from === steps[steps.length - 1]!.to

  return { edgeIds, points, closed, length }
}

/**
 * Ordonne les parcours pour que le crayon voyage le moins possible entre deux
 * séquences : on part du plus long, puis on enchaîne au plus proche, en
 * autorisant l'inversion d'un parcours ouvert.
 */
function orderTrails(trails: Trail[]): Trail[] {
  if (trails.length <= 1) return trails

  const remaining = new Set(trails.keys())
  let currentIndex = 0
  for (const index of remaining) {
    if (trails[index]!.length > trails[currentIndex]!.length) currentIndex = index
  }

  const ordered: Trail[] = [trails[currentIndex]!]
  remaining.delete(currentIndex)

  while (remaining.size > 0) {
    const previous = ordered[ordered.length - 1]!
    const tail = previous.points[previous.points.length - 1]!

    let best = -1
    let bestDistance = Infinity
    let bestReversed = false

    for (const index of remaining) {
      const candidate = trails[index]!
      const head = candidate.points[0]!
      const foot = candidate.points[candidate.points.length - 1]!

      const toHead = Math.hypot(head.x - tail.x, head.y - tail.y)
      if (toHead < bestDistance) {
        bestDistance = toHead
        best = index
        bestReversed = false
      }
      if (!candidate.closed) {
        const toFoot = Math.hypot(foot.x - tail.x, foot.y - tail.y)
        if (toFoot < bestDistance) {
          bestDistance = toFoot
          best = index
          bestReversed = true
        }
      }
    }

    const chosen = trails[best]!
    remaining.delete(best)
    ordered.push(
      bestReversed
        ? {
            ...chosen,
            points: [...chosen.points].reverse(),
            edgeIds: [...chosen.edgeIds].reverse(),
          }
        : chosen,
    )
  }

  return ordered
}

