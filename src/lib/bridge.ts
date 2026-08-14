import type { GraphEdge, SkeletonGraph } from '@/lib/types'

export interface BridgeResult {
  graph: SkeletonGraph
  /** Nombre de liaisons ajoutées. */
  bridges: number
  /** Longueur totale ajoutée au dessin, en pixels. */
  bridgeLength: number
}

/**
 * Relie par un segment droit les sommets de degré impair assez proches.
 *
 * C'est le seul levier qui réduit vraiment le nombre de séquences. Un sommet de
 * degré impair force une fin de parcours : sur un T, un trajet peut traverser la
 * jonction en empruntant deux des trois traits, jamais les trois. Le troisième
 * doit donc démarrer ou finir là.
 *
 * Un pont entre deux sommets impairs les rend tous les deux pairs, et supprime
 * une séquence. Le prix à payer : un trait droit que l'utilisateur va dessiner et
 * qui n'existait pas dans l'image. D'où la limite de distance, qui garde ces
 * ajouts courts et donc invisibles, et qui laisse naturellement séparés les
 * objets réellement éloignés.
 *
 * Un pont entre deux composantes distinctes les fusionne, ce qui économise une
 * séquence de plus.
 */
export function bridgeOddVertices(graph: SkeletonGraph, maxDistance: number): BridgeResult {
  if (maxDistance <= 0) return { graph, bridges: 0, bridgeLength: 0 }

  const odd = graph.nodes.filter((node) => node.degree % 2 === 1)
  if (odd.length < 2) return { graph, bridges: 0, bridgeLength: 0 }

  interface Candidate {
    a: number
    b: number
    distance: number
  }

  const candidates: Candidate[] = []
  for (let i = 0; i < odd.length; i++) {
    for (let j = i + 1; j < odd.length; j++) {
      const from = odd[i]!
      const to = odd[j]!
      const distance = Math.hypot(to.x - from.x, to.y - from.y)
      if (distance <= maxDistance) candidates.push({ a: from.id, b: to.id, distance })
    }
  }

  // Du plus court au plus long : les liaisons les plus discrètes d'abord. Chaque
  // sommet ne sert qu'une fois, un second pont lui rendrait un degré impair.
  candidates.sort((left, right) => left.distance - right.distance)

  const paired = new Set<number>()
  const added: GraphEdge[] = []
  let nextId = graph.edges.reduce((max, edge) => Math.max(max, edge.id), -1) + 1
  let bridgeLength = 0

  for (const candidate of candidates) {
    if (paired.has(candidate.a) || paired.has(candidate.b)) continue
    paired.add(candidate.a)
    paired.add(candidate.b)

    const from = graph.nodes.find((node) => node.id === candidate.a)!
    const to = graph.nodes.find((node) => node.id === candidate.b)!

    added.push({
      id: nextId++,
      a: candidate.a,
      b: candidate.b,
      points: [
        { x: Math.round(from.x), y: Math.round(from.y) },
        { x: Math.round(to.x), y: Math.round(to.y) },
      ],
      length: candidate.distance,
      bridge: true,
    })
    bridgeLength += candidate.distance
  }

  if (added.length === 0) return { graph, bridges: 0, bridgeLength: 0 }

  const nodes = graph.nodes.map((node) => ({ ...node, degree: node.degree }))
  const edges = [...graph.edges, ...added]
  const byId = new Map(nodes.map((node) => [node.id, node]))
  for (const node of nodes) node.degree = 0
  for (const edge of edges) {
    byId.get(edge.a)!.degree++
    byId.get(edge.b)!.degree++
  }

  return { graph: { nodes, edges }, bridges: added.length, bridgeLength }
}
