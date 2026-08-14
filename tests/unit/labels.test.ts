import { describe, expect, it } from 'vitest'
import { baselineOf, dropUnplaceable, labelSize, metricsFor, placeLabels } from '@/lib/labels'
import type { DotSequence, PlacedLabel } from '@/lib/types'
import type { Point } from '@/lib/types'

const METRICS = { fontSize: 10, dotRadius: 2, canvasWidth: 400, canvasHeight: 400 }

function sequence(points: [number, number][], firstNumber = 1, closed = false): DotSequence {
  return { dots: points.map(([x, y]) => ({ x, y })), closed, firstNumber }
}

function overlap(a: PlacedLabel, b: PlacedLabel): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

describe('labelSize', () => {
  it('grandit avec le nombre de chiffres', () => {
    expect(labelSize(9, 10).width).toBeLessThan(labelSize(99, 10).width)
    expect(labelSize(999, 10).width).toBeCloseTo(3 * labelSize(9, 10).width)
  })

  it('garde une hauteur indépendante de la valeur', () => {
    expect(labelSize(7, 10).height).toBeCloseTo(labelSize(1234, 10).height)
  })
})

describe('placeLabels', () => {
  it('place le premier numéro en haut à droite de sa pastille', () => {
    const [label] = placeLabels([sequence([[50, 50], [80, 50], [110, 50]])], METRICS)
    expect(label!.x).toBeGreaterThan(50)
    expect(label!.y).toBeLessThan(50)
    expect(label!.placed).toBe(true)
  })

  it('ne laisse jamais deux numéros se chevaucher', () => {
    // Une grappe de points très rapprochés : c'est le cas qui produisait des
    // numéros illisibles.
    const dots: [number, number][] = [
      [100, 100],
      [103, 101],
      [106, 99],
      [101, 105],
      [108, 104],
      [104, 96],
    ]
    const labels = placeLabels([sequence(dots)], METRICS)

    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        if (!labels[i]!.placed || !labels[j]!.placed) continue
        expect(overlap(labels[i]!, labels[j]!)).toBe(false)
      }
    }
  })

  it('vérifie aussi les séquences entre elles', () => {
    const labels = placeLabels(
      [sequence([[100, 100], [130, 100], [160, 100]]), sequence([[101, 101], [131, 101], [161, 101]], 4)],
      METRICS,
    )
    const placed = labels.filter((label) => label.placed)
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(overlap(placed[i]!, placed[j]!)).toBe(false)
      }
    }
  })

  it('ne recouvre pas une pastille voisine', () => {
    const dots: Point[] = [
      { x: 100, y: 100 },
      { x: 112, y: 96 },
      { x: 140, y: 100 },
    ]
    const labels = placeLabels([{ dots, closed: false, firstNumber: 1 }], METRICS)

    for (const label of labels) {
      if (!label.placed) continue
      for (const dot of dots) {
        const inside =
          dot.x > label.x && dot.x < label.x + label.width &&
          dot.y > label.y && dot.y < label.y + label.height
        expect(inside).toBe(false)
      }
    }
  })

  it('signale un numéro incasable au lieu de le poser n’importe où', () => {
    // Vingt points sur trois pixels : aucune des huit positions ne peut suffire.
    const dots: [number, number][] = Array.from({ length: 20 }, (_, i) => [
      100 + (i % 3),
      100 + Math.floor(i / 3),
    ])
    const labels = placeLabels([sequence(dots)], METRICS)
    expect(labels.some((label) => !label.placed)).toBe(true)
  })

  it('numérote dans l’ordre des séquences', () => {
    const labels = placeLabels(
      [sequence([[10, 10], [40, 10], [70, 10]]), sequence([[10, 60], [40, 60], [70, 60]], 4)],
      METRICS,
    )
    expect(labels.map((label) => label.number)).toEqual([1, 2, 3, 4, 5, 6])
  })
})

describe('baselineOf', () => {
  it('place la ligne de base sous le rectangle du texte', () => {
    const [label] = placeLabels([sequence([[50, 50], [80, 50], [110, 50]])], METRICS)
    expect(baselineOf(label!)).toBeCloseTo(label!.y + label!.height)
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
})

describe('bornage au cadre', () => {
  it('ne laisse aucune étiquette dépasser de l’image', () => {
    // Des points collés aux quatre bords et aux quatre coins.
    const dots: [number, number][] = [
      [1, 1],
      [399, 1],
      [1, 399],
      [399, 399],
      [200, 1],
      [200, 399],
      [1, 200],
      [399, 200],
    ]
    const labels = placeLabels([sequence(dots, 998)], METRICS)

    for (const label of labels) {
      expect(label.x).toBeGreaterThanOrEqual(0)
      expect(label.y).toBeGreaterThanOrEqual(0)
      expect(label.x + label.width).toBeLessThanOrEqual(METRICS.canvasWidth)
      expect(label.y + label.height).toBeLessThanOrEqual(METRICS.canvasHeight)
    }
  })

  it('bascule du côté intérieur pour un point au bord droit', () => {
    const labels = placeLabels([sequence([[398, 200], [300, 200], [200, 200]])], METRICS)
    // À droite il n'y a plus de place : le numéro doit passer à gauche du point.
    expect(labels[0]!.x).toBeLessThan(398)
    expect(labels[0]!.placed).toBe(true)
  })

  it('ramène dans la page une étiquette qu’on ne peut caser nulle part', () => {
    const dots: [number, number][] = Array.from({ length: 25 }, (_, i) => [
      398 - (i % 2),
      1 + Math.floor(i / 2),
    ])
    const labels = placeLabels([sequence(dots, 9998)], METRICS)

    for (const label of labels) {
      expect(label.x + label.width).toBeLessThanOrEqual(METRICS.canvasWidth)
      expect(label.y).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('dropUnplaceable', () => {
  it('retire les points signalés et renumérote sans trou', () => {
    const sequences = [sequence([[0, 0], [10, 0], [20, 0], [30, 0]]), sequence([[0, 50], [10, 50], [20, 50]], 5)]
    const labels = placeLabels(sequences, METRICS).map((label) => ({
      ...label,
      placed: label.number !== 2,
    }))

    const reduced = dropUnplaceable(sequences, labels)
    expect(reduced[0]!.dots).toHaveLength(3)
    expect(reduced[0]!.firstNumber).toBe(1)
    expect(reduced[1]!.firstNumber).toBe(4)
  })

  it('protège une séquence qui tomberait sous trois points', () => {
    const sequences = [sequence([[0, 0], [10, 0], [20, 0]])]
    const labels = placeLabels(sequences, METRICS).map((label) => ({ ...label, placed: false }))

    expect(dropUnplaceable(sequences, labels)[0]!.dots).toHaveLength(3)
  })

  it('ne touche à rien quand tous les numéros sont casés', () => {
    const sequences = [sequence([[0, 0], [30, 0], [60, 0]])]
    const labels = placeLabels(sequences, METRICS)
    expect(dropUnplaceable(sequences, labels)).toBe(sequences)
  })
})
