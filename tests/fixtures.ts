import type { Mask, Point } from '@/lib/types'

/** Petits dessins synthétiques, pour tester la topologie sans dépendre d'une image. */
export function createMask(width: number, height: number): Mask {
  return { width, height, data: new Uint8Array(width * height) }
}

export function ink(mask: Mask, x: number, y: number): void {
  if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return
  mask.data[Math.round(y) * mask.width + Math.round(x)] = 1
}

/** Trait de Bresenham, épaissi par un carré pour simuler un contour de coloriage. */
export function line(mask: Mask, from: Point, to: Point, thickness = 1): void {
  let x = Math.round(from.x)
  let y = Math.round(from.y)
  const x1 = Math.round(to.x)
  const y1 = Math.round(to.y)
  const dx = Math.abs(x1 - x)
  const dy = Math.abs(y1 - y)
  const stepX = x < x1 ? 1 : -1
  const stepY = y < y1 ? 1 : -1
  let error = dx - dy
  const reach = Math.floor((thickness - 1) / 2)

  for (;;) {
    for (let oy = -reach; oy <= reach; oy++) {
      for (let ox = -reach; ox <= reach; ox++) ink(mask, x + ox, y + oy)
    }
    if (x === x1 && y === y1) break
    const doubled = 2 * error
    if (doubled > -dy) {
      error -= dy
      x += stepX
    }
    if (doubled < dx) {
      error += dx
      y += stepY
    }
  }
}

export function rectangle(
  mask: Mask,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thickness = 1,
) {
  line(mask, { x: x0, y: y0 }, { x: x1, y: y0 }, thickness)
  line(mask, { x: x1, y: y0 }, { x: x1, y: y1 }, thickness)
  line(mask, { x: x1, y: y1 }, { x: x0, y: y1 }, thickness)
  line(mask, { x: x0, y: y1 }, { x: x0, y: y0 }, thickness)
}

export function circle(mask: Mask, cx: number, cy: number, radius: number): void {
  const steps = Math.max(16, Math.ceil(2 * Math.PI * radius))
  let previous: Point = { x: cx + radius, y: cy }
  for (let i = 1; i <= steps; i++) {
    const angle = (2 * Math.PI * i) / steps
    const next = { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
    line(mask, previous, next)
    previous = next
  }
}

/** Convertit un masque en niveaux de gris, pour alimenter le pipeline complet. */
export function maskToGray(mask: Mask): Uint8Array {
  const gray = new Uint8Array(mask.data.length)
  for (let i = 0; i < gray.length; i++) gray[i] = mask.data[i] === 1 ? 0 : 255
  return gray
}
