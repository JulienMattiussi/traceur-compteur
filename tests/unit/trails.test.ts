import { describe, expect, it } from 'vitest'
import { buildGraph } from '@/lib/graph'
import { thin } from '@/lib/thin'
import { decomposeTrails, minimumTrailCount } from '@/lib/trails'
import type { SkeletonGraph } from '@/lib/types'
import { circle, createMask, line, rectangle } from '../fixtures'

/** Chaque arête doit être empruntée une fois et une seule. */
function expectExactCover(graph: SkeletonGraph, trails: { edgeIds: number[] }[]): void {
  const used = new Map<number, number>()
  for (const trail of trails) {
    for (const id of trail.edgeIds) used.set(id, (used.get(id) ?? 0) + 1)
  }
  expect(used.size).toBe(graph.edges.length)
  for (const count of used.values()) expect(count).toBe(1)
}

describe('minimumTrailCount', () => {
  it('donne une seule séquence pour une boucle fermée', () => {
    const mask = createMask(80, 80)
    circle(mask, 40, 40, 25)
    const graph = buildGraph(thin(mask))
    expect(minimumTrailCount(graph)).toBe(1)
  })

  it('donne une seule séquence pour un trait simple', () => {
    const mask = createMask(60, 20)
    line(mask, { x: 5, y: 10 }, { x: 54, y: 10 })
    const graph = buildGraph(thin(mask))
    // Deux extrémités, donc deux sommets impairs : 2 / 2 = 1.
    expect(minimumTrailCount(graph)).toBe(1)
  })

  it('donne deux séquences pour un T', () => {
    const mask = createMask(60, 60)
    line(mask, { x: 5, y: 20 }, { x: 54, y: 20 })
    line(mask, { x: 30, y: 20 }, { x: 30, y: 54 })
    const graph = buildGraph(thin(mask))
    // Trois extrémités (degré 1) et une jonction de degré 3 : 4 impairs, donc 2.
    expect(minimumTrailCount(graph)).toBe(2)
  })

  it('donne une séquence par composante séparée', () => {
    const mask = createMask(140, 80)
    circle(mask, 35, 40, 22)
    circle(mask, 105, 40, 22)
    const graph = buildGraph(thin(mask))
    expect(minimumTrailCount(graph)).toBe(2)
  })
})

describe('decomposeTrails', () => {
  it('atteint la borne théorique sur une croix', () => {
    const mask = createMask(60, 60)
    line(mask, { x: 5, y: 30 }, { x: 54, y: 30 })
    line(mask, { x: 30, y: 5 }, { x: 30, y: 54 })
    const graph = buildGraph(thin(mask))

    const trails = decomposeTrails(graph)
    // Quatre extrémités impaires, la jonction est de degré 4 (paire) : 4 / 2 = 2.
    expect(minimumTrailCount(graph)).toBe(2)
    expect(trails).toHaveLength(2)
    expectExactCover(graph, trails)
  })

  it('couvre chaque arête une seule fois sur une figure avec tracé intérieur', () => {
    const mask = createMask(90, 90)
    rectangle(mask, 10, 10, 79, 79, 3)
    line(mask, { x: 10, y: 45 }, { x: 79, y: 45 }, 3)
    line(mask, { x: 45, y: 10 }, { x: 45, y: 79 }, 3)
    const graph = buildGraph(thin(mask))

    const trails = decomposeTrails(graph)
    expectExactCover(graph, trails)
    expect(trails.length).toBe(minimumTrailCount(graph))
  })

  it('rend un parcours fermé pour un cercle', () => {
    const mask = createMask(80, 80)
    circle(mask, 40, 40, 25)
    const graph = buildGraph(thin(mask))

    const trails = decomposeTrails(graph)
    expect(trails).toHaveLength(1)
    expect(trails[0]!.closed).toBe(true)
  })

  it('produit des parcours géométriquement continus', () => {
    const mask = createMask(90, 90)
    rectangle(mask, 10, 10, 79, 79, 3)
    line(mask, { x: 10, y: 45 }, { x: 79, y: 45 }, 3)
    const graph = buildGraph(thin(mask))

    for (const trail of decomposeTrails(graph)) {
      for (let i = 1; i < trail.points.length; i++) {
        const previous = trail.points[i - 1]!
        const current = trail.points[i]!
        // Deux points consécutifs d'un parcours sont voisins immédiats : un saut
        // signalerait un raccord raté entre deux arêtes.
        expect(Math.abs(current.x - previous.x)).toBeLessThanOrEqual(2)
        expect(Math.abs(current.y - previous.y)).toBeLessThanOrEqual(2)
      }
    }
  })

  it('ne renvoie rien pour un graphe vide', () => {
    expect(decomposeTrails({ nodes: [], edges: [] })).toHaveLength(0)
  })
})
