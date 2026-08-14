import { describe, expect, it } from 'vitest'
import { generatePuzzle } from '@/lib/pipeline'
import { renderPdf } from '@/lib/pdf'
import { circle, createMask, line, maskToGray } from '../fixtures'

function face() {
  const mask = createMask(200, 200)
  circle(mask, 100, 100, 80)
  circle(mask, 72, 80, 10)
  circle(mask, 128, 80, 10)
  line(mask, { x: 70, y: 135 }, { x: 130, y: 135 }, 3)
  return mask
}

const puzzle = generatePuzzle(maskToGray(face()), 200, 200, { maxDots: 60 })
const text = (bytes: Uint8Array): string => String.fromCharCode(...bytes)

describe('renderPdf', () => {
  it('produit un fichier PDF bien formé', () => {
    const pdf = text(renderPdf(puzzle))
    expect(pdf.startsWith('%PDF-1.4\n')).toBe(true)
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(pdf).toContain('/Type /Catalog')
    expect(pdf).toContain('/BaseFont /Helvetica')
  })

  it('tient sur une seule page A4', () => {
    const pdf = text(renderPdf(puzzle))
    expect(pdf.match(/\/Type \/Page[^s]/g) ?? []).toHaveLength(1)
    expect(pdf).toContain('/Count 1')
    // 210 x 297 mm exprimés en points PostScript.
    expect(pdf).toContain('/MediaBox [0 0 595.28 841.89]')
  })

  it('annonce la bonne longueur de flux', () => {
    const pdf = text(renderPdf(puzzle))
    const declared = Number(/\/Length (\d+)/.exec(pdf)![1])
    const stream = /stream\n([\s\S]*?)\nendstream/.exec(pdf)![1]!
    expect(stream.length).toBe(declared)
  })

  it('écrit une table de références croisées exacte', () => {
    const pdf = text(renderPdf(puzzle))
    const startxref = Number(/startxref\n(\d+)/.exec(pdf)![1])
    expect(pdf.slice(startxref, startxref + 4)).toBe('xref')

    // Chaque décalage doit tomber exactement sur le début de son objet.
    const entries = [...pdf.matchAll(/^(\d{10}) 00000 n $/gm)].map((match) => Number(match[1]))
    expect(entries).toHaveLength(6)
    entries.forEach((offset, index) => {
      expect(pdf.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`)
    })
  })

  it('écrit un numéro par point', () => {
    const pdf = text(renderPdf(puzzle))
    expect(pdf.match(/\) Tj/g) ?? []).toHaveLength(puzzle.stats.dots)
  })

  it('sait ne sortir que la solution, sans aucun numéro', () => {
    const pdf = text(renderPdf(puzzle, { solutionOnly: true }))
    expect(pdf).not.toContain(') Tj')
    expect(pdf).toMatch(/^(S|s)$/m)
  })

  it('porte le titre demandé et échappe les parenthèses', () => {
    const pdf = text(renderPdf(puzzle, { title: 'lapin (dodo)' }))
    expect(pdf).toContain('/Title (lapin \\(dodo\\))')
  })

  it('reste identique d’un appel à l’autre', () => {
    expect(text(renderPdf(puzzle))).toBe(text(renderPdf(puzzle)))
  })

  it('garde le dessin dans les marges de la page', () => {
    const pdf = text(renderPdf(puzzle))
    const stream = /stream\n([\s\S]*?)\nendstream/.exec(pdf)![1]!
    const coordinates = [...stream.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) (?:m|l)$/gm)]

    expect(coordinates.length).toBeGreaterThan(0)
    for (const match of coordinates) {
      expect(Number(match[1])).toBeGreaterThanOrEqual(0)
      expect(Number(match[1])).toBeLessThanOrEqual(595.28)
      expect(Number(match[2])).toBeGreaterThanOrEqual(0)
      expect(Number(match[2])).toBeLessThanOrEqual(841.89)
    }
  })
})
