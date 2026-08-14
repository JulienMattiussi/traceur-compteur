import { readFileSync } from 'node:fs'

export interface GrayImage {
  width: number
  height: number
  gray: Uint8Array
}

/**
 * Lecture d'un PGM binaire (P5). Ce format sert de pont côté Node : `ffmpeg`
 * décode le JPEG en gris brut, et on évite ainsi d'embarquer un codec en JS.
 * Le navigateur, lui, utilise le canvas.
 */
export function readPgm(path: string): GrayImage {
  const buffer = readFileSync(path)

  const fields: number[] = []
  let offset = 0

  const skipBlanksAndComments = (): void => {
    for (;;) {
      while (offset < buffer.length && isWhitespace(buffer[offset]!)) offset++
      if (buffer[offset] === 0x23) {
        while (offset < buffer.length && buffer[offset] !== 0x0a) offset++
      } else {
        return
      }
    }
  }

  // Entête : "P5", largeur, hauteur, valeur max.
  skipBlanksAndComments()
  if (buffer[offset] !== 0x50 || buffer[offset + 1] !== 0x35) {
    throw new Error(`${path} n'est pas un PGM binaire (P5)`)
  }
  offset += 2

  while (fields.length < 3) {
    skipBlanksAndComments()
    let value = 0
    let digits = 0
    while (offset < buffer.length && buffer[offset]! >= 0x30 && buffer[offset]! <= 0x39) {
      value = value * 10 + (buffer[offset]! - 0x30)
      offset++
      digits++
    }
    if (digits === 0) throw new Error(`Entête PGM illisible dans ${path}`)
    fields.push(value)
  }

  const [width, height, maxValue] = fields as [number, number, number]
  if (maxValue > 255) throw new Error(`PGM 16 bits non géré (${path})`)
  offset++ // l'unique blanc qui suit l'entête

  const gray = new Uint8Array(width * height)
  for (let i = 0; i < gray.length; i++) gray[i] = buffer[offset + i]!

  return { width, height, gray }
}

function isWhitespace(byte: number): boolean {
  return byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d
}
