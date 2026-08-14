import { describe, expect, it } from 'vitest'
import { binarize, despeckle, otsuThreshold, rgbaToGray } from '@/lib/binarize'
import { createMask, ink, line, maskToGray } from '../fixtures'

describe('otsuThreshold', () => {
  it('sépare deux modes bien distincts', () => {
    const gray = new Uint8Array(1000)
    gray.fill(20, 0, 300)
    gray.fill(230, 300)
    // Le seuil est la dernière valeur de la classe sombre, et `binarize` encre
    // les pixels <= seuil : 20 sépare donc correctement les deux modes.
    const threshold = otsuThreshold(gray)
    expect(threshold).toBeGreaterThanOrEqual(20)
    expect(threshold).toBeLessThan(230)
  })

  it('reste défini sur une image uniforme', () => {
    const threshold = otsuThreshold(new Uint8Array(100).fill(128))
    expect(Number.isFinite(threshold)).toBe(true)
  })
})

describe('rgbaToGray', () => {
  it('applique une pondération perceptuelle', () => {
    // Le vert pèse plus que le bleu à luminance égale.
    const green = rgbaToGray(new Uint8Array([0, 255, 0, 255]))
    const blue = rgbaToGray(new Uint8Array([0, 0, 255, 255]))
    expect(green[0]!).toBeGreaterThan(blue[0]!)
  })

  it('traite le transparent comme du papier blanc', () => {
    const gray = rgbaToGray(new Uint8Array([0, 0, 0, 0]))
    expect(gray[0]).toBe(255)
  })
})

describe('binarize', () => {
  it('encre les pixels sombres', () => {
    const mask = createMask(40, 40)
    line(mask, { x: 5, y: 20 }, { x: 34, y: 20 }, 3)
    const result = binarize(maskToGray(mask), 40, 40)

    let inked = 0
    for (const value of result.data) inked += value
    expect(inked).toBeGreaterThan(60)
  })

  it('accepte un seuil explicite', () => {
    const gray = new Uint8Array([0, 100, 200, 255])
    expect([...binarize(gray, 4, 1, { threshold: 150 }).data]).toEqual([1, 1, 0, 0])
  })
})

describe('despeckle', () => {
  it('retire les taches sous le seuil et garde le reste', () => {
    const mask = createMask(50, 50)
    line(mask, { x: 5, y: 25 }, { x: 44, y: 25 }, 3)
    ink(mask, 2, 2)
    ink(mask, 3, 2)

    const cleaned = despeckle(mask, 10)
    expect(cleaned.data[2 * 50 + 2]).toBe(0)
    expect(cleaned.data[25 * 50 + 20]).toBe(1)
  })

  it('peut tout retirer si le seuil est énorme', () => {
    const mask = createMask(20, 20)
    line(mask, { x: 2, y: 10 }, { x: 17, y: 10 })
    let inked = 0
    for (const value of despeckle(mask, 10_000).data) inked += value
    expect(inked).toBe(0)
  })
})
