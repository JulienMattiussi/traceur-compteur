import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Controls } from '@/components/Controls'
import { Dropzone } from '@/components/Dropzone'
import { Logo, TitleLink } from '@/components/Logo'
import { PuzzlePreview, type ViewMode } from '@/components/PuzzlePreview'
import { StatsPanel } from '@/components/StatsPanel'
import { Toolbar } from '@/components/Toolbar'
import { download, loadGrayImage, type LoadedImage } from '@/platform/image'
import { renderPdf } from '@/lib/pdf'
import { analyse, buildPuzzle } from '@/lib/pipeline'
import { spacingInPixels } from '@/lib/page'
import { DEFAULT_SETTINGS, type Settings } from '@/lib/settings'
import { renderSvg } from '@/lib/svg'

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  )
}

export default function App() {
  const [image, setImage] = useState<LoadedImage | null>(null)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [mode, setMode] = useState<ViewMode>('puzzle')
  const [overlay, setOverlay] = useState(false)
  const [overlayOpacity, setOverlayOpacity] = useState(35)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      const loaded = await loadGrayImage(file)
      // L'URL d'objet de l'image remplacée doit être révoquée, sinon son blob
      // reste en mémoire pour toute la durée de la page.
      setImage((previous) => {
        if (previous) URL.revokeObjectURL(previous.sourceUrl)
        return loaded
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Image illisible.')
      setImage(null)
    } finally {
      setBusy(false)
    }
  }, [])

  // Les deux étapes sont mémoïsées séparément : la squelettisation et la
  // vectorisation coûtent l'essentiel du temps, alors que déplacer les points se
  // recalcule vite. Bouger le curseur « nombre de points » ne rejoue donc pas
  // toute l'analyse.
  const analysis = useMemo(() => {
    if (!image) return null
    return analyse(image.gray, image.width, image.height, {
      threshold: settings.threshold,
      minBlobArea: settings.minBlobArea,
      pruneSpursBelow: settings.pruneSpursBelow,
    })
  }, [image, settings.threshold, settings.minBlobArea, settings.pruneSpursBelow])

  const puzzle = useMemo(() => {
    if (!analysis || !image) return null
    const minSpacing = spacingInPixels(image.width, settings.spacingMm)
    return buildPuzzle(analysis, image.width, image.height, {
      maxDots: settings.maxDots,
      minSpacing,
      minTrailLength: minSpacing * 2,
      bridgeGap: spacingInPixels(image.width, settings.bridgeMm),
    })
  }, [analysis, image, settings.maxDots, settings.spacingMm, settings.bridgeMm])

  const baseName = image ? image.name.replace(/\.[^.]+$/, '') : 'puzzle'

  const exportSvg = (): void => {
    if (!puzzle) return
    download(`${baseName}-points.svg`, renderSvg(puzzle), 'image/svg+xml')
  }

  const exportPdf = (): void => {
    if (!puzzle) return
    // Le PDF est la sortie maîtrisée : A4 exacte, aucune en-tête de navigateur,
    // et l'échelle en millimètres prévue par le moteur.
    download(
      `${baseName}-points.pdf`,
      renderPdf(puzzle, { title: baseName, solutionOnly: mode === 'solution' }),
      'application/pdf',
    )
  }

  return (
    <div className="min-h-screen print:min-h-0">
      <div className="mx-auto max-w-6xl px-6 py-8 print:p-0">
        <header className="flex items-center gap-3.5 print:hidden">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70">
            <Logo className="h-7 w-9 text-slate-900" />
          </span>
          <div>
            {/*
              Le trait d'union est remplacé par une liaison pointillée. Le nom
              accessible reste entier grâce à `aria-label`.
            */}
            <h1
              aria-label="Traceur-compteur"
              className="flex items-center gap-1.5 text-2xl font-bold tracking-tight text-slate-900"
            >
              <span>Traceur</span>
              <TitleLink />
              <span>compteur</span>
            </h1>
            <p className="text-sm text-slate-600">
              Le relier-les-points qui garde le tracé intérieur du dessin, pas seulement son
              contour.
            </p>
          </div>
        </header>

        <div className="mt-7 grid gap-6 lg:grid-cols-[21rem_1fr] print:mt-0 print:gap-0">
          <aside className="space-y-4 print:hidden">
            <Dropzone onFile={handleFile} busy={busy} currentName={image?.name ?? null} />

            {error ? (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200"
              >
                {error}
              </p>
            ) : null}

            {image ? (
              <Card title="Réglages">
                <Controls settings={settings} onChange={setSettings} disabled={busy} />
              </Card>
            ) : null}

            {puzzle ? (
              <Card title="Mesures">
                <StatsPanel puzzle={puzzle} />
              </Card>
            ) : null}
          </aside>

          <main>
            {puzzle ? (
              <>
                <div className="puzzle-sheet overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70 print:rounded-none print:shadow-none print:ring-0">
                  <div className="border-b border-slate-200/70 bg-slate-50/70 px-4 py-3 print:hidden">
                    <Toolbar
                      mode={mode}
                      onMode={setMode}
                      overlay={overlay}
                      onOverlay={setOverlay}
                      overlayOpacity={overlayOpacity}
                      onOverlayOpacity={setOverlayOpacity}
                      onExportPdf={exportPdf}
                      onExportSvg={exportSvg}
                      onPrint={() => window.print()}
                    />
                  </div>

                  <div className="p-4 print:p-0">
                    <PuzzlePreview
                      puzzle={puzzle}
                      mode={mode}
                      overlayUrl={overlay ? (image?.sourceUrl ?? null) : null}
                      overlayOpacity={overlayOpacity}
                    />
                  </div>
                </div>

                {puzzle.sequences.length > 1 ? (
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 print:hidden">
                    Les numéros se suivent de 1 à {puzzle.stats.dots}. Un cercle autour d&apos;un
                    point signale qu&apos;il faut lever le crayon : le dessin compte{' '}
                    {puzzle.stats.sequences} tracés séparés, et c&apos;est le minimum atteignable
                    avec ces réglages. Pour en avoir moins, augmente les liaisons ajoutées.
                  </p>
                ) : null}
              </>
            ) : (
              <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-white/60 text-center">
                <Logo className="h-12 w-16 text-slate-300" />
                <p className="text-sm text-slate-500">
                  {busy ? 'Analyse en cours...' : 'Choisis une image pour commencer.'}
                </p>
              </div>
            )}
          </main>
        </div>

        <footer className="mt-10 text-center text-sm text-slate-500 print:hidden">
          <a
            href="https://github.com/JulienMattiussi/traceur-compteur"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:text-slate-900"
          >
            Fait avec <span className="text-rose-500">&#10084;&#65039;</span> par{' '}
            <span className="font-medium underline decoration-sky-400 decoration-2 underline-offset-4">
              YavaDeus
            </span>
          </a>
        </footer>
      </div>
    </div>
  )
}
