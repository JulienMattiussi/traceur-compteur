/**
 * Marque du projet : quatre points reliés par un trait pointillé, le premier
 * cerclé. C'est le vocabulaire visuel du puzzle lui-même, où l'anneau signale
 * l'endroit où l'on pose le crayon.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 36" className={className} aria-hidden="true">
      <polyline
        points="6,28 18,10 30,21 42,7"
        fill="none"
        stroke="#38bdf8"
        strokeWidth="2"
        strokeDasharray="3 4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="28" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      {[
        [6, 28],
        [18, 10],
        [30, 21],
        [42, 7],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3.1" fill="currentColor" />
      ))}
    </svg>
  )
}

/**
 * Remplace le trait d'union du titre par une liaison pointillée entre deux
 * points. Le titre garde son nom accessible complet via `aria-label` sur le
 * `h1` qui l'entoure.
 */
export function TitleLink() {
  return (
    <svg viewBox="0 0 24 10" className="h-2.5 w-6 shrink-0" aria-hidden="true">
      <line
        x1="4"
        y1="5"
        x2="20"
        y2="5"
        stroke="#38bdf8"
        strokeWidth="2"
        strokeDasharray="2 3"
        strokeLinecap="round"
      />
      <circle cx="3" cy="5" r="2.4" fill="currentColor" />
      <circle cx="21" cy="5" r="2.4" fill="currentColor" />
    </svg>
  )
}
