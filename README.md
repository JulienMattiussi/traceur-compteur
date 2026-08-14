# traceur-compteur

Transforme un dessin au trait en **« relier les points »**, en gardant le tracé
intérieur du dessin et pas seulement sa silhouette.

Tout se calcule dans le navigateur : ton image ne part sur aucun serveur.

## Le problème

Les générateurs de relier-les-points existants ne renvoient que le **contour
extérieur**. Sur un coloriage de lapin, ça veut dire perdre l'oeil, le museau,
les moustaches, l'intérieur des oreilles et les pattes : mesuré ici, **38 à 69 %
de la longueur du dessin**.

Ce n'est pas un oubli, c'est une contrainte de format. Un contour extérieur est
une boucle fermée, donc une seule séquence `1 → N`. En gardant l'intérieur, le
dessin devient un graphe avec des embranchements, et le théorème d'Euler
interdit de le parcourir d'un seul trait.

## La réponse

Plusieurs séquences numérotées, en **nombre minimal démontré** (la borne
d'Euler, affichée à côté du résultat). La numérotation reste continue de 1 à N ;
un anneau autour d'un point signale les rares endroits où lever le crayon.
L'habitude du 1-2-3 est préservée.

## Comment ça marche

```
image -> seuil d'Otsu -> squelettisation -> graphe -> parcours eulériens
      -> placement des points -> SVG imprimable
```

Le détail de chaque étape, les mesures et les limites connues sont dans
[AGENTS.md](AGENTS.md).

## Démarrer

```sh
make install
make start      # http://localhost:1234
```

Dépose un dessin au trait (coloriage, illustration, logo), règle le nombre de
points et l'espacement, puis télécharge le SVG ou imprime.

Le réglage qui marche : **environ 250 points par page A4 à 4 mm d'espacement**.
Au-delà, la solution reste belle mais les numéros se chevauchent.

## Bien choisir son image

- **Idéal** : dessin au trait noir sur fond blanc (coloriage, encrage, logo).
- **Recadrer les filigranes** : un logo de site consomme des dizaines de points.
- **Photos** : pas encore géré, ça demanderait un extracteur de traits appris.

## Développer

```sh
make check      # build + lint + typecheck + knip + tests
make bench      # mesure les images de référence et écrit out/
make help       # toutes les commandes
```

## Licence

MIT
