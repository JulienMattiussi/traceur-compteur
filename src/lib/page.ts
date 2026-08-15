/**
 * Géométrie de la page imprimée.
 *
 * Tout le moteur raisonne en millimètres de papier plutôt qu'en pixels : la même
 * image en 700 ou en 2000 px de large donne la même feuille, donc seul le rendu
 * imprimé a un sens comme unité de lisibilité.
 */

/** Largeur utile d'une page A4, marges déduites. */
export const PAGE_WIDTH_MM = 190

/** Convertit une longueur exprimée en millimètres imprimés vers des pixels d'image. */
export function spacingInPixels(imageWidth: number, millimetres: number): number {
  return Math.max(2, (millimetres * imageWidth) / PAGE_WIDTH_MM)
}

/**
 * Tailles des pastilles et des numéros, dérivées de la largeur de l'image. Une
 * seule source pour le placement et pour le rendu : sinon les étiquettes seraient
 * calculées à une taille et dessinées à une autre.
 */
export function metricsFor(width: number, height: number) {
  const pixelsPerMm = width / PAGE_WIDTH_MM
  return {
    dotRadius: 0.55 * pixelsPerMm,
    fontSize: 2.4 * pixelsPerMm,
    canvasWidth: width,
    canvasHeight: height,
  }
}
