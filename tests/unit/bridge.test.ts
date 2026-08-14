import { describe, expect, it } from 'vitest'
import { bridgeOddVertices } from '@/lib/bridge'
import { decomposeTrails, minimumTrailCount } from '@/lib/trails'
import type { GraphEdge, Point, SkeletonGraph } from '@/lib/types'

function graphOf(nodes: [number, number][], links: [number, number, Point[]][]): SkeletonGraph {
  const edges: GraphEdge[] = links.map(([a, b, points], id) => {
    let length = 0
    for (let i = 1; i < points.length; i++) {
      length += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y)
    }
    return { id, a, b, points, length }
  })

  const graph: SkeletonGraph = {
    nodes: nodes.map(([x, y], id) => ({ id, x, y, degree: 0 })),
    edges,
  }
  for (const edge of graph.edges) {
    graph.nodes[edge.a]!.degree++
    graph.nodes[edge.b]!.degree++
  }
  return graph
}

/** Deux traits parallèles dont les extrémités se font face à `gap` pixels. */
function twoStrokes(gap: number): SkeletonGraph {
  return graphOf(
    [
      [0, 0],
      [10, 0],
      [10 + gap, 0],
      [20 + gap, 0],
    ],
    [
      [
        0,
        1,
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
      ],
      [
        2,
        3,
        [
          { x: 10 + gap, y: 0 },
          { x: 20 + gap, y: 0 },
        ],
      ],
    ],
  )
}

describe('bridgeOddVertices', () => {
  it('ne touche à rien quand la distance autorisée est nulle', () => {
    const graph = twoStrokes(5)
    const result = bridgeOddVertices(graph, 0)
    expect(result.bridges).toBe(0)
    expect(result.graph).toBe(graph)
  })

  it('relie deux traits dont les bouts se font face', () => {
    const result = bridgeOddVertices(twoStrokes(5), 8)

    expect(result.bridges).toBe(1)
    expect(result.bridgeLength).toBeCloseTo(5)
    expect(result.graph.edges).toHaveLength(3)
    expect(result.graph.edges.filter((edge) => edge.bridge)).toHaveLength(1)
  })

  it('ignore un écart plus grand que la limite', () => {
    expect(bridgeOddVertices(twoStrokes(30), 8).bridges).toBe(0)
  })

  it('fait tomber le nombre de séquences en fusionnant deux composantes', () => {
    const separate = twoStrokes(5)
    expect(minimumTrailCount(separate)).toBe(2)

    const joined = bridgeOddVertices(separate, 8).graph
    expect(minimumTrailCount(joined)).toBe(1)
    expect(decomposeTrails(joined)).toHaveLength(1)
  })

  it('rend pairs les deux sommets appariés', () => {
    const result = bridgeOddVertices(twoStrokes(5), 8)
    const bridged = result.graph.nodes.filter((node) => node.x === 10 || node.x === 15)
    for (const node of bridged) expect(node.degree % 2).toBe(0)
  })

  it('n’utilise chaque sommet qu’une seule fois', () => {
    // Trois extrémités mutuellement proches : une seule paire peut se former, un
    // second pont sur le même sommet lui rendrait un degré impair.
    const graph = graphOf(
      [
        [0, 0],
        [10, 0],
        [12, 3],
        [22, 3],
        [12, -3],
        [22, -3],
      ],
      [
        [
          0,
          1,
          [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
          ],
        ],
        [
          2,
          3,
          [
            { x: 12, y: 3 },
            { x: 22, y: 3 },
          ],
        ],
        [
          4,
          5,
          [
            { x: 12, y: -3 },
            { x: 22, y: -3 },
          ],
        ],
      ],
    )

    const result = bridgeOddVertices(graph, 8)
    const used = new Map<number, number>()
    for (const edge of result.graph.edges) {
      if (!edge.bridge) continue
      used.set(edge.a, (used.get(edge.a) ?? 0) + 1)
      used.set(edge.b, (used.get(edge.b) ?? 0) + 1)
    }
    for (const count of used.values()) expect(count).toBe(1)
  })

  it('commence par les liaisons les plus courtes', () => {
    // Le sommet 1 peut aller vers 2 (à 3 px) ou vers 4 (à 9 px) : on attend le
    // plus discret des deux.
    const graph = graphOf(
      [
        [0, 0],
        [10, 0],
        [13, 0],
        [23, 0],
        [19, 0],
        [29, 0],
      ],
      [
        [
          0,
          1,
          [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
          ],
        ],
        [
          2,
          3,
          [
            { x: 13, y: 0 },
            { x: 23, y: 0 },
          ],
        ],
        [
          4,
          5,
          [
            { x: 19, y: 0 },
            { x: 29, y: 0 },
          ],
        ],
      ],
    )

    const bridges = bridgeOddVertices(graph, 12).graph.edges.filter((edge) => edge.bridge)
    expect(bridges.some((edge) => edge.a === 1 && edge.b === 2)).toBe(true)
  })

  it('laisse un graphe déjà entièrement pair intact', () => {
    const loop = graphOf(
      [[0, 0]],
      [
        [
          0,
          0,
          [
            { x: 0, y: 0 },
            { x: 10, y: 5 },
            { x: 0, y: 10 },
            { x: 0, y: 0 },
          ],
        ],
      ],
    )
    expect(bridgeOddVertices(loop, 20).bridges).toBe(0)
  })
})
