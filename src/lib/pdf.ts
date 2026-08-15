import { baselineOf } from '@/lib/labels'
import { metricsFor } from '@/lib/page'
import type { Puzzle } from '@/lib/types'

export interface PdfOptions {
  /** Titre du document, visible dans le lecteur PDF. */
  title?: string
  /** N'imprime que le tracé solution, sans les points ni les numéros. */
  solutionOnly?: boolean
}

/** Un point PostScript vaut 1/72 de pouce ; tout le PDF se mesure ainsi. */
const PER_MM = 72 / 25.4
const PAGE_WIDTH = 210 * PER_MM
const PAGE_HEIGHT = 297 * PER_MM
/** Marge de 10 mm : la largeur utile vaut donc les 190 mm de `PAGE_WIDTH_MM`. */
const MARGIN = 10 * PER_MM

/** Constante de Bézier pour approcher un quart de cercle. */
const KAPPA = 0.5523
/** Épaisseur de trait : 0,3 mm, l'équivalent d'un stylo fin. */
const STROKE = 0.3 * PER_MM

/**
 * Écrit un PDF A4 directement, sans aucune bibliothèque.
 *
 * C'est la seule sortie vraiment maîtrisée : une page web ne peut pas empêcher le
 * navigateur d'ajouter ses en-têtes et sa pagination à l'impression, et son
 * échelle dépend des réglages du dialogue. Ici la page fait exactement une A4,
 * l'échelle en millimètres est celle prévue par le moteur, et rien ne s'ajoute.
 *
 * Le texte utilise Helvetica, l'une des quatorze polices que tout lecteur PDF
 * possède : rien à embarquer.
 */
export function renderPdf(puzzle: Puzzle, options: PdfOptions = {}): Uint8Array<ArrayBuffer> {
  const { title = 'Relier les points', solutionOnly = false } = options
  const { width, height } = puzzle

  // On inscrit le dessin dans la zone utile en gardant ses proportions.
  const usableWidth = PAGE_WIDTH - 2 * MARGIN
  const usableHeight = PAGE_HEIGHT - 2 * MARGIN
  const scale = Math.min(usableWidth / width, usableHeight / height)
  const offsetX = MARGIN + (usableWidth - width * scale) / 2
  const offsetY = MARGIN + (usableHeight - height * scale) / 2

  // Le PDF a son origine en bas à gauche, l'image en haut à gauche.
  const toX = (x: number): number => offsetX + x * scale
  const toY = (y: number): number => PAGE_HEIGHT - offsetY - y * scale

  const metrics = metricsFor(width, height)
  const dotRadius = metrics.dotRadius * scale
  const fontSize = metrics.fontSize * scale

  const body: string[] = ['0 g', '0 G', `${round(STROKE)} w`]

  if (solutionOnly) {
    for (const sequence of puzzle.sequences) {
      const [first, ...rest] = sequence.dots
      if (!first) continue
      body.push(`${round(toX(first.x))} ${round(toY(first.y))} m`)
      for (const dot of rest) body.push(`${round(toX(dot.x))} ${round(toY(dot.y))} l`)
      body.push(sequence.closed ? 's' : 'S')
    }
  } else {
    for (const sequence of puzzle.sequences) {
      for (let i = 0; i < sequence.dots.length; i++) {
        const dot = sequence.dots[i]!
        const cx = toX(dot.x)
        const cy = toY(dot.y)

        // Anneau sur le premier point : c'est là qu'on lève le crayon.
        if (i === 0) body.push(circlePath(cx, cy, dotRadius + 1.4 * scale), 'S')
        body.push(circlePath(cx, cy, dotRadius), 'f')
      }
    }

    body.push('BT', `/F1 ${round(fontSize)} Tf`)
    for (const label of puzzle.labels) {
      body.push(
        `1 0 0 1 ${round(toX(label.x))} ${round(toY(baselineOf(label)))} Tm`,
        `(${label.number}) Tj`,
      )
    }
    body.push('ET')
  }

  return assemble(body.join('\n'), title)
}

/** Cercle approché par quatre courbes de Bézier, la façon standard en PDF. */
function circlePath(cx: number, cy: number, r: number): string {
  const k = KAPPA * r
  return [
    `${round(cx + r)} ${round(cy)} m`,
    `${round(cx + r)} ${round(cy + k)} ${round(cx + k)} ${round(cy + r)} ${round(cx)} ${round(cy + r)} c`,
    `${round(cx - k)} ${round(cy + r)} ${round(cx - r)} ${round(cy + k)} ${round(cx - r)} ${round(cy)} c`,
    `${round(cx - r)} ${round(cy - k)} ${round(cx - k)} ${round(cy - r)} ${round(cx)} ${round(cy - r)} c`,
    `${round(cx + k)} ${round(cy - r)} ${round(cx + r)} ${round(cy - k)} ${round(cx + r)} ${round(cy)} c`,
  ].join('\n')
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Assemble les objets, la table des références croisées et la fin de fichier. Les
 * décalages de `xref` sont des positions d'octets exactes : tout est en ASCII, un
 * caractère vaut donc un octet.
 */
function assemble(content: string, title: string): Uint8Array<ArrayBuffer> {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${round(PAGE_WIDTH)} ${round(PAGE_HEIGHT)}] ` +
      '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Title (${escapeText(title)}) /Producer (traceur-compteur) >>`,
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []

  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`
  }

  const xrefAt = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  // Chaque entrée pèse exactement 20 octets, la spécification l'impose.
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\n`
  pdf += `startxref\n${xrefAt}\n%%EOF\n`

  const bytes = new Uint8Array(pdf.length)
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff
  return bytes
}

/** Dans une chaîne PDF, parenthèses et antislash doivent être échappés. */
function escapeText(value: string): string {
  return value.replace(/[\\()]/g, (char) => `\\${char}`)
}
