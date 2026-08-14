import type { PlacedLabel } from '@/lib/labels'

/** Types partagés par tout le pipeline. Aucune dépendance, aucun DOM. */

export interface Point {
  x: number
  y: number
}

/** Image binaire : 1 = encre (un trait du dessin), 0 = fond. */
export interface Mask {
  width: number
  height: number
  data: Uint8Array
}

/**
 * Un sommet du graphe : soit une extrémité de trait (degré 1), soit une
 * jonction où plusieurs traits se rencontrent (degré >= 3).
 */
export interface GraphNode {
  id: number
  x: number
  y: number
  /** Nombre d'extrémités d'arêtes attachées (une boucle sur soi compte 2). */
  degree: number
}

/** Un trait continu entre deux sommets, échantillonné pixel par pixel. */
export interface GraphEdge {
  id: number
  /** Sommet de départ. */
  a: number
  /** Sommet d'arrivée (égal à `a` pour une boucle fermée). */
  b: number
  /** Suite de pixels de `a` vers `b`, extrémités incluses. */
  points: Point[]
  /** Longueur cumulée en pixels. */
  length: number
  /**
   * Vrai pour une liaison ajoutée par le moteur, absente du dessin d'origine,
   * destinée à réduire le nombre de séquences.
   */
  bridge?: boolean
}

export interface SkeletonGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/**
 * Un parcours : une suite d'arêtes empruntées bout à bout, chacune une seule
 * fois. C'est ce qui devient une séquence numérotée dans le puzzle.
 */
export interface Trail {
  edgeIds: number[]
  points: Point[]
  /** Vrai si le parcours revient à son point de départ. */
  closed: boolean
  length: number
}

/** Une séquence de points numérotés que l'utilisateur relie sans lever le crayon. */
export interface DotSequence {
  dots: Point[]
  closed: boolean
  /** Numéro du premier point dans la numérotation globale du puzzle. */
  firstNumber: number
}

export interface Ambiguity {
  /** Index de la séquence contenant le point fautif. */
  sequence: number
  /** Index du point dans la séquence. */
  index: number
  /** Numéro global affiché du point fautif. */
  number: number
  /** Distance vers le point suivant attendu. */
  expected: number
  /** Distance vers le point parasite, plus proche. */
  actual: number
}

export interface GeometryStats {
  skeletonPixels: number
  nodes: number
  /**
   * Sommets de degré >= 3. Un contour extérieur seul n'en a aucun : ce nombre
   * mesure directement la structure interne qu'un générateur classique ignore.
   */
  junctions: number
  edges: number
  /** Arêtes qui n'existent qu'à l'intérieur du dessin, invisibles pour un contour. */
  interiorEdges: number
  /** Longueur totale des traits du dessin, en pixels. */
  strokeLength: number
  /** Part de cette longueur située à l'intérieur, donc perdue par un contour seul. */
  interiorLength: number
  /**
   * Nombre de taches d'encre : c'est le nombre de boucles fermées que produit un
   * générateur par contour extérieur, autrement dit toute sa sortie.
   */
  contourLoops: number
}

interface PuzzleStats extends GeometryStats {
  dots: number
  sequences: number
  /** Borne inférieure théorique du nombre de séquences (optimalité atteinte). */
  minSequences: number
  /** Tolérance retenue après ajustement au budget de points. */
  tolerance: number
  /** Écart maximal, en pixels, entre les segments tracés et le dessin d'origine. */
  maxDeviation: number
  /** Distance minimale entre deux points consécutifs. */
  minSpacing: number
  /** Liaisons ajoutées pour fusionner des séquences, et longueur ainsi ajoutée. */
  bridges: number
  bridgeLength: number
  /** Paires de pastilles trop proches pour rester lisibles. */
  crowdedPairs: number
  /** Numéros n'ayant trouvé aucune place libre autour de leur pastille. */
  labelCollisions: number
  /** Points retirés parce que leur numéro était incasable. */
  removedForLabels: number
  /** Parcours écartés car trop courts, et longueur de dessin ainsi perdue. */
  droppedTrails: number
  droppedLength: number
  ambiguities: Ambiguity[]
  timings: Record<string, number>
}

export interface Puzzle {
  width: number
  height: number
  sequences: DotSequence[]
  /** Position résolue de chaque numéro, dans l'ordre de la numérotation. */
  labels: PlacedLabel[]
  stats: PuzzleStats
}
