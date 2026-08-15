import { describe, expect, it } from 'vitest'
import { metricsFor, PAGE_WIDTH_MM, spacingInPixels } from '@/lib/page'

describe('spacingInPixels', () => {
  it('convertit des millimètres imprimés en pixels de l’image', () => {
    // Une image large de PAGE_WIDTH_MM pixels vaut exactement 1 px par mm.
    expect(spacingInPixels(PAGE_WIDTH_MM, 4)).toBeCloseTo(4)
    expect(spacingInPixels(PAGE_WIDTH_MM * 2, 4)).toBeCloseTo(8)
  })

  it('donne le même espacement imprimé pour deux résolutions de la même image', () => {
    const small = spacingInPixels(700, 4) / 700
    const large = spacingInPixels(2100, 4) / 2100
    expect(small).toBeCloseTo(large)
  })

  it('garde un plancher exploitable sur une image minuscule', () => {
    expect(spacingInPixels(10, 4)).toBeGreaterThanOrEqual(2)
  })
})

describe('metricsFor', () => {
  it('grandit avec la résolution, pour un rendu imprimé constant', () => {
    const small = metricsFor(700, 900)
    const large = metricsFor(2100, 2700)
    expect(large.fontSize).toBeCloseTo(3 * small.fontSize)
    expect(large.dotRadius).toBeCloseTo(3 * small.dotRadius)
  })

  it('retient les dimensions de l’image pour borner les étiquettes', () => {
    expect(metricsFor(700, 900).canvasWidth).toBe(700)
    expect(metricsFor(700, 900).canvasHeight).toBe(900)
  })

  it('donne une police plus grande que la pastille, pour un numéro lisible', () => {
    const metrics = metricsFor(700, 900)
    expect(metrics.fontSize).toBeGreaterThan(metrics.dotRadius * 2)
  })
})
