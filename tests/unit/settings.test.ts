import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, PAGE_WIDTH_MM, spacingInPixels } from '@/lib/settings'

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

describe('DEFAULT_SETTINGS', () => {
  it('réserve assez de place pour un numéro à trois chiffres', () => {
    expect(DEFAULT_SETTINGS.spacingMm).toBeGreaterThanOrEqual(3)
  })
})
