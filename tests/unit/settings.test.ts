import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@/lib/settings'

describe('DEFAULT_SETTINGS', () => {
  it('laisse les points se rapprocher, la lisibilité venant du placement des numéros', () => {
    expect(DEFAULT_SETTINGS.spacingMm).toBeGreaterThan(0)
    expect(DEFAULT_SETTINGS.spacingMm).toBeLessThan(4)
  })

  it('active les liaisons, sans quoi le puzzle compte trop de séquences', () => {
    expect(DEFAULT_SETTINGS.bridgeMm).toBeGreaterThan(0)
  })

  it('calcule le seuil automatiquement', () => {
    expect(DEFAULT_SETTINGS.threshold).toBe('auto')
  })
})
