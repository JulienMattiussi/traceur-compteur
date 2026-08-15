import { describe, expect, it, vi } from 'vitest'
import { download } from '@/platform/image'

describe('download', () => {
  it('crée un lien de téléchargement puis libère l’URL', () => {
    const createObjectURL = vi.fn(() => 'blob:fichier')
    const revokeObjectURL = vi.fn()
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL

    const click = vi.fn()
    const link = { href: '', download: '', click } as unknown as HTMLAnchorElement
    const create = vi.spyOn(document, 'createElement').mockReturnValue(link)

    download('puzzle.svg', '<svg/>', 'image/svg+xml')

    expect(create).toHaveBeenCalledWith('a')
    expect(link.download).toBe('puzzle.svg')
    expect(link.href).toBe('blob:fichier')
    expect(click).toHaveBeenCalledOnce()
    // Sans révocation, chaque export laisserait son blob en mémoire.
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fichier')

    create.mockRestore()
  })

  it('déclare le type demandé', () => {
    const created: Blob[] = []
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob)
      return 'blob:x'
    }) as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn()
    const create = vi
      .spyOn(document, 'createElement')
      .mockReturnValue({ href: '', download: '', click: vi.fn() } as unknown as HTMLAnchorElement)

    download('puzzle.pdf', new Uint8Array([1, 2, 3]), 'application/pdf')

    expect(created[0]!.type).toBe('application/pdf')
    create.mockRestore()
  })
})
