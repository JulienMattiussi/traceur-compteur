// Utilitaire jetable : reproduit la structure imprimée de l'application avec le
// CSS réellement construit, pour vérifier au navigateur combien de pages sortent.
import { readdirSync, writeFileSync } from 'node:fs'
import { analyse, buildPuzzle } from '@/lib/pipeline'
import { spacingInPixels } from '@/lib/page'
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
<div class="min-h-screen print:min-h-0">
  <div class="mx-auto max-w-6xl px-6 py-8 print:p-0">
    <header class="print:hidden"><h1 class="text-2xl font-bold">Traceur-compteur</h1></header>
    <div class="mt-7 grid gap-6 lg:grid-cols-[21rem_1fr] print:mt-0 print:gap-0">
      <aside class="space-y-4 print:hidden"><section class="rounded-xl bg-white p-4">reglages</section></aside>
      <main>
        <div class="puzzle-sheet overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70 print:rounded-none print:shadow-none print:ring-0">
          <div class="border-b border-slate-200/70 bg-slate-50/70 px-4 py-3 print:hidden"><button>Imprimer</button></div>
          <div class="p-4 print:p-0">
            <div class="relative"><div class="relative [&>svg]:h-auto [&>svg]:w-full">${renderSvg(puzzle)}</div></div>
          </div>
        </div>
        <p class="mt-3 text-sm text-slate-600 print:hidden">note</p>
      </main>
    </div>
  </div>
</div></div>`,
)
console.log(`${out} (${width}x${height}, ${puzzle.stats.dots} points)`)
