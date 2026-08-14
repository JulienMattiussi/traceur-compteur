import { PAGE_WIDTH_MM } from '@/lib/settings'
import type { Puzzle } from '@/lib/types'

interface StatsPanelProps {
  puzzle: Puzzle
}

/**
 * Chiffre mis en avant. Figures **proportionnelles** et non tabulaires : à cette
 * taille, `tabular-nums` donnerait à chaque chiffre la largeur d'un zéro et le
 * nombre paraîtrait distendu. Le tabulaire est réservé aux colonnes qui doivent
 * s'aligner, plus bas.
 */
function Tile({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200/70">
      <div className="text-2xl font-semibold leading-none text-slate-900">{value}</div>
      <div className="mt-1 text-xs font-medium text-slate-700">{label}</div>
      <div className="text-[11px] leading-tight text-slate-500">{hint}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </h3>
  )
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0">
      <span className="text-slate-600">
        {label}
        {hint ? <span className="ml-1 text-xs text-slate-400">{hint}</span> : null}
      </span>
      <span className="shrink-0 font-medium tabular-nums text-slate-900">{value}</span>
    </div>
  )
}

/**
 * Voyant d'état. La couleur ne porte jamais seule le sens : elle vient toujours
 * avec un symbole et un libellé, et le texte utilise une teinte assez sombre pour
 * rester lisible sur fond clair.
 */
function Indicator({ label, count }: { label: string; count: number }) {
  const good = count === 0
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1.5">
      <span className="text-slate-600">{label}</span>
      <span
        className={`flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ${
          good ? 'bg-green-50 text-[#006300]' : 'bg-amber-50 text-amber-800'
        }`}
      >
        <span aria-hidden="true">{good ? '✓' : '!'}</span>
        {good ? 'aucun' : `${count} à corriger`}
      </span>
    </div>
  )
}

export function StatsPanel({ puzzle }: StatsPanelProps) {
  const s = puzzle.stats
  // Sur la page imprimée, c'est la seule échelle où « lisible » veut dire
  // quelque chose.
  const mmPerPixel = PAGE_WIDTH_MM / puzzle.width
  const interiorShare = s.strokeLength > 0 ? (s.interiorLength / s.strokeLength) * 100 : 0
  const totalMs = Object.values(s.timings).reduce((total, value) => total + value, 0)

  return (
    <div className="text-sm">
      <div className="grid grid-cols-2 gap-2">
        <Tile label="Points" value={s.dots} hint="à relier" />
        <Tile
          label="Séquences"
          value={s.sequences}
          hint={`levers de crayon, minimum ${s.minSequences}`}
        />
      </div>

      <SectionTitle>Qualité</SectionTitle>
      <Indicator label="Numéros superposés" count={s.labelCollisions} />
      <Row
        label="Fidélité au dessin"
        hint="écart maximal"
        value={`${(s.maxDeviation * mmPerPixel).toFixed(2)} mm`}
      />
      <Row
        label="Points retirés"
        hint="numéro incasable"
        value={s.removedForLabels === 0 ? 'aucun' : `${s.removedForLabels}`}
      />
      <Row
        label="Traits écartés"
        hint="trop courts"
        value={
          s.droppedTrails === 0
            ? 'aucun'
            : `${s.droppedTrails} (${((s.droppedLength / s.strokeLength) * 100).toFixed(1)} %)`
        }
      />

      <SectionTitle>Ce que contient le dessin</SectionTitle>
      <Row label="Traits détectés" value={`${s.edges}`} />
      <Row label="Jonctions" hint="un contour seul en a 0" value={`${s.junctions}`} />
      <Row
        label="Tracé intérieur"
        hint="perdu ailleurs"
        value={`${interiorShare.toFixed(0)} %`}
      />
      <Row
        label="Sortie d'un contour seul"
        value={`${s.contourLoops} boucle${s.contourLoops > 1 ? 's' : ''}`}
      />

      <SectionTitle>Mise en forme</SectionTitle>
      <Row
        label="Liaisons ajoutées"
        hint="hors dessin"
        value={
          s.bridges === 0
            ? 'aucune'
            : `${s.bridges} (+${((s.bridgeLength / s.strokeLength) * 100).toFixed(1)} %)`
        }
      />
      <Row label="Calcul" value={`${totalMs.toFixed(0)} ms`} />
    </div>
  )
}
