import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { analyse, buildPuzzle } from '@/lib/pipeline'
import { PAGE_WIDTH_MM, spacingInPixels } from '@/lib/settings'
import { renderSvg } from '@/lib/svg'
import type { Puzzle } from '@/lib/types'
import { readPgm } from './pgm'
import { createRaster, drawDisc, drawPolyline, writePng, type Colour } from './raster'

const FIXTURES = 'tools/fixtures'
const OUT = 'out'
const BUDGETS = [250, 500, 1000]
const SPACINGS_MM = [3, 4, 5]

const PALETTE: Colour[] = [
  [37, 99, 235],
  [219, 39, 119],
  [22, 163, 74],
  [234, 88, 12],
  [124, 58, 237],
  [8, 145, 178],
]

function main(): void {
  mkdirSync(OUT, { recursive: true })

  const files = readdirSync(FIXTURES).filter((name) => name.endsWith('.pgm'))
  if (files.length === 0) {
    console.error(`Aucun .pgm dans ${FIXTURES}. Lance "make fixtures" d'abord.`)
    process.exit(1)
  }

  for (const file of files) {
    const name = basename(file, '.pgm')
    const { width, height, gray } = readPgm(join(FIXTURES, file))

    const analysis = analyse(gray, width, height)
    const g = analysis.geometry

    console.log(`\n=== ${name} (${width}x${height})`)
    console.log(
      `  squelette         ${g.skeletonPixels} px, longueur ${Math.round(g.strokeLength)} px`,
    )
    console.log(
      `  graphe            ${g.nodes} sommets dont ${g.junctions} jonctions, ${g.edges} traits`,
    )
    console.log(
      `  traits interieurs ${g.interiorEdges}/${g.edges} (${Math.round(g.interiorLength)} px, ` +
        `${((g.interiorLength / g.strokeLength) * 100).toFixed(1)} % de la longueur)`,
    )
    console.log(`  un contour seul   ${g.contourLoops} boucle(s) fermee(s), 0 jonction`)

    // Aperçu du squelette vectorisé : silhouette en noir, intérieur en rouge.
    const skeletonView = createRaster(width, height)
    for (const edge of analysis.graph.edges) {
      drawPolyline(skeletonView, edge.points, [17, 24, 39], 1)
    }
    writePng(join(OUT, `${name}-0-squelette.png`), skeletonView)

    for (const maxDots of BUDGETS) {
      const minSpacing = spacingInPixels(width, 4)
      const puzzle = buildPuzzle(analysis, width, height, {
        maxDots,
        minSpacing,
        minTrailLength: minSpacing * 2,
      })
      const s = puzzle.stats
      const totalMs = Object.values(s.timings).reduce((a, b) => a + b, 0)

      // Une page A4 imprimée fait 210 mm de large : c'est la seule échelle à
      // laquelle « lisible » a un sens.
      const mmPerPixel = PAGE_WIDTH_MM / width
      console.log(
        `  budget ${String(maxDots).padStart(4)} -> ${String(s.dots).padStart(4)} points, ` +
          `${String(s.sequences).padStart(3)} sequences (mini theorique ${s.minSequences}), ` +
          `tol ${s.tolerance.toFixed(2)} px, ecart max ${s.maxDeviation.toFixed(1)} px ` +
          `(${(s.maxDeviation * mmPerPixel).toFixed(2)} mm en A4), ` +
          `espacement mini ${(s.minSpacing * mmPerPixel).toFixed(2)} mm, ` +
          `serres ${s.crowdedPairs}, ` +
          `perdu ${s.droppedTrails} traits (${((s.droppedLength / g.strokeLength) * 100).toFixed(1)} %), ` +
          `ambigus ${s.ambiguities.length}, ${totalMs.toFixed(0)} ms`,
      )

      writePng(join(OUT, `${name}-${maxDots}-solution.png`), renderSolution(puzzle))
      writePng(join(OUT, `${name}-${maxDots}-points.png`), renderDotsOnly(puzzle))
      writeFileSync(join(OUT, `${name}-${maxDots}-puzzle.svg`), renderSvg(puzzle))
    }

    // L'espacement imprimé est le vrai levier de lisibilité : il plafonne le
    // nombre de points utiles, quel que soit le budget demandé.
    for (const mm of SPACINGS_MM) {
      const minSpacing = spacingInPixels(width, mm)
      const puzzle = buildPuzzle(analysis, width, height, {
        maxDots: 2000,
        minSpacing,
        minTrailLength: minSpacing * 2,
      })
      console.log(
        `    espacement ${mm} mm -> ${String(puzzle.stats.dots).padStart(4)} points au maximum, ` +
          `${String(puzzle.stats.sequences).padStart(3)} sequences, serres ${puzzle.stats.crowdedPairs}`,
      )
      writePng(join(OUT, `${name}-espacement-${mm}mm.png`), renderDotsOnly(puzzle))
    }
  }

  console.log(`\nApercus PNG et SVG imprimables dans ${OUT}/`)
}

/** Ce que l'utilisateur obtient en reliant les points, une couleur par séquence. */
function renderSolution(puzzle: Puzzle): ReturnType<typeof createRaster> {
  const raster = createRaster(puzzle.width, puzzle.height)
  for (let s = 0; s < puzzle.sequences.length; s++) {
    const sequence = puzzle.sequences[s]!
    drawPolyline(raster, sequence.dots, PALETTE[s % PALETTE.length]!, 1.6, sequence.closed)
  }
  return raster
}

/** Le puzzle nu, pour juger la densité et la lisibilité des pastilles. */
function renderDotsOnly(puzzle: Puzzle): ReturnType<typeof createRaster> {
  const raster = createRaster(puzzle.width, puzzle.height)
  for (const sequence of puzzle.sequences) {
    for (let i = 0; i < sequence.dots.length; i++) {
      const dot = sequence.dots[i]!
      drawDisc(raster, dot.x, dot.y, i === 0 ? 2.6 : 1.4, i === 0 ? [219, 39, 119] : [17, 24, 39])
    }
  }
  return raster
}

main()
