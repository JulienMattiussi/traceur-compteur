import { useMemo } from 'react'
import { renderSvg } from '@/lib/svg'
import type { Puzzle } from '@/lib/types'

export type ViewMode = 'puzzle' | 'solution' | 'both'

interface PuzzlePreviewProps {
  puzzle: Puzzle
  mode: ViewMode
  /** Image source à afficher dessous, ou null pour ne rien superposer. */
  overlayUrl: string | null
  /** Opacité de l'image source, de 0 à 100. */
  overlayOpacity: number
}

export function PuzzlePreview({ puzzle, mode, overlayUrl, overlayOpacity }: PuzzlePreviewProps) {
  const svg = useMemo(
    () =>
      renderSvg(puzzle, {
        solutionOnly: mode === 'solution',
        showSolution: mode === 'both',
        colorBySequence: mode !== 'puzzle',
        // Sans fond blanc, le puzzle laisse voir l'image placée dessous.
        transparent: overlayUrl !== null,
      }),
    [puzzle, mode, overlayUrl],
  )

  return (
    <div className="relative">
      {overlayUrl ? (
        <img
          src={overlayUrl}
          alt="Image source en surimpression"
          // L'image et le SVG partagent le même rapport de forme, donc les caler
          // tous les deux sur la largeur suffit à les superposer exactement.
          // Masquée à l'impression : le SVG y est redimensionné pour tenir sur la
          // page, l'image ne suivrait plus.
          className="absolute inset-0 h-full w-full object-fill print:hidden"
          style={{ opacity: overlayOpacity / 100 }}
        />
      ) : null}
      <div
        className="relative [&>svg]:h-auto [&>svg]:w-full"
        // Le SVG vient de notre propre moteur : que des nombres et des couleurs
        // codées en dur, aucune donnée utilisateur réinjectée. On garde une seule
        // implémentation de rendu, partagée avec l'export.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}
