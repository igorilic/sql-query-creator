import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { AppHeader } from '../app-header'
import type { ConnectionStatus } from '@repo/shared/types'

// ---------------------------------------------------------------------------
// Mocks — Catalyst Navbar/Badge components use motion and browser APIs
// not available in the happy-dom test environment.
// ---------------------------------------------------------------------------

vi.mock('@ui/navbar', () => ({
  Navbar: ({ children }: { children: React.ReactNode }) => <nav>{children}</nav>,
  NavbarSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  NavbarItem: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  NavbarLabel: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  NavbarSpacer: () => <div aria-hidden="true" />,
}))

vi.mock('@ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@ui/button', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const disconnectedStatus: ConnectionStatus = { connected: false }
const connectedPg: ConnectionStatus = { connected: true, type: 'postgresql' }
const connectedSqlite: ConnectionStatus = { connected: true, type: 'sqlite' }
const errorStatus: ConnectionStatus = { connected: false, error: 'ECONNREFUSED' }
const connectedNoType: ConnectionStatus = { connected: true }

function renderHeader(overrides: Partial<React.ComponentProps<typeof AppHeader>> = {}) {
  const props = {
    status: disconnectedStatus,
    onConnectClick: vi.fn(),
    ...overrides,
  }
  return { ...render(<AppHeader {...props} />), ...props }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AppHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Disconnected state
  // -------------------------------------------------------------------------
  it('shows "Not connected" when disconnected', () => {
    renderHeader({ status: disconnectedStatus })

    expect(screen.getByText(/not connected/i)).toBeInTheDocument()
  })

  it('does not show a connected message when disconnected', () => {
    renderHeader({ status: disconnectedStatus })

    expect(screen.queryByText(/connected.*postgresql/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/connected.*sqlite/i)).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Connected — PostgreSQL
  // -------------------------------------------------------------------------
  it('shows "Connected — PostgreSQL" when connected to PostgreSQL', () => {
    renderHeader({ status: connectedPg })

    expect(screen.getByText(/connected/i)).toBeInTheDocument()
    expect(screen.getByText(/postgresql/i)).toBeInTheDocument()
  })

  it('does not show "Not connected" when connected to PostgreSQL', () => {
    renderHeader({ status: connectedPg })

    expect(screen.queryByText(/not connected/i)).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Connected — SQLite
  // -------------------------------------------------------------------------
  it('shows "Connected — SQLite" when connected to SQLite', () => {
    renderHeader({ status: connectedSqlite })

    expect(screen.getByText(/connected/i)).toBeInTheDocument()
    expect(screen.getByText(/sqlite/i)).toBeInTheDocument()
  })

  it('does not show "Not connected" when connected to SQLite', () => {
    renderHeader({ status: connectedSqlite })

    expect(screen.queryByText(/not connected/i)).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Connect button
  // -------------------------------------------------------------------------
  it('renders a "Connect" button', () => {
    renderHeader()

    expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument()
  })

  it('calls onConnectClick when "Connect" button is clicked', () => {
    const { onConnectClick } = renderHeader()

    fireEvent.click(screen.getByRole('button', { name: /connect/i }))

    expect(onConnectClick).toHaveBeenCalledOnce()
  })

  // -------------------------------------------------------------------------
  // App title
  // -------------------------------------------------------------------------
  it('renders the application name', () => {
    renderHeader()

    expect(screen.getByText(/sql query creator/i)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Error state (Finding 1)
  // -------------------------------------------------------------------------
  it('shows "Connection error" when status has an error', () => {
    renderHeader({ status: errorStatus })

    expect(screen.getByText(/connection error/i)).toBeInTheDocument()
  })

  it('does not show "Not connected" when status has an error', () => {
    renderHeader({ status: errorStatus })

    expect(screen.queryByText(/not connected/i)).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Connected with no type (Finding 2)
  // -------------------------------------------------------------------------
  it('shows "Connected" without a dialect when type is absent', () => {
    renderHeader({ status: connectedNoType })

    expect(screen.getByText(/connected/i)).toBeInTheDocument()
    // Must NOT default-label as SQLite when type is missing
    expect(screen.queryByText(/sqlite/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/postgresql/i)).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // No nested interactive elements (issue #3)
  // -------------------------------------------------------------------------
  it('does not nest interactive elements (button inside button)', () => {
    const { container } = renderHeader()

    const nestedButtons = container.querySelectorAll('button button')
    expect(nestedButtons.length).toBe(0)
  })
})
