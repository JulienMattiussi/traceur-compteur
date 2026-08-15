/** Réglages exposés à l'utilisateur. Un sous-ensemble volontairement réduit des options du moteur. */
export interface Settings {
  /** Budget de points : le moteur ajuste la fidélité pour le tenir. */
  maxDots: number
  /**
   * Espacement minimal entre deux pastilles d'une même séquence, en millimètres
   * imprimés. Ce n'est plus un réglage de lisibilité mais de densité : les numéros
   * sont replacés automatiquement pour ne jamais se chevaucher.
   */
  spacingMm: number
  /**
   * Longueur maximale, en millimètres imprimés, d'une liaison ajoutée entre deux
   * traits pour fusionner deux séquences. 0 n'ajoute rien.
   */
  bridgeMm: number
  /** Longueur sous laquelle une barbule est considérée comme un artefact. */
  pruneSpursBelow: number
  /** Aire sous laquelle une tache d'encre est ignorée. */
  minBlobArea: number
  /** Seuil de binarisation, ou 'auto' pour la méthode d'Otsu. */
  threshold: number | 'auto'
}

export const DEFAULT_SETTINGS: Settings = {
  maxDots: 400,
  spacingMm: 2.5,
  bridgeMm: 8,
  pruneSpursBelow: 6,
  minBlobArea: 24,
  threshold: 'auto',
}
