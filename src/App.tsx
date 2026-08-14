import { useCallback, useMemo, useState } from 'react'
import { Controls } from '@/components/Controls'
import { Dropzone } from '@/components/Dropzone'
import { PuzzlePreview, type ViewMode } from '@/components/PuzzlePreview'
import { StatsPanel } from '@/components/StatsPanel'
import { downloadText, loadGrayImage, type LoadedImage } from '@/lib/image'
import { analyse, buildPuzzle } from '@/lib/pipeline'
import { DEFAULT_SETTINGS, spacingInPixels, type Settings } from '@/lib/settings'
import { renderSvg } from '@/lib/svg'

const VIEWS: { value: ViewMode; label: string }[] = [
  { value: 'puzzle', label: 'Le puzzle' },
  { value: 'both', label: 'Avec le tracé' },
  { value: 'solution', label: 'La solution' },
]

export default function App() {
  const [image, setImage] = useState<LoadedImage | null>(null)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [mode, setMode] = useState<ViewMode>('puzzle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      setImage(await loadGrayImage(file))
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
    })
  }, [analysis, image, settings.maxDots, settings.spacingMm])

  const exportSvg = (): void => {
    if (!puzzle || !image) return
    const base = image.name.replace(/\.[^.]+$/, '')
    downloadText(`${base}-points.svg`, renderSvg(puzzle), 'image/svg+xml')
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl p-6">
        <header className="print:hidden">
          <h1 className="text-2xl font-bold">Traceur-compteur</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Un générateur de « relier les points » qui garde le tracé intérieur du dessin, et pas
            seulement son contour. Tout se calcule dans le navigateur : ton image ne part nulle
            part.
          </p>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_1fr]">
          <aside className="space-y-6 print:hidden">
            <Dropzone onFile={handleFile} busy={busy} currentName={image?.name ?? null} />

            {error ? (
              <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                {error}
              </p>
            ) : null}

            {image ? (
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <Controls settings={settings} onChange={setSettings} disabled={busy} />
              </section>
            ) : null}

            {puzzle ? (
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <StatsPanel puzzle={puzzle} />
              </section>
            ) : null}
          </aside>

          <main>
            {puzzle ? (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
                  <div className="flex overflow-hidden rounded-md border border-slate-300">
                    {VIEWS.map((view) => (
                      <button
                        key={view.value}
                        type="button"
                        onClick={() => setMode(view.value)}
                        aria-pressed={mode === view.value}
                        className={`px-3 py-1.5 text-sm ${
                          mode === view.value
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {view.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={exportSvg}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100"
                  >
                    Télécharger le SVG
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100"
                  >
                    Imprimer
                  </button>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-2 print:border-0">
                  <PuzzlePreview puzzle={puzzle} mode={mode} />
                </div>

                {puzzle.sequences.length > 1 ? (
                  <p className="mt-3 text-sm text-slate-600 print:hidden">
                    Les numéros se suivent de 1 à {puzzle.stats.dots}. Un cercle autour d&apos;un
                    point signale qu&apos;il faut lever le crayon : le dessin compte{' '}
                    {puzzle.stats.sequences} tracés séparés, et c&apos;est le minimum possible sans
                    repasser deux fois sur un trait.
                  </p>
                ) : null}
              </>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500">
                {busy ? 'Analyse en cours...' : 'Choisis une image pour commencer.'}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
