import { PAGE_WIDTH_MM } from '@/lib/settings'
import type { Puzzle } from '@/lib/types'

interface StatsPanelProps {
  puzzle: Puzzle
}

interface RowProps {
  label: string
  value: string
  hint?: string
}

function Row({ label, value, hint }: RowProps) {
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

export function StatsPanel({ puzzle }: StatsPanelProps) {
  const s = puzzle.stats
  // Sur la page imprimée, c'est la seule échelle où « lisible » veut dire
  // quelque chose.
  const mmPerPixel = PAGE_WIDTH_MM / puzzle.width
  const interiorShare = s.strokeLength > 0 ? (s.interiorLength / s.strokeLength) * 100 : 0
  const totalMs = Object.values(s.timings).reduce((total, value) => total + value, 0)

  return (
    <div className="text-sm">
      <h2 className="mb-2 font-semibold text-slate-900">Ce que contient le dessin</h2>
      <Row label="Traits détectés" value={`${s.edges}`} />
      <Row label="Jonctions" hint="un contour extérieur seul en a 0" value={`${s.junctions}`} />
      <Row
        label="Tracé intérieur"
        hint="invisible pour les générateurs classiques"
        value={`${interiorShare.toFixed(0)} % de la longueur`}
      />
      <Row
        label="Sortie d'un contour seul"
        value={`${s.contourLoops} boucle${s.contourLoops > 1 ? 's' : ''}`}
      />

      <h2 className="mb-2 mt-5 font-semibold text-slate-900">Le puzzle</h2>
      <Row label="Points" value={`${s.dots}`} />
      <Row
        label="Séquences"
        hint={`minimum théorique ${s.minSequences}`}
        value={`${s.sequences}`}
      />
      <Row
        label="Liaisons ajoutées"
        hint="traits absents de l'image d'origine"
        value={
          s.bridges === 0
            ? 'aucune'
            : `${s.bridges} (+${((s.bridgeLength / s.strokeLength) * 100).toFixed(1)} % de trait)`
        }
      />
      <Row
        label="Fidélité"
        hint="écart maximal au dessin"
        value={`${(s.maxDeviation * mmPerPixel).toFixed(2)} mm en A4`}
      />
      <Row
        label="Espacement minimal"
        value={`${(s.minSpacing * mmPerPixel).toFixed(2)} mm en A4`}
      />

      <h2 className="mb-2 mt-5 font-semibold text-slate-900">Qualité</h2>
      <Row
        label="Numéros superposés"
        hint="doit rester à zéro"
        value={`${s.labelCollisions}`}
      />
      <Row
        label="Points retirés"
        hint="numéro impossible à caser"
        value={s.removedForLabels === 0 ? 'aucun' : `${s.removedForLabels}`}
      />
      <Row
        label="Pastilles serrées"
        hint="sans gêne : les numéros sont décalés"
        value={`${s.crowdedPairs}`}
      />
      <Row
        label="Points ambigus"
        hint="un voisin plus proche que le suivant"
        value={`${s.ambiguities.length}`}
      />
      <Row
        label="Traits écartés"
        hint="trop courts pour deux points"
        value={
          s.droppedTrails === 0
            ? 'aucun'
            : `${s.droppedTrails} (${((s.droppedLength / s.strokeLength) * 100).toFixed(1)} %)`
        }
      />
      <Row label="Calcul" value={`${totalMs.toFixed(0)} ms`} />
    </div>
  )
}
