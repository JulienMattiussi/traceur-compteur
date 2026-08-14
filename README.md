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
un anneau autour d'un point signale les endroits où lever le crayon.
L'habitude du 1-2-3 est préservée.

Pour éviter de multiplier les levers de crayon, le moteur **relie les traits qui
s'arrêtent juste avant de se toucher** : une moustache qui frôle le contour, un
poil qui s'interrompt. Chaque liaison supprime une séquence, et comme la limite
est une distance, les objets réellement éloignés restent séparés tout seuls. Sur
le lapin endormi : **16 séquences au lieu de 39**, pour 7 % de trait ajouté.

Le curseur « liaisons ajoutées » permet d'arbitrer : à 0 mm on ne touche pas au
dessin mais il faut lever le crayon souvent ; au-delà de 12 mm on commence à
redessiner plutôt qu'à prolonger.

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
points et l'espacement, puis **télécharge le PDF**.

Le PDF est la sortie recommandée : une page A4 exacte, à l'échelle prévue, sans
l'en-tête ni la pagination que le navigateur ajoute à l'impression (une page web
ne peut pas les désactiver, c'est un réglage du dialogue d'impression). Le SVG
reste disponible pour retoucher le tracé dans un éditeur vectoriel.

Le bouton **« Image source »** superpose le dessin d'origine au puzzle, avec un
curseur d'opacité : pratique pour vérifier d'un coup d'oeil que les points
suivent bien les traits.

Le réglage qui marche : **environ 250 points par page A4, 2,5 mm d'espacement et
8 mm de liaisons**.

Les points peuvent être très proches sans que ce soit un problème : chaque numéro
est placé automatiquement à l'une des huit positions libres autour de sa
pastille, de sorte qu'aucun ne chevauche un autre. Le panneau de mesures affiche
« Numéros superposés », qui doit rester à zéro.

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
