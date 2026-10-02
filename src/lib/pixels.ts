import type { Mask } from '@/lib/types'

/** Les huit voisins d'un pixel : un trait en diagonale reste d'un seul tenant. */
export const NEIGHBOURS_8 = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const

/**
 * Appelle `visit` sur chaque tache d'encre (composante 8-connexe). Le tableau de
 * pixels est réutilisé d'un appel à l'autre : le copier pour le conserver.
 */
export function forEachInkComponent(mask: Mask, visit: (pixels: number[]) => void): void {
  const { width, height, data } = mask
  const seen = new Uint8Array(data.length)
  const stack: number[] = []
  const component: number[] = []

  for (let start = 0; start < data.length; start++) {
    if (data[start] !== 1 || seen[start]) continue

    component.length = 0
    stack.push(start)
    seen[start] = 1

    while (stack.length > 0) {
      const p = stack.pop()!
      component.push(p)
      const x = p % width
      const y = (p - x) / width
      for (const [dx, dy] of NEIGHBOURS_8) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const q = ny * width + nx
        if (data[q] !== 1 || seen[q]) continue
        seen[q] = 1
        stack.push(q)
      }
    }

    visit(component)
  }
}
