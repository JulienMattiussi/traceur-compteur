# traceur-compteur

Générateur de **« relier les points »** 100 % front-end qui conserve le **tracé
intérieur** du dessin, et pas seulement son contour extérieur. Interface en
français. Partage la stack et les conventions de `mix-my-names` et `hidden-word`.

Le problème résolu : tous les générateurs existants (ohmydots, educol) appellent
l'équivalent d'un `findContours(RETR_EXTERNAL)` et ne renvoient qu'**une boucle
fermée par tache d'encre**, en jetant tout l'intérieur. Sur un coloriage de
lapin, ça représente **38 à 69 % de la longueur du dessin** : l'oeil, le museau,
les moustaches, l'intérieur des oreilles, les pattes.

Ce n'est pas de la négligence de leur part, c'est une contrainte de format. Un
contour extérieur est une boucle fermée simple, donc une séquence unique
`1 → N`. Dès qu'on garde l'intérieur, le dessin devient un **graphe avec des
embranchements**, et le théorème d'Euler interdit de le parcourir d'un seul
trait. Il faut donc **plusieurs séquences**, et le coeur du projet est de les
rendre minimales et lisibles.

---

## Stack technique

| Outil | Usage |
|---|---|
| React 19 + TypeScript | UI |
| Vite | Build / dev server (port **1234**) |
| Tailwind CSS v4 | Styles (via `@tailwindcss/vite`, pas de config JS) |
| Vitest + Testing Library | Tests unitaires et composants |
| Prettier | Formatage |
| ESLint (typescript-eslint) | Linting |
| Knip | Détection des fichiers / exports / dépendances inutilisés |
| ffmpeg | **Uniquement** pour le harnais de mesure (décodage JPEG vers PGM) |

Aucune dépendance de traitement d'image : ni OpenCV, ni WASM, ni modèle. Le
navigateur décode l'image via `canvas`, tout le reste est du TypeScript.

---

## Arborescence

```
src/
├── lib/                      # Logique pure, zéro React (entièrement testée)
│   ├── types.ts              # Mask, GraphNode, GraphEdge, Trail, Puzzle, stats
│   ├── binarize.ts           # Otsu + seuillage + despeckle + rgbaToGray
│   ├── thin.ts               # Squelettisation Zhang-Suen
│   ├── graph.ts              # Squelette -> graphe, et ses trois nettoyages
│   ├── trails.ts             # Décomposition eulérienne minimale (Hierholzer)
│   ├── simplify.ts           # RDP indexé, espacement, budget, écart exact
│   ├── quality.ts            # Ambiguïtés et encombrement (index spatial)
│   ├── baseline.ts           # Mesure ce qu'un contour extérieur perdrait
│   ├── pipeline.ts           # analyse() puis buildPuzzle()
│   ├── svg.ts                # Export SVG (puzzle, solution, ou les deux)
│   ├── settings.ts           # Réglages UI + conversion mm imprimés -> pixels
│   └── image.ts             # Décodage via canvas + téléchargement (touche au DOM)
├── components/
│   ├── Dropzone.tsx          # Dépôt de fichier (glisser ou parcourir)
│   ├── Controls.tsx          # Curseurs de réglage
│   ├── StatsPanel.tsx        # Mesures du dessin, du puzzle et de la qualité
│   └── PuzzlePreview.tsx     # Aperçu (injecte le SVG du moteur)
├── App.tsx                   # État, mémoïsation en deux étages, actions
├── main.tsx                  # Point d'entrée
└── index.css                 # Import Tailwind + styles d'impression
tools/                        # Harnais de mesure, tourne sous Node (pas livré)
├── pgm.ts                    # Lecture PGM binaire (P5)
├── raster.ts                 # Rasteriseur minimal + écriture PNG via ffmpeg
├── bench.ts                  # Mesure et rend les 3 images de référence
└── fixtures/                 # Images de test (hors git, voir plus bas)
tests/
├── fixtures.ts               # Dessins synthétiques (trait, rectangle, cercle)
├── unit/                     # Vitest sur src/lib
└── component/                # Vitest + Testing Library sur App
```

---

## Le pipeline, étape par étape

```
image
  └─1─ binarize    seuil d'Otsu, puis despeckle       -> masque binaire
  └─2─ thin        Zhang-Suen                          -> traits de 1 px
  └─3─ buildGraph  sommets = extrémités et jonctions   -> graphe
  └─4─ trails      décomposition eulérienne minimale   -> K séquences
  └─5─ placeDots   RDP + espacement + budget           -> points numérotés
  └─6─ quality     ambiguïtés et encombrement          -> mesures
  └─7─ svg         export imprimable
```

### 3. Le graphe, et pourquoi il a besoin de trois nettoyages

C'est l'étape absente des autres outils. Les pixels de degré 2 sont au milieu
d'un trait ; tout le reste (extrémité, jonction) devient un sommet, les
pixels-sommets voisins étant fusionnés en un seul amas.

La discrétisation pollue ce graphe : un simple cercle numérique produit **40
pixels à trois voisins** rien qu'à cause de l'escalier des diagonales. D'où :

- **`pruneSpurs`** retire les barbules borgnes plus courtes qu'un seuil (réglable).
- **`dropDegenerateLoops`** retire les micro-boucles refermées sur un sommet, que
  chaque virage à 45 degrés fabrique.
- **`dissolveDegreeTwoNodes`** recolle deux traits séparés par un sommet qui n'est
  ni une extrémité ni une jonction. Opération **exacte** : les chaînes de pixels
  se touchent déjà.

Effet mesuré : un cercle passe de 16 traits à **1**, et le lapin endormi de 396
traits à **171**.

### 4. Le nombre de séquences est optimal, et c'est démontrable

Pour chaque composante connexe, le minimum vaut exactement
`max(1, impairs / 2)`, où `impairs` compte les sommets de degré impair. On
l'atteint en appariant les sommets impairs par des arêtes virtuelles (au plus
proche, pour que le crayon ne traverse pas la page), en cherchant un circuit
eulérien par Hierholzer, puis en coupant sur les arêtes virtuelles. Le circuit
est d'abord **tourné** pour démarrer sur une coupure, sinon le premier et le
dernier fragment appartiendraient au même parcours.

`minimumTrailCount()` expose la borne, affichée dans l'UI à côté du résultat.

### 5. Le budget de points est une cible, pas un plafond

L'utilisateur demande « environ 400 points » et le moteur cherche par dichotomie
la plus petite tolérance qui tienne dedans, en montant **ou en descendant**.
Plancher à 0,6 px : en dessous on ne suivrait plus que le bruit de compression.

`simplifyIndices` renvoie des **indices** et non des points. C'est ce qui permet
à `deviationByIndices` de mesurer l'écart **exactement** : chaque pixel d'origine
se rattache sans ambiguïté au segment qui l'encadre. Une recherche du segment le
plus proche donnait n'importe quoi sur un parcours repassant près de lui-même
(un écart de 154 px mesuré au lieu de 4).

---

## Ce que valent les résultats (mesuré sur 3 coloriages)

| | lapin-dodo | lapins2 | trois-lapins |
|---|---|---|---|
| Traits extraits | 171 | 292 | 431 |
| Jonctions | 81 | 121 | 174 |
| Tracé intérieur | 69 % | 55 % | 38 % |
| Sortie d'un contour seul | 19 boucles | 10 boucles | 33 boucles |
| Séquences (mini théorique) | 39 (67) | 50 (57) | 68 (108) |
| Temps total | ~200 ms | ~190 ms | ~240 ms |

**Le bon réglage** : environ **250 points par page A4 à 4 mm d'espacement**. Le
vérifier à l'oeil est indispensable, les chiffres seuls trompent : à 500 points
la solution est superbe mais les **numéros se chevauchent** et le puzzle est
injouable.

### Limites connues

- **Encombrement local** : deux traits distincts qui passent à 2 mm l'un de
  l'autre (le double trait d'une oreille) portent forcément des pastilles
  proches. Aucun espacement ne le corrige, il faut moins de détail ou une page
  plus grande. Suivi par `stats.crowdedPairs`.
- **L'espacement aux virages** descend à `0,6 × minSpacing` pour préserver la
  forme, donc l'espacement minimal réel est inférieur au réglage.
- **La contrainte d'espacement l'emporte sur la fidélité** : écarter deux
  pastilles retire un point que la tolérance aurait gardé. `stats.maxDeviation`
  peut donc dépasser la tolérance demandée.
- **Filigranes** : un logo de site consomme des dizaines de points. Recadrer
  l'image avant. `minBlobArea` ne suffit pas, ces blocs sont trop gros.
- **Photos** : non géré. Il faudrait un extracteur de traits appris (PiDiNet ou
  Informative Drawings, ~5 Mo en ONNX via onnxruntime-web). Le reste du pipeline
  n'a pas besoin de changer.

---

## Contraintes techniques

- **100 % front-end** : aucun appel serveur, l'image ne quitte pas le poste.
- **Pas de SSR** : Vite SPA. Ne pas introduire Next.js ou Remix.
- **Alias `@/`** pointe vers `src/`. Toujours l'utiliser pour les imports
  internes, jamais de chemins relatifs `../../`.
- **Tailwind v4** : `@import 'tailwindcss'` dans le CSS, pas de
  `tailwind.config.js`.
- **TypeScript strict** : `noUnusedLocals`, `noUnusedParameters`,
  `noUncheckedIndexedAccess`, `erasableSyntaxOnly` activés. Ne pas les
  désactiver. Conséquences à connaître : indexer un tableau donne
  `T | undefined` (d'où les `!` dans les boucles chaudes), et les propriétés de
  paramètre de constructeur sont interdites.

---

## Règles de développement

### Structure
- `src/lib/` : logique pure, zéro import React. Seul `image.ts` touche au DOM.
- `src/components/` : un composant par fichier.
- **Taille des fichiers** : viser < ~300 lignes ; au-delà, découper.

### Qualité du code
- **Factoriser, ne pas dupliquer** : le SVG a **une** implémentation, partagée
  entre l'aperçu et l'export.
- **Pas de code mort** : tout export doit être utilisé ou testé. `make knip`
  doit rester vert.
- **Commentaires utiles seulement** : expliquer le pourquoi / le non-évident ;
  ne jamais paraphraser le code.
- **Rien ne disparaît en silence** : quand le moteur écarte des traits, il les
  compte (`droppedTrails`, `droppedLength`) et l'UI l'affiche.

### Tests
- **Logique pure entièrement testée** (`src/lib/`), sur des dessins synthétiques
  (`tests/fixtures.ts`) plutôt que sur des images : c'est déterministe et sans
  fichier binaire dans git.
- Les invariants qui comptent : la topologie survit à la squelettisation, chaque
  arête est parcourue **exactement une fois**, les parcours sont géométriquement
  continus, la numérotation est sans trou ni doublon, la simplification respecte
  sa tolérance.

### Vérification visuelle
Les chiffres ne suffisent pas, il faut regarder. `make bench` écrit dans `out/`
le squelette, la solution en couleurs par séquence, les pastilles nues et le SVG
imprimable. Pour contrôler le rendu réel du SVG exporté :

```sh
google-chrome --headless=new --no-sandbox --screenshot=/tmp/v.png \
  --window-size=760,1070 "file://$PWD/out/lapin-dodo-250-puzzle.svg"
```

### Images de test
`tools/fixtures/*.jpg` est **hors git** (coloriages tiers, non redistribuables).
Déposer ses propres dessins au trait puis `make fixtures` (décodage via ffmpeg)
avant `make bench`.

---

## Commandes

Tout passe par le Makefile.

| Commande | Effet |
|---|---|
| `make install` | Installe les dépendances |
| `make start` | Serveur de développement sur http://localhost:1234 |
| `make build` | Build de production |
| `make check` | **build + lint + typecheck + knip + tests** |
| `make test` | Tests unitaires et composants |
| `make fix` | Formate puis lint |
| `make fixtures` | Décode `tools/fixtures/*.jpg` en PGM (ffmpeg requis) |
| `make bench` | Mesure les images de référence et écrit `out/` |
