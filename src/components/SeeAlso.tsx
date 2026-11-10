/**
 * "Voir aussi" links to yavadeus' sibling print tools. The same list lives in
 * final-code, hide-words, traceur-compteur and traceur-texteur: keep them in sync.
 */
const TOOLS = [
  {
    id: 'final-code',
    name: 'final-code',
    tagline: 'Une grille de mots à imprimer',
    url: 'https://final-code-grid.yavadeus.dev/',
  },
  {
    id: 'hide-words',
    name: 'hide-words',
    tagline: 'Des codes cachés dans une grille de lettres',
    url: 'https://hide-words.yavadeus.dev/',
  },
  {
    id: 'traceur-compteur',
    name: 'Traceur-compteur',
    tagline: 'Relier les points avec le tracé intérieur',
    url: 'https://traceur-compteur.yavadeus.dev/',
  },
  {
    id: 'traceur-texteur',
    name: 'Traceur-texteur',
    tagline: "Écrire un message le long d'un tracé",
    url: 'https://traceur-texteur.yavadeus.dev/',
  },
] as const

type ToolId = (typeof TOOLS)[number]['id']

export function SeeAlso({ current }: { current: ToolId }) {
  return (
    <nav aria-labelledby="see-also-title" className="mt-10 print:hidden">
      <h2
        id="see-also-title"
        className="mb-3 text-center text-sm font-semibold tracking-wide text-slate-500 uppercase"
      >
        Voir aussi
      </h2>
      <ul className="grid gap-3 sm:grid-cols-3">
        {TOOLS.filter((tool) => tool.id !== current).map((tool) => (
          <li key={tool.id}>
            <a
              href={tool.url}
              // Named target: each tool opens in its own tab, reused on later clicks.
              // No rel=noopener, which would stop the browser from reusing it.
              target={tool.id}
              className="block h-full rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-sky-400"
            >
              <span className="block font-medium text-slate-900">{tool.name}</span>
              <span className="block text-sm text-slate-500">{tool.tagline}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
