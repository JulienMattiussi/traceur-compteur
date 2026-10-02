import { describe, expect, it } from 'vitest'
import { checkQuality } from '@/lib/quality'
import type { DotSequence } from '@/lib/types'

function sequence(dots: [number, number][], firstNumber = 1, closed = false): DotSequence {
  return { dots: dots.map(([x, y]) => ({ x, y })), closed, firstNumber }
}

describe('checkQuality', () => {
  it('ne signale rien sur une suite régulière', () => {
    const report = checkQuality(
      [
        sequence([
          [0, 0],
          [20, 0],
          [40, 0],
          [60, 0],
        ]),
      ],
      100,
    )
    expect(report.ambiguities).toHaveLength(0)
    expect(report.minSpacing).toBeCloseTo(20)
  })

  it('repère un point parasite plus proche que le suivant', () => {
    // Depuis (0,0), le point 4 de la seconde séquence est à 5 px alors que le
    // point 2 est à 20 px : l'utilisateur partirait vers le mauvais.
    const report = checkQuality(
      [
        sequence([
          [0, 0],
          [20, 0],
        ]),
        sequence(
          [
            [0, 5],
            [0, 40],
          ],
          3,
        ),
      ],
      100,
    )

    expect(report.ambiguities.length).toBeGreaterThanOrEqual(1)
    const first = report.ambiguities[0]!
    expect(first.number).toBe(1)
    expect(first.actual).toBeCloseTo(5)
    expect(first.expected).toBeCloseTo(20)
  })

  it('ne compte pas le point d’où l’on vient comme une ambiguïté', () => {
    // 1 -> 2 court, puis 2 -> 3 long : depuis 2, le point 1 est plus proche que 3
    // mais on en sort, donc ce n'est pas trompeur.
    const report = checkQuality(
      [
        sequence([
          [0, 0],
          [5, 0],
          [60, 0],
        ]),
      ],
      100,
    )
    expect(report.ambiguities).toHaveLength(0)
  })

  it('boucle la dernière liaison d’une séquence fermée', () => {
    const closed = sequence(
      [
        [0, 0],
        [30, 0],
        [30, 30],
        [0, 30],
      ],
      1,
      true,
    )
    const report = checkQuality([closed], 100)
    // Les quatre côtés sont mesurés, fermeture comprise.
    expect(report.minSpacing).toBeCloseTo(30)
  })

  it('reste muet sur un puzzle vide', () => {
    expect(checkQuality([], 100).ambiguities).toHaveLength(0)
  })
})
