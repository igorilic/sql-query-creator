/**
 * Tests that verify the Connect button click actually triggers the handler.
 * Uses the REAL Catalyst Button and AppHeader — NOT mocked — to catch
 * click propagation issues in the actual component tree.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React, { useState } from 'react'

// Mock only what's strictly needed for headlessui/motion
vi.mock('motion/react', () => ({
  LayoutGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    span: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement> & { layoutId?: string }) => (
      <span {...props}>{children}</span>
    ),
  },
}))

// Import REAL components — no mocks for @ui/button, @ui/navbar, @ui/badge
import { Button } from '@ui/button'
import { AppHeader } from '../components/app-header'

describe('Connect button click flow', () => {
  describe('Catalyst Button component', () => {
    it('fires onClick when clicked with fireEvent', () => {
      const handler = vi.fn()
      render(<Button onClick={handler}>Click me</Button>)

      fireEvent.click(screen.getByRole('button', { name: /click me/i }))
      expect(handler).toHaveBeenCalledOnce()
    })

    it('fires onClick when clicked with userEvent', async () => {
      const handler = vi.fn()
      render(<Button onClick={handler}>Click me</Button>)

      await userEvent.click(screen.getByRole('button', { name: /click me/i }))
      expect(handler).toHaveBeenCalledOnce()
    })

    it('fires onClick with color="dark/zinc" prop', () => {
      const handler = vi.fn()
      render(
        <Button onClick={handler} color="dark/zinc" className="px-5 py-2">
          Connect
        </Button>,
      )

      fireEvent.click(screen.getByRole('button', { name: /connect/i }))
      expect(handler).toHaveBeenCalledOnce()
    })
  })

  describe('AppHeader Connect button', () => {
    it('fires onConnectClick when Connect button is clicked', () => {
      const handler = vi.fn()
      render(
        <AppHeader
          status={{ connected: false }}
          onConnectClick={handler}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: /connect/i }))
      expect(handler).toHaveBeenCalledOnce()
    })

    it('fires onConnectClick when connected', () => {
      const handler = vi.fn()
      render(
        <AppHeader
          status={{ connected: true, type: 'postgresql' }}
          onConnectClick={handler}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: /connect/i }))
      expect(handler).toHaveBeenCalledOnce()
    })
  })

  describe('Full state flow: click toggles dialog open state', () => {
    function TestHarness() {
      const [dialogOpen, setDialogOpen] = useState(false)
      return (
        <div>
          <AppHeader
            status={{ connected: false }}
            onConnectClick={() => setDialogOpen(true)}
          />
          {dialogOpen && <div data-testid="dialog-opened">Dialog is open</div>}
          <button onClick={() => setDialogOpen(false)}>Close</button>
        </div>
      )
    }

    it('clicking Connect sets state that shows dialog placeholder', () => {
      render(<TestHarness />)

      expect(screen.queryByTestId('dialog-opened')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /connect/i }))

      expect(screen.getByTestId('dialog-opened')).toBeInTheDocument()
    })

    it('clicking Connect then Close toggles state correctly', () => {
      render(<TestHarness />)

      fireEvent.click(screen.getByRole('button', { name: /connect/i }))
      expect(screen.getByTestId('dialog-opened')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /close/i }))
      expect(screen.queryByTestId('dialog-opened')).not.toBeInTheDocument()
    })
  })
})
