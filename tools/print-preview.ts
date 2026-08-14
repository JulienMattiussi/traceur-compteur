// Utilitaire jetable : reproduit la structure imprimée de l'application avec le
// CSS réellement construit, pour vérifier au navigateur combien de pages sortent.
import { readdirSync, writeFileSync } from 'node:fs'
import { analyse, buildPuzzle } from '@/lib/pipeline'
import { spacingInPixels } from '@/lib/settings'
import { renderSvg } from '@/lib/svg'
import { readPgm } from './pgm'

const name = process.argv[2] ?? 'lapin-dodo'
const out = process.argv[3] ?? '/tmp/print.html'
const css = readdirSync('dist/assets').find((f) => f.endsWith('.css'))!

const { width, height, gray } = readPgm(`tools/fixtures/${name}.pgm`)
const analysis = analyse(gray, width, height)
const minSpacing = spacingInPixels(width, 2.5)
const puzzle = buildPuzzle(analysis, width, height, {
  maxDots: 250,
  minSpacing,
  minTrailLength: minSpacing * 2,
  bridgeGap: spacingInPixels(width, 8),
})

writeFileSync(
  out,
  `<!doctype html><meta charset="utf-8"><title>Traceur-compteur</title>
<link rel="stylesheet" href="${process.cwd()}/dist/assets/${css}">
<body><div id="root">
<div class="min-h-screen bg-slate-50 text-slate-900 print:min-h-0 print:bg-white">
  <div class="mx-auto max-w-6xl p-6 print:p-0">
    <header class="print:hidden"><h1 class="text-2xl font-bold">Traceur-compteur</h1></header>
    <div class="mt-6 grid gap-6 lg:grid-cols-[20rem_1fr] print:mt-0 print:gap-0">
      <aside class="space-y-6 print:hidden"><section class="rounded-lg border p-4">reglages</section></aside>
      <main>
        <div class="mb-3 flex flex-wrap items-center gap-2 print:hidden"><button>Imprimer</button></div>
        <div class="mb-3 flex items-center gap-3 print:hidden"><button>Image source</button></div>
        <div class="rounded-lg border border-slate-200 bg-white p-2 print:border-0 print:p-0">
          <div class="relative"><div class="relative [&>svg]:h-auto [&>svg]:w-full">${renderSvg(puzzle)}</div></div>
        </div>
        <p class="mt-3 text-sm text-slate-600 print:hidden">note</p>
      </main>
    </div>
  </div>
</div></div>`,
)
console.log(`${out} (${width}x${height}, ${puzzle.stats.dots} points)`)
