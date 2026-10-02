import { describe, expect, it } from 'vitest'
import { deviationByIndices, distanceToSegment, simplifyIndices } from '@/lib/simplify'
import type { Point } from '@/lib/types'

function straight(count: number, step = 1): Point[] {
  return Array.from({ length: count }, (_, i) => ({ x: i * step, y: 0 }))
}

describe('distanceToSegment', () => {
  it('mesure la distance perpendiculaire', () => {
    expect(distanceToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(3)
  })

  it('se rabat sur les extrémités hors du segment', () => {
    expect(distanceToSegment({ x: -4, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(4)
  })

  it('gère un segment dégénéré', () => {
    expect(distanceToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(5)
  })
})

describe('simplifyIndices', () => {
  it('réduit une droite à ses deux extrémités', () => {
    expect(simplifyIndices(straight(50), 0.5)).toHaveLength(2)
  })

  it('garde le sommet d’un angle', () => {
    const corner: Point[] = [...straight(20), { x: 19, y: 10 }, { x: 19, y: 20 }]
    const kept = simplifyIndices(corner, 0.5).map((index) => corner[index]!)
    expect(kept.length).toBeGreaterThanOrEqual(3)
    expect(kept.some((point) => point.x === 19 && point.y === 0)).toBe(true)
  })

  it('respecte la tolérance annoncée', () => {
    // Une courbe en cloche, échantillonnée finement.
    const curve: Point[] = Array.from({ length: 200 }, (_, i) => ({
      x: i,
      y: 40 * Math.sin((i / 199) * Math.PI),
    }))

    for (const tolerance of [0.5, 2, 8]) {
      const indices = simplifyIndices(curve, tolerance)
      expect(deviationByIndices(curve, indices, false)).toBeLessThanOrEqual(tolerance + 1e-9)
    }
  })

  it('produit moins de points quand la tolérance monte', () => {
    const curve: Point[] = Array.from({ length: 200 }, (_, i) => ({
      x: i,
      y: 30 * Math.sin(i / 8),
    }))
    expect(simplifyIndices(curve, 8).length).toBeLessThan(simplifyIndices(curve, 1).length)
  })

  it('laisse passer les tracés de moins de trois points', () => {
    expect(simplifyIndices([{ x: 0, y: 0 }], 1)).toHaveLength(1)
    expect(simplifyIndices([], 1)).toHaveLength(0)
  })
})

describe('deviationByIndices', () => {
  it('vaut zéro quand tous les points sont conservés', () => {
    const points = straight(10)
    const indices = points.map((_, index) => index)
    expect(deviationByIndices(points, indices, false)).toBe(0)
  })

  it('mesure exactement l’écart d’un sommet supprimé', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 7 },
      { x: 10, y: 0 },
    ]
    expect(deviationByIndices(points, [0, 2], false)).toBeCloseTo(7)
  })
})
