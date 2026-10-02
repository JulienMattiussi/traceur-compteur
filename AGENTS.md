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
├── lib/                      # Logique pure : aucun React, aucun DOM
│   ├── types.ts              # Feuille de l'arbre de dépendances : aucun import
│   ├── page.ts               # Géométrie de la page A4 (mm imprimés -> pixels)
│   ├── settings.ts           # Réglages exposés à l'interface
│   ├── binarize.ts           # Otsu + seuillage + despeckle + rgbaToGray
│   ├── thin.ts               # Squelettisation Zhang-Suen
│   ├── graph.ts              # Squelette -> graphe (sommets, arêtes, chaînes)
│   ├── graph-cleanup.ts      # Barbules, micro-boucles, faux sommets de degré 2
│   ├── bridge.ts             # Ponts entre sommets impairs : levier des séquences
│   ├── euler.ts              # Circuit de Hierholzer et coupure aux arêtes virtuelles
│   ├── trails.ts             # Décomposition en séquences minimales et leur ordre
│   ├── simplify.ts           # Géométrie pure : distance, RDP, écart exact
│   ├── dots.ts               # Placement des pastilles : budget, espacement, plancher
│   ├── labels.ts             # Placement des numéros sans chevauchement
│   ├── quality.ts            # Ambiguïtés et encombrement (index spatial)
│   ├── interior.ts           # Mesure ce qu'un contour extérieur perdrait
│   ├── pipeline.ts           # analyse() puis buildPuzzle()
│   ├── svg.ts                # Export SVG (puzzle, solution, fond transparent)
│   └── pdf.ts                # Export PDF A4 écrit à la main, sans dépendance
├── platform/
│   └── image.ts              # Frontière navigateur : décodage canvas, téléchargement
├── components/
│   ├── Logo.tsx              # Marque : points reliés en pointillé, premier cerclé
│   ├── Dropzone.tsx          # Dépôt de fichier (glisser ou parcourir)
│   ├── Controls.tsx          # Curseurs de réglage
│   ├── Toolbar.tsx           # Deux groupes : Affichage et Exporter
│   ├── StatsPanel.tsx        # Tuiles + mesures du dessin et de la qualité
│   └── PuzzlePreview.tsx     # Aperçu, avec l'image source en surimpression
├── App.tsx                   # État, mémoïsation en deux étages, actions
├── main.tsx                  # Point d'entrée
└── index.css                 # Import Tailwind, trame de fond, styles d'impression
tools/                        # Harnais de mesure, tourne sous Node (pas livré)
├── pgm.ts                    # Lecture PGM binaire (P5)
├── raster.ts                 # Rasteriseur minimal + écriture PNG via ffmpeg
├── bench.ts                  # Mesure et rend les images de référence
├── print-preview.ts          # Page de contrôle de la mise en page d'impression
└── fixtures/                 # Images de test (hors git, voir plus bas)
tests/
├── fixtures.ts               # Dessins synthétiques (trait, rectangle, cercle)
├── unit/                     # Vitest sur src/lib et src/platform
└── component/                # Vitest + Testing Library sur App
```

### Règles d'architecture

- **`src/lib` ne connaît ni React ni le DOM.** Tout ce qui dépend du navigateur
  vit dans `src/platform`. C'est ce qui permet de tester le moteur entier sans
  navigateur, et de le faire tourner tel quel sous Node dans `tools/`.
- **`types.ts` est une feuille** : il n'importe rien. Les types d'étiquettes y
  vivent aussi, sinon `types.ts` et `labels.ts` s'importaient mutuellement.
- **`page.ts` est la seule source des tailles.** Le placement des étiquettes et
  leur rendu en dérivent tous les deux ; les séparer les aurait fait diverger.
- **Viser moins de 300 lignes par fichier.** `graph.ts` et `simplify.ts` avaient
  dépassé, d'où les découpes en `graph-cleanup.ts`, `dots.ts` et `euler.ts`.

---

## Le pipeline, étape par étape

```
image
  └─1─ binarize    seuil d'Otsu, puis despeckle       -> masque binaire
  └─2─ thin        Zhang-Suen                          -> traits de 1 px
  └─3─ buildGraph  sommets = extrémités et jonctions   -> graphe
  └─4─ bridge      ponts courts entre sommets impairs   -> graphe plus pair
  └─5─ trails      décomposition eulérienne minimale    -> K séquences
  └─6─ placeDots   RDP + espacement + budget + 3 points -> points numérotés
  └─7─ labels      chaque numéro à une place libre       -> étiquettes posées
  └─8─ quality     ambiguïtés et encombrement            -> mesures
  └─9─ svg         export imprimable
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

### 4. Les ponts, seul vrai levier sur le nombre de séquences

Un sommet de degré impair **force** une fin de séquence : sur un T, un parcours
traverse la jonction en empruntant deux des trois traits, jamais les trois. Le
lapin endormi en compte 134 (60 vraies extrémités de traits, 74 jonctions
impaires), d'où 67 séquences au mieux.

Ébarber davantage ne sert presque à rien (mesuré : 61 séquences à 0 px
d'ébarbage, 51 à 32 px). La seule façon d'en avoir moins est de **rendre ces
sommets pairs**, donc d'ajouter des liaisons : un pont entre deux sommets impairs
les rend tous deux pairs et supprime une séquence. S'ils appartenaient à deux
composantes distinctes, il en supprime deux.

`bridgeOddVertices` apparie les sommets impairs **du plus proche au plus loin**,
chaque sommet ne servant qu'une fois, sous une distance maximale exprimée en
millimètres imprimés. Cette limite fait tout le travail : elle garde les ajouts
courts, donc invisibles, et laisse **naturellement séparés les objets réellement
éloignés** (sur la scène à trois lapins, aucun pont n'apparaît entre les lapins,
la carotte et le buisson).

Effet mesuré à 8 mm sur le lapin endormi : **39 séquences ramenées à 16**, pour
47 ponts ajoutant 7 % de longueur de trait. Vérifié à l'oeil : les ponts ne font
que refermer les écarts là où une moustache ou un poil s'arrête juste avant le
contour. Ils prolongent le dessin dans sa logique plutôt que de l'inventer.

`make bench` écrit `*-ponts-vus-*.png`, le dessin en gris et **les ponts en
rouge**. C'est le seul moyen honnête de juger un réglage de pontage.

### 5. Le nombre de séquences est optimal, et c'est démontrable

Pour chaque composante connexe, le minimum vaut exactement
`max(1, impairs / 2)`, où `impairs` compte les sommets de degré impair. On
l'atteint en appariant les sommets impairs par des arêtes virtuelles (au plus
proche, pour que le crayon ne traverse pas la page), en cherchant un circuit
eulérien par Hierholzer, puis en coupant sur les arêtes virtuelles. Le circuit
est d'abord **tourné** pour démarrer sur une coupure, sinon le premier et le
dernier fragment appartiendraient au même parcours.

`minimumTrailCount()` expose la borne, affichée dans l'UI à côté du résultat.

### 6. Ce qui doit être lisible, c'est le numéro, pas la pastille

Deux points peuvent être très proches, c'est même utile pour suivre une courbe
serrée. Ce qui rend un puzzle injouable, c'est deux **numéros** superposés. Le
critère porte donc sur les rectangles de texte, pas sur la distance entre points.

`placeLabels` essaie huit positions autour de chaque pastille (haut-droite
d'abord, le placement classique) et retient la première qui ne recouvre ni une
autre étiquette, ni une pastille voisine, **et qui tient dans la page** : un
numéro qui dépasse du cadre est purement et simplement coupé à l'impression, donc
un point collé au bord droit voit son numéro passer à sa gauche. Si vraiment
aucune position ne convient, l'étiquette est au moins ramenée dans la page. Déplacer un numéro coûte infiniment
moins cher que de supprimer un point. Ce n'est qu'en dernier recours, si les huit
positions sont prises, que `dropUnplaceable` retire le point ; comme cela
renumérote tout et change la largeur des étiquettes, le placement est repris
(trois tentatives au plus).

Les chiffres n'ont pas besoin d'être mesurés : en Helvetica ils ont tous la même
avance, 0,556 em. `metricsForWidth` est la **seule** source des tailles, partagée
par le placement et par le rendu, sinon les étiquettes seraient calculées à une
taille et dessinées à une autre.

Résultat : **zéro numéro superposé** sur les trois images de référence. Et comme
la contrainte a changé de nature, les points peuvent se resserrer : l'espacement
par défaut passe de 4 à 2,5 mm, ce qui améliore la fidélité de 2,31 à 1,29 mm.

Un piège corrigé au passage : sur une **petite boucle**, la simplification ne
retient que les deux extrémités, qui sont le *même* point du tracé. Y insérer le
milieu fabriquait trois pastilles dont deux exactement confondues. Les trois
points sont donc répartis sur le tour (`promoteToThreeDots`).

### 7. Le budget de points est une cible, pas un plafond

L'utilisateur demande « environ 400 points » et le moteur cherche par dichotomie
la plus petite tolérance qui tienne dedans, en montant **ou en descendant**.
Plancher à 0,6 px : en dessous on ne suivrait plus que le bruit de compression.

**Jamais de séquence de deux points.** Un segment isolé coûte un lever de crayon
et deux numéros pour presque rien. Mais une séquence de deux points peut être une
**longue** moustache droite simplifiée en un seul segment : la jeter perdrait un
trait bien visible. `promoteToThreeDots` lui insère donc son point milieu, et ne
l'écarte que si elle est trop courte pour le porter. Coût mesuré : 2,3 % de trait
perdu au lieu de 1,8 %.

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
| Séquences sans pont | 39 | 50 | 69 |
| **Séquences avec ponts à 8 mm** | **16** | **26** | **29** |
| Longueur ajoutée par les ponts | 7 % | 4 % | 9 % |
| Temps total | ~220 ms | ~145 ms | ~235 ms |

**Le bon réglage** : environ **250 points par page A4 à 4 mm d'espacement**. Le
vérifier à l'oeil est indispensable, les chiffres seuls trompent : à 500 points
la solution est superbe mais les **numéros se chevauchent** et le puzzle est
injouable.

### Limites connues

- **Les ponts ajoutent des traits absents de l'image.** C'est assumé et mesuré
  (`stats.bridges`, `stats.bridgeLength`), mais au-delà de ~12 mm ils cessent de
  prolonger le dessin pour commencer à le redessiner. L'appariement ne tient
  compte que de la distance : il ne cherche pas à continuer la direction du trait
  ni à éviter de traverser du blanc. C'est la première amélioration à faire.

- **Le budget de points est compté avant** le retrait des numéros incasables : on
  finit donc parfois sous la cible (219 points pour 250 demandés). Le curseur reste
  un ordre de grandeur.
- **`stats.crowdedPairs`** compte encore les pastilles rapprochées, mais ce n'est
  plus un défaut : les numéros sont décalés. La mesure qui compte est
  `labelCollisions`, qui doit rester à zéro.
- **L'espacement aux virages** descend à `0,6 × minSpacing` pour préserver la
  forme, donc l'espacement minimal réel est inférieur au réglage.
- **La contrainte d'espacement l'emporte sur la fidélité** : écarter deux
  pastilles retire un point que la tolérance aurait gardé. `stats.maxDeviation`
  peut donc dépasser la tolérance demandée.
- **Filigranes** : un logo de site consomme des dizaines de points. Recadrer
  l'image avant. `minBlobArea` ne suffit pas, ces blocs sont trop gros.
- **Photos** : hors périmètre, par choix. Un essai sans modèle (XDoG) extrayait
  bien des traits, mais sans savoir isoler le sujet : le fond et le texte
  produisaient des puzzles illisibles. L'outil vise les dessins au trait, où il
  donne de bons résultats ; ne pas relancer cette piste.

---

## Parti pris d'interface

- **La barre est en deux groupes étiquetés** : *Affichage* (vue du tracé,
  surimpression) et *Exporter* (PDF, SVG, impression). Mélangés, il fallait relire
  toute la barre pour trouver le bouton de sortie.
- **La marque** reprend le vocabulaire du puzzle : des points reliés en pointillé,
  le premier cerclé comme un début de séquence. Le trait d'union du titre est
  lui-même une liaison pointillée ; le `h1` porte un `aria-label` pour que le nom
  accessible reste `Traceur-compteur`.
- **Le fond est une trame de points**, qui est le sujet même de l'application. Les
  cartes sont opaques, donc rien ne gêne la lecture. Elle disparaît à l'impression.
- **Les tuiles de mesures** utilisent des chiffres **proportionnels** : à cette
  taille, `tabular-nums` donne à chaque chiffre la largeur d'un zéro et le nombre
  paraît distendu. Le tabulaire est réservé aux colonnes qui s'alignent.
- **Le voyant d'état** (numéros superposés) ne s'appuie jamais sur la couleur
  seule : toujours un symbole et un libellé, avec un texte assez sombre pour rester
  lisible sur fond clair.
- **Les réglages d'extraction sont repliés** dans un `<details>` : utiles, mais
  rarement touchés.

### Voir l'interface pour de vrai
Les tests de composant couvrent la structure, pas l'aspect. Pour regarder :
piloter Chrome par CDP (`--remote-debugging-port`), pousser un fichier dans
l'`input` via `DataTransfer`, puis `Page.captureScreenshot`. C'est le seul moyen
de traverser le même chemin que l'utilisateur, décodage canvas compris.

## Métadonnées de partage

Les robots des réseaux sociaux ne lisent que du HTML statique : ils n'exécutent
aucun script, et `og:image` n'accepte pas d'URL relative. Le domaine doit donc
être écrit en dur au moment du build, d'où **`VITE_SITE_URL` dans `.env`**, que
Vite substitue dans `index.html`. Ce fichier est versionné : il ne contient
qu'une URL publique.

**Changer d'hébergeur veut dire changer cette ligne**, sinon l'aperçu affiche un
titre et une description corrects avec une image cassée, ce qui est exactement le
symptôme qu'on obtient quand l'URL pointe ailleurs.

L'image elle-même (`public/og.png`, 1200x630) est produite par `make og` : ce
n'est pas une maquette mais un vrai puzzle calculé par le moteur sur un dessin
tracé dans `tools/og.ts`. Vérifier après déploiement :

```sh
curl -sI https://<le-site>/og.png | head -2      # doit répondre 200 image/png
curl -s https://<le-site>/ | grep 'og:image'     # doit pointer sur ce même hôte
```

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
Les chiffres ne suffisent pas, il faut regarder. Dans l'application, le bouton
**« Image source »** superpose le dessin d'origine au puzzle, avec un curseur
d'opacité : c'est le contrôle le plus direct, chaque pastille doit tomber sur
l'axe d'un trait. Le SVG est alors rendu avec `transparent: true` ; l'export
garde toujours son fond blanc. `make bench` écrit dans `out/`
le squelette, la solution en couleurs par séquence, les pastilles nues et le SVG
imprimable. Pour contrôler le rendu réel du SVG exporté :

```sh
google-chrome --headless=new --no-sandbox --screenshot=/tmp/v.png \
  --window-size=760,1070 "file://$PWD/out/lapin-dodo-250-puzzle.svg"
```

### Export PDF, la seule sortie maîtrisée
Une page web **ne peut pas** empêcher le navigateur d'ajouter ses en-têtes, sa
pagination et son échelle à l'impression : c'est un réglage du dialogue, hors de
portée du document. D'où `pdf.ts`, qui écrit un PDF A4 directement, sans aucune
bibliothèque : cercles en courbes de Bézier, texte en Helvetica (l'une des
quatorze polices que tout lecteur possède, donc rien à embarquer), marges de
10 mm cohérentes avec `PAGE_WIDTH_MM`.

Les décalages de la table `xref` sont des positions d'octets **exactes**, ce que
les tests vérifient en relisant le fichier produit. Tout étant en ASCII, un
caractère vaut un octet, ce qui évite d'avoir à encoder.

Pour contrôler le résultat :

```sh
make bench
pdfinfo out/lapin-dodo-250-puzzle.pdf      # 1 page, A4
pdftoppm -r 150 -png out/lapin-dodo-250-puzzle.pdf /tmp/page
```

### Mise en page d'impression
Le puzzle doit tenir sur **une seule page**. Un dessin au format A4 dépassait de
quelques millimètres et le navigateur ajoutait une seconde page vide, d'où la
borne `max-height: 88vh` sur le SVG dans `index.css` (la marge couvre les
en-têtes que le navigateur ajoute lui-même, hors de notre contrôle). Pour le
vérifier :

```sh
make print-preview
google-chrome --headless=new --no-sandbox --print-to-pdf-header-footer \
  --print-to-pdf=/tmp/p.pdf "file:///tmp/print.html"
pdfinfo /tmp/p.pdf | grep Pages     # doit afficher 1
```

La surimpression de l'image source est masquée à l'impression : le SVG y est mis
à l'échelle, l'image ne suivrait plus.

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
