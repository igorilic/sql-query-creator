import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { ConnectionDialog } from '../connection-dialog'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderDialog(overrides: Partial<React.ComponentProps<typeof ConnectionDialog>> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    onConnect: vi.fn(),
    ...overrides,
  }
  return { ...render(<ConnectionDialog {...props} />), ...props }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConnectionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Database type selector
  // -------------------------------------------------------------------------
  it('renders the database type selector with PostgreSQL and SQLite options', () => {
    renderDialog()

    const select = screen.getByLabelText(/database type/i)
    expect(select).toBeInTheDocument()

    const options = Array.from((select as HTMLSelectElement).options).map((o) => o.value)
    expect(options).toContain('postgresql')
    expect(options).toContain('sqlite')
  })

  // -------------------------------------------------------------------------
  // PostgreSQL fields
  // -------------------------------------------------------------------------
  it('shows PostgreSQL host/port/database/username/password fields by default', () => {
    renderDialog()

    expect(screen.getByLabelText(/^host$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^port$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^database$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^username$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // SQLite fields
  // -------------------------------------------------------------------------
  it('shows SQLite file path field when SQLite is selected', () => {
    renderDialog()

    fireEvent.change(screen.getByLabelText(/database type/i), { target: { value: 'sqlite' } })

    expect(screen.getByLabelText(/file path/i)).toBeInTheDocument()
    // PostgreSQL fields should be hidden
    expect(screen.queryByLabelText(/^host$/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^port$/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^database$/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^username$/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Submit button disabled state
  // -------------------------------------------------------------------------
  it('submit button is disabled when required PostgreSQL fields are empty', () => {
    renderDialog()

    expect(screen.getByRole('button', { name: /^connect$/i })).toBeDisabled()
  })

  it('submit button is disabled when SQLite file path is empty', () => {
    renderDialog()

    fireEvent.change(screen.getByLabelText(/database type/i), { target: { value: 'sqlite' } })

    expect(screen.getByRole('button', { name: /^connect$/i })).toBeDisabled()
  })

  it('submit button is enabled when all required PostgreSQL fields are filled', () => {
    renderDialog()

    fireEvent.change(screen.getByLabelText(/^host$/i), { target: { value: 'localhost' } })
    fireEvent.change(screen.getByLabelText(/^port$/i), { target: { value: '5432' } })
    fireEvent.change(screen.getByLabelText(/^database$/i), { target: { value: 'mydb' } })
    fireEvent.change(screen.getByLabelText(/^username$/i), { target: { value: 'admin' } })

    expect(screen.getByRole('button', { name: /^connect$/i })).not.toBeDisabled()
  })

  it('submit button is enabled when SQLite file path is filled', () => {
    renderDialog()

    fireEvent.change(screen.getByLabelText(/database type/i), { target: { value: 'sqlite' } })
    fireEvent.change(screen.getByLabelText(/file path/i), { target: { value: '/data/mydb.sqlite' } })

    expect(screen.getByRole('button', { name: /^connect$/i })).not.toBeDisabled()
  })

  // -------------------------------------------------------------------------
  // onConnect callback — PostgreSQL
  // -------------------------------------------------------------------------
  it('calls onConnect with correct PostgreSQL config on submit', () => {
    const { onConnect } = renderDialog()

    fireEvent.change(screen.getByLabelText(/^host$/i), { target: { value: 'localhost' } })
    fireEvent.change(screen.getByLabelText(/^port$/i), { target: { value: '5432' } })
    fireEvent.change(screen.getByLabelText(/^database$/i), { target: { value: 'mydb' } })
    fireEvent.change(screen.getByLabelText(/^username$/i), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'secret' } })

    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }))

    expect(onConnect).toHaveBeenCalledOnce()
    expect(onConnect).toHaveBeenCalledWith({
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      username: 'admin',
      password: 'secret',
    })
  })

  // -------------------------------------------------------------------------
  // onConnect callback — SQLite
  // -------------------------------------------------------------------------
  it('calls onConnect with correct SQLite config on submit', () => {
    const { onConnect } = renderDialog()

    fireEvent.change(screen.getByLabelText(/database type/i), { target: { value: 'sqlite' } })
    fireEvent.change(screen.getByLabelText(/file path/i), { target: { value: '/data/mydb.sqlite' } })

    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }))

    expect(onConnect).toHaveBeenCalledOnce()
    expect(onConnect).toHaveBeenCalledWith({
      type: 'sqlite',
      filePath: '/data/mydb.sqlite',
    })
  })
})
