import { describe, expect, it } from 'vitest'
import { analyse, generatePuzzle } from '@/lib/pipeline'
import { renderSvg } from '@/lib/svg'
import { circle, createMask, line, maskToGray, rectangle } from '../fixtures'

/** Un visage schématique : contour, deux yeux, une bouche. Le cas d'école. */
function face() {
  const mask = createMask(200, 200)
  circle(mask, 100, 100, 80)
  circle(mask, 72, 80, 10)
  circle(mask, 128, 80, 10)
  line(mask, { x: 70, y: 135 }, { x: 130, y: 135 }, 3)
  return mask
}

describe('analyse', () => {
  it('mesure le tracé intérieur qu’un contour extérieur perdrait', () => {
    const result = analyse(maskToGray(face()), 200, 200, { minBlobArea: 0 })
    const { interiorLength, strokeLength } = result.geometry

    // Les yeux et la bouche sont enfermés dans le visage : c'est exactement la
    // part du dessin qu'une extraction de silhouette ne peut pas représenter.
    expect(interiorLength).toBeGreaterThan(0.2 * strokeLength)
    expect(interiorLength).toBeLessThan(strokeLength)
  })

  it('trouve les jonctions qu’un contour extérieur ne peut pas avoir', () => {
    // Un visage dont la bouche touche le contour : la jonction n'existe que si
    // l'on suit le tracé intérieur.
    const mask = face()
    line(mask, { x: 100, y: 135 }, { x: 100, y: 180 }, 3)
    const result = analyse(maskToGray(mask), 200, 200, { minBlobArea: 0 })

    expect(result.geometry.junctions).toBeGreaterThanOrEqual(1)
  })

  it('chronomètre chaque étape', () => {
    const result = analyse(maskToGray(face()), 200, 200)
    for (const key of ['binarize', 'thin', 'graph', 'baseline']) {
      expect(result.timings[key]).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('generatePuzzle', () => {
  it('numérote les points de bout en bout, sans trou ni doublon', () => {
    const puzzle = generatePuzzle(maskToGray(face()), 200, 200)

    let expected = 1
    for (const sequence of puzzle.sequences) {
      expect(sequence.firstNumber).toBe(expected)
      expected += sequence.dots.length
    }
    expect(puzzle.stats.dots).toBe(expected - 1)
  })

  it('atteint le nombre minimal de séquences quand rien n’est écarté', () => {
    const mask = createMask(160, 160)
    rectangle(mask, 20, 20, 139, 139, 3)
    line(mask, { x: 20, y: 80 }, { x: 139, y: 80 }, 3)

    const puzzle = generatePuzzle(maskToGray(mask), 160, 160)
    expect(puzzle.stats.droppedTrails).toBe(0)
    expect(puzzle.stats.sequences).toBe(puzzle.stats.minSequences)
  })

  it('reste proche de la tolérance annoncée', () => {
    // La contrainte d'espacement peut l'emporter sur la fidélité : écarter deux
    // pastilles trop serrées retire un point que la tolérance aurait gardé. La
    // fidélité stricte de la simplification est vérifiée dans simplify.test.ts.
    const puzzle = generatePuzzle(maskToGray(face()), 200, 200, { tolerance: 2 })
    expect(puzzle.stats.maxDeviation).toBeLessThanOrEqual(4)
  })

  it('tient un budget de points', () => {
    const puzzle = generatePuzzle(maskToGray(face()), 200, 200, { maxDots: 60 })
    expect(puzzle.stats.dots).toBeLessThanOrEqual(60)
  })

  it('reste vide sur une image vierge', () => {
    const puzzle = generatePuzzle(new Uint8Array(400).fill(255), 20, 20)
    expect(puzzle.sequences).toHaveLength(0)
    expect(puzzle.stats.dots).toBe(0)
  })
})

describe('renderSvg', () => {
  it('produit un SVG aux dimensions de l’image', () => {
    const puzzle = generatePuzzle(maskToGray(face()), 200, 200, { maxDots: 40 })
    const svg = renderSvg(puzzle)

    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('viewBox="0 0 200 200"')
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true)
    // Un numéro par point.
    expect(svg.match(/<text/g) ?? []).toHaveLength(puzzle.stats.dots)
  })

  it('sait ne dessiner que la solution', () => {
    const puzzle = generatePuzzle(maskToGray(face()), 200, 200, { maxDots: 40 })
    const svg = renderSvg(puzzle, { solutionOnly: true })
    expect(svg).not.toContain('<text')
    expect(svg).toMatch(/<(polyline|polygon)/)
  })
})
