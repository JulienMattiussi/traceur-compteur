import type { ViewMode } from '@/components/PuzzlePreview'

const VIEWS: { value: ViewMode; label: string }[] = [
  { value: 'puzzle', label: 'Le puzzle' },
  { value: 'both', label: 'Avec le tracé' },
  { value: 'solution', label: 'La solution' },
]

interface ToolbarProps {
  mode: ViewMode
  onMode: (mode: ViewMode) => void
  overlay: boolean
  onOverlay: (overlay: boolean) => void
  overlayOpacity: number
  onOverlayOpacity: (opacity: number) => void
  onExportPdf: () => void
  onExportSvg: () => void
  onPrint: () => void
}

function GroupLabel({ children }: { children: string }) {
  return (
    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </span>
  )
}

/**
 * Deux groupes distincts : ce qu'on regarde, et ce qu'on emporte. Les mélanger
 * obligeait à relire toute la barre pour trouver le bouton d'export.
 */
export function Toolbar({
  mode,
  onMode,
  overlay,
  onOverlay,
  overlayOpacity,
  onOverlayOpacity,
  onExportPdf,
  onExportSvg,
  onPrint,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 print:hidden">
      <div role="group" aria-label="Affichage">
        <GroupLabel>Affichage</GroupLabel>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-1">
            {VIEWS.map((view) => (
              <button
                key={view.value}
                type="button"
                onClick={() => onMode(view.value)}
                aria-pressed={mode === view.value}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === view.value
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onOverlay(!overlay)}
            aria-pressed={overlay}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 transition-colors ${
              overlay
                ? 'bg-sky-50 text-sky-800 ring-sky-300'
                : 'bg-white text-slate-600 ring-slate-300 hover:text-slate-900'
            }`}
          >
            Image source
          </button>

          {/*
            La place du curseur est réservée en permanence : apparaissant, il
            faisait sauter les boutons suivants à la ligne.
          */}
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
              onChange={(event) => onOverlayOpacity(Number(event.target.value))}
              aria-label="Opacité de l'image source"
              aria-hidden={!overlay}
              className="w-24 accent-sky-500"
            />
            {/* Largeur fixe : passer de 9 % à 100 % décalerait le texte. */}
            <span className="w-11 tabular-nums">{overlayOpacity} %</span>
          </label>
        </div>
      </div>

      <div role="group" aria-label="Exporter">
        <GroupLabel>Exporter</GroupLabel>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExportPdf}
            className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700"
          >
            Télécharger le PDF
          </button>
          <button
            type="button"
            onClick={onExportSvg}
            className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-300 transition-colors hover:text-slate-900"
          >
            Le SVG
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-300 transition-colors hover:text-slate-900"
          >
            Imprimer
          </button>
        </div>
      </div>
    </div>
  )
}
