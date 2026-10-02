import { binarize, type BinarizeOptions } from '@/lib/binarize'
import { classifyInterior, countInkComponents } from '@/lib/interior'
import { bridgeOddVertices } from '@/lib/bridge'
import { buildGraph, type GraphOptions } from '@/lib/graph'
import { resolveLabels } from '@/lib/labels'
import { metricsFor } from '@/lib/page'
import { checkQuality } from '@/lib/quality'
import { DEFAULT_SETTINGS } from '@/lib/settings'
import { countDots, placeDots, type DotOptions } from '@/lib/dots'
import { thin } from '@/lib/thin'
import { decomposeTrails, minimumTrailCount } from '@/lib/trails'
import type { DotSequence, GeometryStats, Mask, Puzzle, SkeletonGraph } from '@/lib/types'

export interface PipelineOptions extends BinarizeOptions, GraphOptions, DotOptions {
  /**
   * Distance maximale, en pixels, d'un pont ajouté entre deux sommets de degré
   * impair. C'est le levier du nombre de séquences. 0 désactive.
   */
  bridgeGap?: number
}

/** Hors interface (outils, tests). Tolérance et espacement : ceux de `placeDots`. */
const DEFAULT_OPTIONS: PipelineOptions = {
  threshold: DEFAULT_SETTINGS.threshold,
  minBlobArea: DEFAULT_SETTINGS.minBlobArea,
  pruneSpursBelow: DEFAULT_SETTINGS.pruneSpursBelow,
  bridgeGap: 0,
  // Deux fois l'espacement par défaut de `placeDots`, comme `puzzleOptions`.
  minTrailLength: 14,
}

/** Chronomètre monotone, disponible côté navigateur comme côté Node. */
const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())

export interface Analysis {
  mask: Mask
  skeleton: Mask
  graph: SkeletonGraph
  geometry: GeometryStats
  timings: Record<string, number>
}

/** Binarise, squelettise et vectorise. Séparé du placement des points, qui se rejoue à volonté. */
export function analyse(
  gray: Uint8Array,
  width: number,
  height: number,
  options: PipelineOptions = {},
): Analysis {
  const settings = { ...DEFAULT_OPTIONS, ...options }
  const timings: Record<string, number> = {}

  let mark = now()
  const mask = binarize(gray, width, height, settings)
  timings.binarize = now() - mark

  mark = now()
  const skeleton = thin(mask)
  timings.thin = now() - mark

  mark = now()
  const graph = buildGraph(skeleton, settings)
  timings.graph = now() - mark

  mark = now()
  const interior = classifyInterior(mask, skeleton)
  const contourLoops = countInkComponents(mask)
  timings.interior = now() - mark

  let skeletonPixels = 0
  for (let i = 0; i < skeleton.data.length; i++) skeletonPixels += skeleton.data[i]!

  const junctions = graph.nodes.filter((node) => node.degree >= 3).length
  const strokeLength = graph.edges.reduce((total, edge) => total + edge.length, 0)

  // Une arête est intérieure si la majorité de ses pixels l'est : la
  // classification est locale, un trait peut affleurer la silhouette à une
  // extrémité sans en faire partie.
  let interiorEdges = 0
  let interiorLength = 0
  for (const edge of graph.edges) {
    let inside = 0
    for (const point of edge.points) {
      if (interior[point.y * width + point.x] === 1) inside++
    }
    if (inside * 2 > edge.points.length) {
      interiorEdges++
      interiorLength += edge.length
    }
  }

  return {
    mask,
    skeleton,
    graph,
    timings,
    geometry: {
      skeletonPixels,
      nodes: graph.nodes.length,
      junctions,
      edges: graph.edges.length,
      interiorEdges,
      strokeLength,
      interiorLength,
      contourLoops,
    },
  }
}

/** Chaîne complète : image en niveaux de gris vers puzzle numéroté. */
export function generatePuzzle(
  gray: Uint8Array,
  width: number,
  height: number,
  options: PipelineOptions = {},
): Puzzle {
  const analysis = analyse(gray, width, height, options)
  return buildPuzzle(analysis, width, height, options)
}

export function buildPuzzle(
  analysis: Analysis,
  width: number,
  height: number,
  options: PipelineOptions = {},
): Puzzle {
  const settings = { ...DEFAULT_OPTIONS, ...options }
  const timings = { ...analysis.timings }

  let mark = now()
  // Les ponts se posent ici, pas dans `analyse` : c'est un choix de mise en
  // forme du puzzle, qu'on veut pouvoir rejouer sans refaire la
  // squelettisation. `analysis.graph` n'est jamais modifié.
  const bridged = bridgeOddVertices(analysis.graph, settings.bridgeGap ?? 0)
  timings.bridge = now() - mark

  mark = now()
  const trails = decomposeTrails(bridged.graph)
  const minSequences = minimumTrailCount(bridged.graph)
  timings.trails = now() - mark

  mark = now()
  const placement = placeDots(trails, settings)
  timings.dots = now() - mark

  // Numérotation continue sur tout le puzzle : `resolveLabels` s'appuie dessus
  // pour connaître la largeur de chaque étiquette.
  let running = 1
  let sequences: DotSequence[] = placement.sequences.map((sequence) => {
    const result: DotSequence = { ...sequence, firstNumber: running }
    running += sequence.dots.length
    return result
  })

  // Les points peuvent être serrés, c'est même utile dans une courbe : ce qui
  // rend un puzzle illisible, c'est deux numéros superposés. On les place donc
  // autour de leur pastille, et on ne retire un point qu'en dernier recours.
  mark = now()
  const resolved = resolveLabels(sequences, metricsFor(width, height))
  sequences = resolved.sequences
  const labels = resolved.labels
  timings.labels = now() - mark

  const dots = countDots(sequences)

  mark = now()
  const quality = checkQuality(sequences, width)
  timings.quality = now() - mark

  return {
    width,
    height,
    sequences,
    labels,
    stats: {
      ...analysis.geometry,
      dots,
      sequences: sequences.length,
      minSequences,
      bridges: bridged.bridges,
      bridgeLength: bridged.bridgeLength,
      tolerance: placement.tolerance,
      maxDeviation: placement.maxDeviation,
      minSpacing: quality.minSpacing,
      labelCollisions: labels.filter((label) => !label.placed).length,
      removedForLabels: resolved.removed,
      droppedTrails: placement.droppedTrails,
      droppedLength: placement.droppedLength,
      ambiguities: quality.ambiguities,
      timings,
    },
  }
}
