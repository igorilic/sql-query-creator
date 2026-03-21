import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { AppHeader } from '../app-header'
import type { ConnectionStatus } from '@repo/shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const disconnectedStatus: ConnectionStatus = { connected: false }
const connectedPg: ConnectionStatus = { connected: true, type: 'postgresql' }
const connectedSqlite: ConnectionStatus = { connected: true, type: 'sqlite' }

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
})
