import { useCallback, useMemo, useState } from 'react'
import { Controls } from '@/components/Controls'
import { Dropzone } from '@/components/Dropzone'
import { PuzzlePreview, type ViewMode } from '@/components/PuzzlePreview'
import { StatsPanel } from '@/components/StatsPanel'
import { download, loadGrayImage, type LoadedImage } from '@/lib/image'
import { analyse, buildPuzzle } from '@/lib/pipeline'
import { DEFAULT_SETTINGS, spacingInPixels, type Settings } from '@/lib/settings'
import { renderPdf } from '@/lib/pdf'
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
    <div className="min-h-screen bg-slate-50 text-slate-900 print:min-h-0 print:bg-white">
      <div className="mx-auto max-w-6xl p-6 print:p-0">
        <header className="print:hidden">
          <h1 className="text-2xl font-bold">Traceur-compteur</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Un générateur de « relier les points » qui garde le tracé intérieur du dessin, et pas
            seulement son contour. Tout se calcule dans le navigateur : ton image ne part nulle
            part.
          </p>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_1fr] print:mt-0 print:gap-0">
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
                    onClick={exportPdf}
                    className="rounded-md border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
                  >
                    Télécharger le PDF
                  </button>
                  <button
                    type="button"
                    onClick={exportSvg}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100"
                  >
                    Le SVG
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100"
                  >
                    Imprimer
                  </button>
                </div>

                {/*
                  La surimpression a sa propre ligne, et la place du curseur y est
                  réservée en permanence : sur la même ligne que les actions, son
                  apparition faisait sauter les boutons suivants.
                */}
                <div className="mb-3 flex items-center gap-3 print:hidden">
                  <button
                    type="button"
                    onClick={() => setOverlay((value) => !value)}
                    aria-pressed={overlay}
                    className={`rounded-md border px-3 py-1.5 text-sm ${
                      overlay
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Image source
                  </button>

                  <label
                    className={`flex items-center gap-2 text-sm text-slate-600 ${
                      overlay ? '' : 'invisible'
                    }`}
                  >
                    <input
                      type="range"
                      min={5}
                      max={100}
                      value={overlayOpacity}
                      disabled={!overlay}
                      onChange={(event) => setOverlayOpacity(Number(event.target.value))}
                      aria-label="Opacité de l'image source"
                      aria-hidden={!overlay}
                      className="w-28 accent-slate-900"
                    />
                    {/* Largeur fixe : sinon passer de 9 % à 100 % décalerait le texte. */}
                    <span className="w-11 tabular-nums">{overlayOpacity} %</span>
                  </label>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-2 print:border-0 print:p-0">
                  <PuzzlePreview
                    puzzle={puzzle}
                    mode={mode}
                    overlayUrl={overlay ? (image?.sourceUrl ?? null) : null}
                    overlayOpacity={overlayOpacity}
                  />
                </div>

                {puzzle.sequences.length > 1 ? (
                  <p className="mt-3 text-sm text-slate-600 print:hidden">
                    Les numéros se suivent de 1 à {puzzle.stats.dots}. Un cercle autour d&apos;un
                    point signale qu&apos;il faut lever le crayon : le dessin compte{' '}
                    {puzzle.stats.sequences} tracés séparés, et c&apos;est le minimum atteignable
                    avec ces réglages. Pour en avoir moins, augmente les liaisons ajoutées.
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
