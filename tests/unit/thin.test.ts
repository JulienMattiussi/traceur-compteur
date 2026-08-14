import { describe, expect, it } from 'vitest'
import { thin } from '@/lib/thin'
import { circle, createMask, line, rectangle } from '../fixtures'

function countInk(data: Uint8Array): number {
  let total = 0
  for (const value of data) total += value
  return total
}

/** Voisins encrés d'un pixel, en 8-connexité. */
function neighbours(data: Uint8Array, width: number, index: number): number {
  const x = index % width
  const y = (index - x) / width
  let count = 0
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width) continue
      const p = ny * width + nx
      if (p >= 0 && p < data.length && data[p] === 1) count++
    }
  }
  return count
}

describe('thin', () => {
  it('ramène un trait épais à un seul pixel de large', () => {
    const mask = createMask(60, 30)
    line(mask, { x: 5, y: 15 }, { x: 54, y: 15 }, 7)
    expect(countInk(mask.data)).toBeGreaterThan(300)

    const skeleton = thin(mask)

    // Un trait horizontal de 50 px devient une chaîne d'environ 50 pixels.
    const remaining = countInk(skeleton.data)
    expect(remaining).toBeGreaterThan(40)
    expect(remaining).toBeLessThan(60)
  })

  it('préserve la topologie : un anneau reste un anneau', () => {
    const mask = createMask(80, 80)
    circle(mask, 40, 40, 25)
    const skeleton = thin(mask)

    // Aucune extrémité libre : sur une boucle fermée, tout pixel a 2 voisins.
    let endpoints = 0
    for (let i = 0; i < skeleton.data.length; i++) {
      if (skeleton.data[i] !== 1) continue
      if (neighbours(skeleton.data, skeleton.width, i) === 1) endpoints++
    }
    expect(endpoints).toBe(0)
    expect(countInk(skeleton.data)).toBeGreaterThan(100)
  })

  it('ne coupe pas un trait épais qui se croise', () => {
    const mask = createMask(60, 60)
    line(mask, { x: 5, y: 30 }, { x: 54, y: 30 }, 5)
    line(mask, { x: 30, y: 5 }, { x: 30, y: 54 }, 5)

    const skeleton = thin(mask)

    // La croix reste connexe : un seul groupe de pixels.
    expect(countComponents(skeleton.data, skeleton.width, skeleton.height)).toBe(1)
  })

  it('laisse un masque vide inchangé', () => {
    const mask = createMask(10, 10)
    expect(countInk(thin(mask).data)).toBe(0)
  })

  it('conserve un rectangle creux distinct de son intérieur', () => {
    const mask = createMask(70, 70)
    rectangle(mask, 10, 10, 59, 59, 5)
    const skeleton = thin(mask)
    expect(countComponents(skeleton.data, skeleton.width, skeleton.height)).toBe(1)
  })
})

function countComponents(data: Uint8Array, width: number, height: number): number {
  const seen = new Uint8Array(data.length)
  let components = 0

  for (let start = 0; start < data.length; start++) {
    if (data[start] !== 1 || seen[start]) continue
    components++
    const stack = [start]
    seen[start] = 1
    while (stack.length > 0) {
      const p = stack.pop()!
      const x = p % width
      const y = (p - x) / width
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const q = ny * width + nx
          if (data[q] !== 1 || seen[q]) continue
          seen[q] = 1
          stack.push(q)
        }
      }
    }
  }

  return components
}
