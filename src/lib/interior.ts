import { forEachInkComponent } from '@/lib/pixels'
import type { Mask } from '@/lib/types'

/**
 * Distingue ce qui borde la silhouette de ce qui n'existe qu'à l'intérieur du
 * dessin, c'est-à-dire exactement la part qu'un générateur par contour extérieur
 * ne peut pas représenter. Sert à la mesurer, pas à la produire.
 */

/**
 * Transformée de distance par chamfer 3-4 en deux passes. Approximation de la
 * distance euclidienne à ~2 % près, largement suffisante ici et linéaire.
 */
export function distanceTransform(seeds: Uint8Array, width: number, height: number): Float32Array {
  const INF = 1e9
  const d = new Float32Array(width * height)
  for (let i = 0; i < d.length; i++) d[i] = seeds[i] === 1 ? 0 : INF

  const relax = (target: number, from: number, cost: number): void => {
    const candidate = d[from]! + cost
    if (candidate < d[target]!) d[target] = candidate
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      if (d[p] === 0) continue
      if (x > 0) relax(p, p - 1, 3)
      if (y > 0) {
        relax(p, p - width, 3)
        if (x > 0) relax(p, p - width - 1, 4)
        if (x < width - 1) relax(p, p - width + 1, 4)
      }
    }
  }

  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const p = y * width + x
      if (d[p] === 0) continue
      if (x < width - 1) relax(p, p + 1, 3)
      if (y < height - 1) {
        relax(p, p + width, 3)
        if (x < width - 1) relax(p, p + width + 1, 4)
        if (x > 0) relax(p, p + width - 1, 4)
      }
    }
  }

  for (let i = 0; i < d.length; i++) d[i] = d[i]! / 3
  return d
}

/** Les pixels de fond reliés au bord de l'image : le « dehors » du dessin. */
export function outsideRegion(mask: Mask): Uint8Array {
  const { width, height, data } = mask
  const outside = new Uint8Array(width * height)
  const stack: number[] = []

  const push = (x: number, y: number): void => {
    const p = y * width + x
    if (data[p] === 1 || outside[p]) return
    outside[p] = 1
    stack.push(p)
  }

  for (let x = 0; x < width; x++) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    push(0, y)
    push(width - 1, y)
  }

  while (stack.length > 0) {
    const p = stack.pop()!
    const x = p % width
    const y = (p - x) / width
    if (x > 0) push(x - 1, y)
    if (x < width - 1) push(x + 1, y)
    if (y > 0) push(x, y - 1)
    if (y < height - 1) push(x, y + 1)
  }

  return outside
}

/**
 * Distingue, pixel par pixel du squelette, ce qui appartient à la silhouette de
 * ce qui n'existe qu'à l'intérieur du dessin.
 *
 * Principe : en un point du squelette, `halfWidth` est la distance au fond le
 * plus proche, donc la demi-épaisseur du trait. Si le vrai dehors est
 * sensiblement plus loin que ça, c'est que le trait ne borde pas la silhouette :
 * il est enfermé dans le dessin. C'est exactement ce qu'un
 * `findContours(RETR_EXTERNAL)` ne peut pas voir.
 */
export function classifyInterior(mask: Mask, skeleton: Mask): Uint8Array {
  const { width, height } = mask
  const background = new Uint8Array(width * height)
  for (let i = 0; i < background.length; i++) background[i] = mask.data[i] === 1 ? 0 : 1

  const halfWidth = distanceTransform(background, width, height)
  const toOutside = distanceTransform(outsideRegion(mask), width, height)

  const interior = new Uint8Array(width * height)
  for (let i = 0; i < interior.length; i++) {
    if (skeleton.data[i] !== 1) continue
    if (toOutside[i]! > halfWidth[i]! + 1.5) interior[i] = 1
  }
  return interior
}

/**
 * Nombre de taches d'encre distinctes. C'est le nombre de boucles fermées que
 * renvoie un générateur par contour extérieur : sa sortie complète.
 */
export function countInkComponents(mask: Mask): number {
  let count = 0
  forEachInkComponent(mask, () => count++)
  return count
}
