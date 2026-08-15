import { describe, expect, it } from 'vitest'
import { buildGraph } from '@/lib/graph'
import { dissolveDegreeTwoNodes, dropDegenerateLoops, pruneSpurs } from '@/lib/graph-cleanup'
import { thin } from '@/lib/thin'
import type { GraphEdge, Point, SkeletonGraph } from '@/lib/types'
import { circle, createMask, line, rectangle } from '../fixtures'

/** Construit un graphe à la main, pour tester les nettoyages sans passer par une image. */
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

describe('buildGraph', () => {
  it('reconnaît une boucle fermée sans jonction', () => {
    const mask = createMask(80, 80)
    circle(mask, 40, 40, 25)
    const graph = buildGraph(thin(mask))

    // Un cercle n'a ni extrémité ni jonction : un seul sommet arbitraire portant
    // une arête refermée sur elle-même.
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0]!.a).toBe(graph.edges[0]!.b)
    expect(graph.nodes.filter((node) => node.degree >= 3)).toHaveLength(0)
    expect(graph.edges[0]!.length).toBeGreaterThan(100)
  })

  it('trouve la jonction et les branches d’un T', () => {
    const mask = createMask(60, 60)
    line(mask, { x: 5, y: 20 }, { x: 54, y: 20 })
    line(mask, { x: 30, y: 20 }, { x: 30, y: 54 })

    const graph = buildGraph(thin(mask))

    expect(graph.edges).toHaveLength(3)
    expect(graph.nodes.filter((node) => node.degree === 1)).toHaveLength(3)
    expect(graph.nodes.filter((node) => node.degree === 3)).toHaveLength(1)
  })

  it('trouve les quatre branches d’une croix', () => {
    const mask = createMask(60, 60)
    line(mask, { x: 5, y: 30 }, { x: 54, y: 30 })
    line(mask, { x: 30, y: 5 }, { x: 30, y: 54 })

    const graph = buildGraph(thin(mask))

    expect(graph.edges).toHaveLength(4)
    expect(graph.nodes.filter((node) => node.degree === 1)).toHaveLength(4)
    const junctions = graph.nodes.filter((node) => node.degree === 4)
    expect(junctions).toHaveLength(1)
    expect(junctions[0]!.x).toBeCloseTo(30, 0)
  })

  it('garde le tracé intérieur, ce qu’un contour extérieur perdrait', () => {
    // Un carré avec une barre intérieure : le contour extérieur ne verrait que
    // le carré.
    const mask = createMask(80, 80)
    rectangle(mask, 10, 10, 69, 69, 3)
    line(mask, { x: 10, y: 40 }, { x: 69, y: 40 }, 3)

    const graph = buildGraph(thin(mask))

    expect(graph.nodes.filter((node) => node.degree >= 3).length).toBeGreaterThanOrEqual(2)
    // Le carré coupé en deux par une barre donne au moins trois traits.
    expect(graph.edges.length).toBeGreaterThanOrEqual(3)
  })

  it('couvre chaque pixel du squelette par exactement une arête', () => {
    const mask = createMask(70, 70)
    rectangle(mask, 10, 10, 59, 59, 3)
    line(mask, { x: 10, y: 35 }, { x: 59, y: 35 }, 3)
    const skeleton = thin(mask)
    const graph = buildGraph(skeleton)

    const covered = new Set<string>()
    for (const edge of graph.edges) {
      for (const point of edge.points) covered.add(`${point.x},${point.y}`)
    }

    let skeletonPixels = 0
    let coveredPixels = 0
    for (let i = 0; i < skeleton.data.length; i++) {
      if (skeleton.data[i] !== 1) continue
      skeletonPixels++
      const x = i % skeleton.width
      const y = (i - x) / skeleton.width
      if (covered.has(`${x},${y}`)) coveredPixels++
    }

    expect(skeletonPixels).toBeGreaterThan(150)
    // Un amas de pixels formant une jonction n'est représenté que par ceux qui
    // servent d'extrémité aux traits : quelques pixels du coeur d'un amas ne
    // ressortent pas, mais aucun trait n'est perdu.
    expect(coveredPixels / skeletonPixels).toBeGreaterThan(0.95)
  })

  it('supprime les barbules plus courtes que le seuil', () => {
    const mask = createMask(60, 60)
    line(mask, { x: 5, y: 30 }, { x: 54, y: 30 })
    // Une barbule de 4 px, typique d'un contour irrégulier.
    line(mask, { x: 30, y: 30 }, { x: 30, y: 26 })

    const withSpur = buildGraph(thin(mask))
    expect(withSpur.edges.length).toBeGreaterThanOrEqual(3)

    const pruned = buildGraph(thin(mask), { pruneSpursBelow: 10 })
    expect(pruned.edges).toHaveLength(1)
    expect(pruned.nodes.filter((node) => node.degree >= 3)).toHaveLength(0)
  })

  it('ignore un masque vide', () => {
    const graph = buildGraph(createMask(20, 20))
    expect(graph.nodes).toHaveLength(0)
    expect(graph.edges).toHaveLength(0)
  })
})

describe('dissolveDegreeTwoNodes', () => {
  it('recolle deux traits séparés par un faux sommet', () => {
    // A --- B --- C, où B n'est ni une extrémité ni une jonction.
    const graph = graphOf(
      [
        [0, 0],
        [10, 0],
        [20, 0],
      ],
      [
        [
          0,
          1,
          [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 10, y: 0 },
          ],
        ],
        [
          1,
          2,
          [
            { x: 10, y: 0 },
            { x: 15, y: 0 },
            { x: 20, y: 0 },
          ],
        ],
      ],
    )

    const result = dissolveDegreeTwoNodes(graph)

    expect(result.edges).toHaveLength(1)
    expect(result.nodes).toHaveLength(2)
    expect(result.edges[0]!.length).toBeCloseTo(20)
    // Le raccord ne doit pas dupliquer le point de jointure.
    expect(result.edges[0]!.points).toHaveLength(5)
  })

  it('respecte l’orientation quand les deux traits arrivent par la même extrémité', () => {
    const graph = graphOf(
      [
        [0, 0],
        [10, 0],
        [20, 0],
      ],
      [
        [
          1,
          0,
          [
            { x: 10, y: 0 },
            { x: 0, y: 0 },
          ],
        ],
        [
          1,
          2,
          [
            { x: 10, y: 0 },
            { x: 20, y: 0 },
          ],
        ],
      ],
    )

    const result = dissolveDegreeTwoNodes(graph)
    expect(result.edges).toHaveLength(1)

    // Le tracé reste continu : aucun saut entre deux points consécutifs.
    const points = result.edges[0]!.points
    for (let i = 1; i < points.length; i++) {
      const gap = Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y)
      expect(gap).toBeLessThanOrEqual(10)
    }
  })

  it('ne dissout pas un sommet portant une boucle et un trait', () => {
    // Sans cette précaution, la fusion produirait une arête pointant vers un
    // sommet supprimé.
    const graph = graphOf(
      [
        [0, 0],
        [10, 0],
      ],
      [
        [
          1,
          1,
          [
            { x: 10, y: 0 },
            { x: 14, y: 4 },
            { x: 10, y: 8 },
            { x: 10, y: 0 },
          ],
        ],
        [
          0,
          1,
          [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
          ],
        ],
      ],
    )

    const result = dissolveDegreeTwoNodes(graph)
    expect(result.edges).toHaveLength(2)
    for (const edge of result.edges) {
      expect(result.nodes.some((node) => node.id === edge.a)).toBe(true)
      expect(result.nodes.some((node) => node.id === edge.b)).toBe(true)
    }
  })

  it('laisse une boucle isolée intacte', () => {
    const graph = graphOf(
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
    expect(dissolveDegreeTwoNodes(graph).edges).toHaveLength(1)
  })
})

describe('dropDegenerateLoops', () => {
  it('retire les micro-boucles et garde les vraies', () => {
    const graph = graphOf(
      [
        [0, 0],
        [50, 0],
      ],
      [
        [
          0,
          0,
          [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 0 },
          ],
        ],
        [
          1,
          1,
          [
            { x: 50, y: 0 },
            { x: 60, y: 10 },
            { x: 50, y: 20 },
            { x: 50, y: 0 },
          ],
        ],
      ],
    )

    const result = dropDegenerateLoops(graph, 4)
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0]!.a).toBe(1)
  })

  it('ne touche pas aux traits ouverts, même courts', () => {
    const graph = graphOf(
      [
        [0, 0],
        [2, 0],
      ],
      [
        [
          0,
          1,
          [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
          ],
        ],
      ],
    )
    expect(dropDegenerateLoops(graph, 10).edges).toHaveLength(1)
  })
})

describe('pruneSpurs', () => {
  it('retire une barbule courte accrochée à une jonction', () => {
    const graph = graphOf(
      [
        [0, 0],
        [10, 0],
        [20, 0],
        [10, 3],
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
          1,
          2,
          [
            { x: 10, y: 0 },
            { x: 20, y: 0 },
          ],
        ],
        [
          1,
          3,
          [
            { x: 10, y: 0 },
            { x: 10, y: 3 },
          ],
        ],
      ],
    )

    const result = pruneSpurs(graph, 6)
    expect(result.edges).toHaveLength(2)
  })

  it('ne coupe pas un trait dont les deux bouts sont libres', () => {
    const graph = graphOf(
      [
        [0, 0],
        [3, 0],
      ],
      [
        [
          0,
          1,
          [
            { x: 0, y: 0 },
            { x: 3, y: 0 },
          ],
        ],
      ],
    )
    expect(pruneSpurs(graph, 20).edges).toHaveLength(1)
  })
})
