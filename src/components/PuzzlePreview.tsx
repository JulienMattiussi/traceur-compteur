import { useMemo } from 'react'
import { renderSvg } from '@/lib/svg'
import type { Puzzle } from '@/lib/types'

export type ViewMode = 'puzzle' | 'solution' | 'both'

interface PuzzlePreviewProps {
  puzzle: Puzzle
  mode: ViewMode
}

export function PuzzlePreview({ puzzle, mode }: PuzzlePreviewProps) {
  const svg = useMemo(
    () =>
      renderSvg(puzzle, {
        solutionOnly: mode === 'solution',
        showSolution: mode === 'both',
        colorBySequence: mode !== 'puzzle',
      }),
    [puzzle, mode],
  )

  return (
    <div
      className="[&>svg]:h-auto [&>svg]:w-full"
      // Le SVG vient de notre propre moteur : que des nombres et des couleurs
      // codées en dur, aucune donnée utilisateur réinjectée. On garde une seule
      // implémentation de rendu, partagée avec l'export.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
