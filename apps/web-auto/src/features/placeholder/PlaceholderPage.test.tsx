import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { messages } from '@/lib/messages'
import { PlaceholderPage } from './PlaceholderPage'

describe('PlaceholderPage', () => {
  it('shows the title and description', () => {
    render(<PlaceholderPage />)
    expect(screen.getByRole('heading', { name: messages.placeholder.title })).toBeInTheDocument()
    expect(screen.getByText(messages.placeholder.description)).toBeInTheDocument()
  })
})
