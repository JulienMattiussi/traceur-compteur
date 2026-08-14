import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import type { Point } from '@/lib/types'

export interface Raster {
  width: number
  height: number
  rgb: Uint8Array
}

export type Colour = [number, number, number]

/**
 * Rasteriseur minimal. Le but est de pouvoir regarder le résultat sans dépendre
 * d'un moteur de rendu SVG : on dessine soi-même, on écrit un PPM, et `ffmpeg`
 * convertit en PNG.
 */
export function createRaster(width: number, height: number): Raster {
  const rgb = new Uint8Array(width * height * 3).fill(255)
  return { width, height, rgb }
}

function plot(raster: Raster, x: number, y: number, colour: Colour): void {
  if (x < 0 || y < 0 || x >= raster.width || y >= raster.height) return
  const p = (y * raster.width + x) * 3
  raster.rgb[p] = colour[0]
  raster.rgb[p + 1] = colour[1]
  raster.rgb[p + 2] = colour[2]
}

export function drawDisc(raster: Raster, cx: number, cy: number, radius: number, colour: Colour) {
  const r = Math.ceil(radius)
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= radius * radius) {
        plot(raster, Math.round(cx) + dx, Math.round(cy) + dy, colour)
      }
    }
  }
}

/** Bresenham, épaissi par un disque quand on demande plus d'un pixel. */
function drawLine(raster: Raster, from: Point, to: Point, colour: Colour, thickness = 1): void {
  let x0 = Math.round(from.x)
  let y0 = Math.round(from.y)
  const x1 = Math.round(to.x)
  const y1 = Math.round(to.y)

  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const stepX = x0 < x1 ? 1 : -1
  const stepY = y0 < y1 ? 1 : -1
  let error = dx - dy

  for (;;) {
    if (thickness <= 1) plot(raster, x0, y0, colour)
    else drawDisc(raster, x0, y0, thickness / 2, colour)

    if (x0 === x1 && y0 === y1) break
    const doubled = 2 * error
    if (doubled > -dy) {
      error -= dy
      x0 += stepX
    }
    if (doubled < dx) {
      error += dx
      y0 += stepY
    }
  }
}

export function drawPolyline(
  raster: Raster,
  points: Point[],
  colour: Colour,
  thickness = 1,
  closed = false,
): void {
  for (let i = 1; i < points.length; i++) {
    drawLine(raster, points[i - 1]!, points[i]!, colour, thickness)
  }
  if (closed && points.length > 2) {
    drawLine(raster, points[points.length - 1]!, points[0]!, colour, thickness)
  }
}

/** Écrit un PPM (P6) puis le convertit en PNG via ffmpeg. */
export function writePng(path: string, raster: Raster): void {
  const ppm = `${path}.ppm`
  const header = Buffer.from(`P6\n${raster.width} ${raster.height}\n255\n`, 'ascii')
  writeFileSync(ppm, Buffer.concat([header, Buffer.from(raster.rgb)]))
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', ppm, path])
  execFileSync('rm', ['-f', ppm])
}
