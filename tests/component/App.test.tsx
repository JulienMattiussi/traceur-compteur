import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '@/App'

describe('App', () => {
  it('invite à choisir une image au démarrage', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Traceur-compteur' })).toBeInTheDocument()
    expect(screen.getByText(/Choisis une image pour commencer/)).toBeInTheDocument()
  })

  it('n’affiche ni réglages ni statistiques sans image', () => {
    render(<App />)

    expect(screen.queryByText('Nombre de points')).not.toBeInTheDocument()
    expect(screen.queryByText('Le puzzle')).not.toBeInTheDocument()
  })

  it('signale une image illisible sans casser la page', async () => {
    // jsdom ne décode pas les images : on force l'échec pour vérifier le
    // message d'erreur plutôt que de simuler un canvas complet.
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('Format non reconnu.')))

    render(<App />)
    const input = screen.getByLabelText('Choisir une image')
    await userEvent.upload(input, new File(['nope'], 'nope.png', { type: 'image/png' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Format non reconnu.')
    vi.unstubAllGlobals()
  })

  it('laisse déposer un fichier par glisser-déposer', () => {
    render(<App />)
    expect(screen.getByText(/Glisse un dessin au trait/)).toBeInTheDocument()
  })
})
