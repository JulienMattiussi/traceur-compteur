import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { bridgeOddVertices } from '@/lib/bridge'
import { analyse, buildPuzzle } from '@/lib/pipeline'
import { PAGE_WIDTH_MM, spacingInPixels } from '@/lib/page'
import { renderPdf } from '@/lib/pdf'
import { DEFAULT_SETTINGS, puzzleOptions } from '@/lib/settings'
import { renderSvg } from '@/lib/svg'
import type { Puzzle } from '@/lib/types'
import { readPgm } from './pgm'
import { createRaster, drawDisc, drawPolyline, writePng, type Color } from './raster'

const FIXTURES = 'tools/fixtures'
const OUT = 'out'
const BUDGETS = [250, 500, 1000]

const PALETTE: Color[] = [
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

    const skeletonView = createRaster(width, height)
    for (const edge of analysis.graph.edges) {
      drawPolyline(skeletonView, edge.points, [17, 24, 39], 1)
    }
    writePng(join(OUT, `${name}-0-squelette.png`), skeletonView)

    for (const maxDots of BUDGETS) {
      const puzzle = buildPuzzle(
        analysis,
        width,
        height,
        puzzleOptions({ ...DEFAULT_SETTINGS, maxDots }, width),
      )
      const s = puzzle.stats
      const totalMs = Object.values(s.timings).reduce((a, b) => a + b, 0)

      // La largeur utile de la page A4 : c'est la seule échelle à laquelle
      // « lisible » a un sens.
      const mmPerPixel = PAGE_WIDTH_MM / width
      console.log(
        `  budget ${String(maxDots).padStart(4)} -> ${String(s.dots).padStart(4)} points, ` +
          `${String(s.sequences).padStart(3)} sequences (mini ${s.minSequences}, ${s.bridges} ponts), ` +
          `tol ${s.tolerance.toFixed(2)} px, ecart max ${s.maxDeviation.toFixed(1)} px ` +
          `(${(s.maxDeviation * mmPerPixel).toFixed(2)} mm en A4), ` +
          `espacement mini ${(s.minSpacing * mmPerPixel).toFixed(2)} mm, ` +
          `perdu ${s.droppedTrails} traits (${((s.droppedLength / g.strokeLength) * 100).toFixed(1)} %), ` +
          `ambigus ${s.ambiguities.length}, ${totalMs.toFixed(0)} ms, ` +
          `mini-seq ${Math.min(...puzzle.sequences.map((q) => q.dots.length))} pts, ` +
          `numeros superposes ${s.labelCollisions}, retires ${s.removedForLabels}`,
      )

      writePng(join(OUT, `${name}-${maxDots}-solution.png`), renderSolution(puzzle))
      writePng(join(OUT, `${name}-${maxDots}-points.png`), renderDotsOnly(puzzle))
      writeFileSync(join(OUT, `${name}-${maxDots}-puzzle.svg`), renderSvg(puzzle))
      writeFileSync(join(OUT, `${name}-${maxDots}-puzzle.pdf`), renderPdf(puzzle, { title: name }))
    }

    // Le pontage est le levier du nombre de séquences.
    for (const mm of [0, 2, 4, 6, 9, 12]) {
      const puzzle = buildPuzzle(
        analysis,
        width,
        height,
        puzzleOptions({ ...DEFAULT_SETTINGS, maxDots: 300, bridgeMm: mm }, width),
      )
      const st = puzzle.stats
      console.log(
        `    pont ${String(mm).padStart(2)} mm -> ${String(st.sequences).padStart(3)} sequences ` +
          `(mini ${String(st.minSequences).padStart(3)}), ${String(st.bridges).padStart(3)} ponts ` +
          `ajoutant ${((st.bridgeLength / st.strokeLength) * 100).toFixed(1)} % de trait, ` +
          `${st.dots} points`,
      )
      writePng(join(OUT, `${name}-pont-${mm}mm.png`), renderSolution(puzzle))

      // Les ponts en rouge sur le dessin en gris : le seul moyen de juger si les
      // liaisons ajoutées sont acceptables ou si elles inventent des traits.
      const bridged = bridgeOddVertices(analysis.graph, spacingInPixels(width, mm))
      const view = createRaster(width, height)
      for (const edge of bridged.graph.edges) {
        if (edge.bridge) continue
        drawPolyline(view, edge.points, [190, 195, 200], 1)
      }
      for (const edge of bridged.graph.edges) {
        if (edge.bridge) drawPolyline(view, edge.points, [220, 20, 60], 2)
      }
      writePng(join(OUT, `${name}-ponts-vus-${mm}mm.png`), view)
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
