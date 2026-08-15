import { describe, expect, it } from 'vitest'
import {
  classifyInterior,
  countInkComponents,
  distanceTransform,
  outsideRegion,
} from '@/lib/interior'
import { thin } from '@/lib/thin'
import { circle, createMask, line, rectangle } from '../fixtures'

describe('distanceTransform', () => {
  it('vaut zéro sur les germes et croît en s’éloignant', () => {
    const seeds = new Uint8Array(9)
    seeds[4] = 1 // centre d'une grille 3x3
    const d = distanceTransform(seeds, 3, 3)
    expect(d[4]).toBe(0)
    expect(d[1]).toBeCloseTo(1, 1)
    expect(d[0]).toBeCloseTo(4 / 3, 1)
  })
})

describe('outsideRegion', () => {
  it('distingue le dehors d’une cavité fermée', () => {
    const mask = createMask(40, 40)
    rectangle(mask, 8, 8, 31, 31, 3)
    const outside = outsideRegion(mask)

    expect(outside[0]).toBe(1) // coin de l'image
    expect(outside[20 * 40 + 20]).toBe(0) // enfermé par le rectangle
  })
})

describe('classifyInterior', () => {
  it('repère un trait enfermé dans une forme', () => {
    // Un grand cercle avec un petit cercle dedans : le petit est invisible pour
    // un générateur qui ne suit que le contour extérieur.
    const mask = createMask(120, 120)
    circle(mask, 60, 60, 45)
    circle(mask, 60, 60, 12)

    const skeleton = thin(mask)
    const interior = classifyInterior(mask, skeleton)

    let outerInterior = 0
    let innerInterior = 0
    for (let i = 0; i < skeleton.data.length; i++) {
      if (skeleton.data[i] !== 1) continue
      const x = i % 120
      const y = (i - x) / 120
      const radius = Math.hypot(x - 60, y - 60)
      if (radius > 30) outerInterior += interior[i]!
      else innerInterior += interior[i]!
    }

    expect(innerInterior).toBeGreaterThan(30)
    expect(outerInterior).toBe(0)
  })
})

describe('countInkComponents', () => {
  it('compte les taches d’encre séparées', () => {
    const mask = createMask(140, 60)
    circle(mask, 30, 30, 18)
    circle(mask, 100, 30, 18)
    expect(countInkComponents(mask)).toBe(2)
  })

  it('ne compte qu’une tache pour un dessin connexe, tracé intérieur inclus', () => {
    const mask = createMask(90, 90)
    rectangle(mask, 10, 10, 79, 79, 3)
    line(mask, { x: 10, y: 45 }, { x: 79, y: 45 }, 3)
    expect(countInkComponents(mask)).toBe(1)
  })

  it('renvoie zéro sur une image vierge', () => {
    expect(countInkComponents(createMask(20, 20))).toBe(0)
  })
})
