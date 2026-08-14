import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/App'
import { circle, createMask, line } from '../fixtures'

/**
 * jsdom n'a pas de canvas. On en simule juste ce que `loadGrayImage` utilise, en
 * lui servant un vrai dessin : le reste du parcours (squelettisation, parcours,
 * placement des points, rendu) tourne alors pour de bon.
 */
function stubCanvas(width: number, height: number): void {
  const mask = createMask(width, height)
  circle(mask, width / 2, height / 2, width * 0.4)
  circle(mask, width * 0.36, height * 0.4, width * 0.05)
  circle(mask, width * 0.64, height * 0.4, width * 0.05)
  line(mask, { x: width * 0.35, y: height * 0.68 }, { x: width * 0.65, y: height * 0.68 }, 3)

  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < mask.data.length; i++) {
    const value = mask.data[i] === 1 ? 0 : 255
    rgba[i * 4] = value
    rgba[i * 4 + 1] = value
    rgba[i * 4 + 2] = value
    rgba[i * 4 + 3] = 255
  }

  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockResolvedValue({ width, height, close: vi.fn() }),
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillStyle: '',
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: () => ({ data: rgba, width, height }),
  } as unknown as CanvasRenderingContext2D)

  URL.createObjectURL = vi.fn(() => 'blob:source')
  URL.revokeObjectURL = vi.fn()
}

async function loadDrawing(): Promise<void> {
  render(<App />)
  await userEvent.upload(
    screen.getByLabelText('Choisir une image'),
    new File(['x'], 'dessin.png', { type: 'image/png' }),
  )
  // Délai large : ce test fait tourner le moteur pour de vrai (squelettisation,
  // parcours, placement des numéros). Sur une machine chargée, la seconde par
  // défaut ne suffit pas.
  await screen.findByRole('button', { name: 'Image source' }, { timeout: 8000 })
}

describe('surimpression de l’image source', () => {
  beforeEach(() => stubCanvas(200, 200))
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('génère un puzzle et propose la surimpression', async () => {
    await loadDrawing()

    expect(screen.getByRole('button', { name: 'Télécharger le PDF' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Le SVG' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Le puzzle' })).toBeInTheDocument()
    // Le panneau de mesures n'apparaît que si un puzzle a bien été produit.
    expect(screen.getByRole('heading', { name: 'Mesures' })).toBeInTheDocument()
    expect(screen.getByText('Points')).toBeInTheDocument()
  })

  it('n’affiche l’image que lorsqu’on l’active', async () => {
    await loadDrawing()
    expect(screen.queryByAltText('Image source en surimpression')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Image source' }))

    const image = screen.getByAltText('Image source en surimpression')
    expect(image).toHaveAttribute('src', 'blob:source')
    expect(image).toHaveStyle({ opacity: '0.35' })
  })

  it('sépare le choix du tracé des boutons de sortie', async () => {
    await loadDrawing()

    const display = screen.getByRole('group', { name: 'Affichage' })
    const exports = screen.getByRole('group', { name: 'Exporter' })

    expect(within(display).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Le puzzle',
      'Avec le tracé',
      'La solution',
      'Image source',
    ])
    expect(within(exports).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Télécharger le PDF',
      'Le SVG',
      'Imprimer',
    ])
  })

  it('ne déplace aucun bouton quand le curseur apparaît', async () => {
    await loadDrawing()

    // Le curseur occupe sa place en permanence, désactivé tant que la
    // surimpression est éteinte : c'est ce qui empêche les boutons de sauter.
    const slider = screen.getByLabelText("Opacité de l'image source")
    expect(slider).toBeDisabled()

    const display = screen.getByRole('group', { name: 'Affichage' })
    const before = within(display)
      .getAllByRole('button')
      .map((button) => button.textContent)

    await userEvent.click(screen.getByRole('button', { name: 'Image source' }))

    expect(slider).toBeEnabled()
    expect(
      within(display)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(before)
    // Le curseur vit dans le groupe d'affichage, jamais parmi les sorties.
    expect(screen.getByRole('group', { name: 'Exporter' }).contains(slider)).toBe(false)
  })

  it('propose le PDF en premier parmi les sorties', async () => {
    await loadDrawing()

    // Le PDF est la sortie recommandée : c'est la seule qui échappe aux en-têtes
    // et à l'échelle du dialogue d'impression.
    const exports = screen.getByRole('group', { name: 'Exporter' })
    expect(within(exports).getAllByRole('button')[0]).toHaveTextContent('Télécharger le PDF')
  })

  it('libère l’URL de l’image remplacée', async () => {
    await loadDrawing()

    await userEvent.upload(
      screen.getByLabelText('Choisir une image'),
      new File(['y'], 'autre.png', { type: 'image/png' }),
    )

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:source')
  })
})
