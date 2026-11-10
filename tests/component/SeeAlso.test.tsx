import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SeeAlso } from '@/components/SeeAlso'

describe('SeeAlso', () => {
  it('lists the three sibling tools, not the current one', () => {
    render(<SeeAlso current="traceur-compteur" />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(3)
    expect(links.map((a) => a.getAttribute('href'))).not.toContain(
      'https://traceur-compteur.yavadeus.dev/',
    )
  })
})
