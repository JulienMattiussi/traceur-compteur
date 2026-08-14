/** Largeur utile d'une page A4 imprimée, marges déduites. */
export const PAGE_WIDTH_MM = 190

/**
 * Convertit un espacement lisible exprimé en millimètres imprimés vers des
 * pixels de l'image.
 *
 * Raisonner en pixels ne veut rien dire : la même image en 700 ou en 2000 px de
 * large donne le même papier. Ce qui compte, c'est la place qu'occupe un numéro
 * à trois chiffres sur la feuille, soit environ 4 mm.
 */
export function spacingInPixels(imageWidth: number, millimetres: number): number {
  return Math.max(2, (millimetres * imageWidth) / PAGE_WIDTH_MM)
}

/** Réglages exposés à l'utilisateur. Un sous-ensemble volontairement réduit des options du moteur. */
export interface Settings {
  /** Budget de points : le moteur ajuste la fidélité pour le tenir. */
  maxDots: number
  /** Espacement minimal entre deux pastilles, en millimètres sur la page imprimée. */
  spacingMm: number
  /** Longueur sous laquelle une barbule est considérée comme un artefact. */
  pruneSpursBelow: number
  /** Aire sous laquelle une tache d'encre est ignorée. */
  minBlobArea: number
  /** Seuil de binarisation, ou 'auto' pour la méthode d'Otsu. */
  threshold: number | 'auto'
}

export const DEFAULT_SETTINGS: Settings = {
  maxDots: 400,
  spacingMm: 4,
  pruneSpursBelow: 6,
  minBlobArea: 24,
  threshold: 'auto',
}
