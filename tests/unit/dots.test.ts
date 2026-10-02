import { describe, expect, it } from 'vitest'
import { enforceSpacingIndices, placeDots } from '@/lib/dots'
import type { Point, Trail } from '@/lib/types'

function straight(count: number, step = 1): Point[] {
  return Array.from({ length: count }, (_, i) => ({ x: i * step, y: 0 }))
}

function asTrail(points: Point[], closed = false): Trail {
  let length = 0
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y)
  }
  return { edgeIds: [0], points, closed, length }
}

function spaced(points: Point[], minSpacing: number, closed: boolean): Point[] {
  const all = points.map((_, index) => index)
  return enforceSpacingIndices(points, all, minSpacing, closed).map((index) => points[index]!)
}

describe('enforceSpacingIndices', () => {
  it('écarte les points trop serrés', () => {
    const points = straight(40)
    const kept = spaced(points, 10, false)
    for (let i = 1; i < kept.length; i++) {
      const gap = Math.hypot(kept[i]!.x - kept[i - 1]!.x, kept[i]!.y - kept[i - 1]!.y)
      expect(gap).toBeGreaterThanOrEqual(10 * 0.6)
    }
  })

  it('conserve toujours les deux extrémités', () => {
    const points = straight(40)
    const kept = spaced(points, 10, false)
    expect(kept[0]).toEqual(points[0])
    expect(kept[kept.length - 1]).toEqual(points[points.length - 1])
  })

  it('ne duplique pas le point de fermeture d’une boucle', () => {
    const loop: Point[] = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 30 },
      { x: 0, y: 30 },
      { x: 0, y: 0 },
    ]
    const kept = spaced(loop, 10, true)
    const head = kept[0]!
    const foot = kept[kept.length - 1]!
    expect(head.x === foot.x && head.y === foot.y).toBe(false)
  })
})

describe('placeDots', () => {
  it('respecte un budget de points', () => {
    const curve: Point[] = Array.from({ length: 600 }, (_, i) => ({
      x: i,
      y: 60 * Math.sin(i / 12),
    }))
    const placement = placeDots([asTrail(curve)], { maxDots: 40, minSpacing: 4 })
    const total = placement.sequences.reduce((sum, sequence) => sum + sequence.dots.length, 0)
    expect(total).toBeLessThanOrEqual(40)
    expect(total).toBeGreaterThan(5)
  })

  it('gagne en fidélité quand le budget augmente', () => {
    const curve: Point[] = Array.from({ length: 600 }, (_, i) => ({
      x: i,
      y: 60 * Math.sin(i / 12),
    }))
    const small = placeDots([asTrail(curve)], { maxDots: 30, minSpacing: 4 })
    const large = placeDots([asTrail(curve)], { maxDots: 200, minSpacing: 4 })
    expect(large.maxDeviation).toBeLessThan(small.maxDeviation)
  })

  it('écarte les parcours trop courts et le signale', () => {
    const long = asTrail(straight(200))
    const tiny = asTrail(straight(4))
    const placement = placeDots([long, tiny], { minTrailLength: 20, minSpacing: 7 })

    expect(placement.sequences).toHaveLength(1)
    expect(placement.droppedTrails).toBe(1)
    expect(placement.droppedLength).toBeGreaterThan(0)
  })

  it('ne rend jamais une séquence de deux points', () => {
    // Une droite se simplifie en deux points : on doit lui voir ajouter son
    // milieu, pas la laisser en segment isolé.
    const placement = placeDots([asTrail(straight(200))], { minSpacing: 7, minTrailLength: 0 })

    expect(placement.sequences).toHaveLength(1)
    expect(placement.sequences[0]!.dots).toHaveLength(3)
    expect(placement.sequences[0]!.dots[1]!.x).toBeCloseTo(99, 0)
  })

  it('ne superpose jamais deux points sur une petite boucle', () => {
    // Une boucle dont les deux extrémités retenues sont le même point du tracé :
    // y insérer le milieu donnerait deux pastilles exactement confondues, donc
    // deux numéros au même endroit.
    const radius = 6
    const loop: Point[] = Array.from({ length: 60 }, (_, i) => ({
      x: 100 + radius * Math.cos((2 * Math.PI * i) / 59),
      y: 100 + radius * Math.sin((2 * Math.PI * i) / 59),
    }))
    const placement = placeDots([asTrail(loop, true)], {
      tolerance: 40,
      minSpacing: 7,
      minTrailLength: 0,
    })

    for (const sequence of placement.sequences) {
      expect(sequence.dots.length).toBeGreaterThanOrEqual(3)
      for (let i = 0; i < sequence.dots.length; i++) {
        for (let j = i + 1; j < sequence.dots.length; j++) {
          const a = sequence.dots[i]!
          const b = sequence.dots[j]!
          expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(1)
        }
      }
    }
  })

  it('mesure la fidélité sur les points réellement placés', () => {
    const radius = 6
    const loop: Point[] = Array.from({ length: 60 }, (_, i) => ({
      x: 100 + radius * Math.cos((2 * Math.PI * i) / 59),
      y: 100 + radius * Math.sin((2 * Math.PI * i) / 59),
    }))
    const placement = placeDots([asTrail(loop, true)], {
      tolerance: 40,
      minSpacing: 3,
      minTrailLength: 0,
    })

    expect(placement.sequences[0]!.dots).toHaveLength(3)
    // Un triangle inscrit s'écarte du cercle d'au plus r (1 - cos 60°) = r / 2.
    expect(placement.maxDeviation).toBeLessThanOrEqual(radius / 2 + 0.5)
  })

  it('écarte une boucle trop petite pour trois points distincts', () => {
    const loop: Point[] = Array.from({ length: 12 }, (_, i) => ({
      x: 100 + 1.5 * Math.cos((2 * Math.PI * i) / 11),
      y: 100 + 1.5 * Math.sin((2 * Math.PI * i) / 11),
    }))
    const placement = placeDots([asTrail(loop, true)], { minSpacing: 7, minTrailLength: 0 })
    expect(placement.sequences).toHaveLength(0)
  })

  it('écarte un segment trop court pour porter trois points', () => {
    const placement = placeDots([asTrail(straight(6))], { minSpacing: 7, minTrailLength: 0 })
    expect(placement.sequences).toHaveLength(0)
    expect(placement.droppedTrails).toBe(1)
  })

  it('garantit trois points minimum sur un lot de tracés variés', () => {
    const trails = [
      asTrail(straight(200)),
      asTrail(straight(40)),
      asTrail(straight(9)),
      asTrail(Array.from({ length: 300 }, (_, i) => ({ x: i, y: 40 * Math.sin(i / 20) }))),
    ]
    const placement = placeDots(trails, { minSpacing: 7, minTrailLength: 0 })

    expect(placement.sequences.length).toBeGreaterThan(0)
    for (const sequence of placement.sequences) {
      expect(sequence.dots.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('ne crée jamais de séquence à deux points collés', () => {
    const trails = [asTrail(straight(200)), asTrail(straight(30, 0.2))]
    const placement = placeDots(trails, { minSpacing: 7, minTrailLength: 0 })

    for (const sequence of placement.sequences) {
      const span = sequence.dots.reduce((total, dot, index) => {
        if (index === 0) return 0
        const previous = sequence.dots[index - 1]!
        return total + Math.hypot(dot.x - previous.x, dot.y - previous.y)
      }, 0)
      expect(span).toBeGreaterThanOrEqual(7)
    }
  })
})
