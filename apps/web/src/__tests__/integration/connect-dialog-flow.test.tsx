/**
 * Integration test — Connect button triggers the ConnectionDialog modal.
 *
 * Renders the real HomePage with mocked UI components and verifies:
 * 1. Dialog is NOT visible on initial render
 * 2. Clicking Connect button shows the dialog with form fields
 * 3. Dialog has all PostgreSQL fields (host, port, database, username, password)
 * 4. Switching to SQLite shows file path field
 * 5. Cancel closes the dialog
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value }: { value: string }) => (
    <textarea data-testid="codemirror-editor" value={value} readOnly />
  ),
}))

vi.mock('@codemirror/lang-sql', () => ({
  sql: vi.fn(() => ({})),
}))

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
}))

vi.mock('@ui/sidebar-layout', () => ({
  SidebarLayout: ({
    navbar,
    sidebar,
    children,
  }: {
    navbar: React.ReactNode
    sidebar: React.ReactNode
    children: React.ReactNode
  }) => (
    <div data-testid="sidebar-layout">
      <div data-testid="layout-navbar">{navbar}</div>
      <div data-testid="layout-sidebar">{sidebar}</div>
      <div data-testid="layout-main">{children}</div>
    </div>
  ),
}))

vi.mock('@ui/navbar', () => ({
  Navbar: ({ children }: { children: React.ReactNode }) => <nav>{children}</nav>,
  NavbarSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  NavbarItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  NavbarLabel: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  NavbarSpacer: () => <div />,
}))

vi.mock('@ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@ui/button', () => ({
  Button: ({
    children,
    onClick,
    type,
    disabled,
    plain,
  }: {
    children: React.ReactNode
    onClick?: () => void
    type?: string
    disabled?: boolean
    plain?: boolean
    color?: string
    className?: string
    outline?: boolean
    'aria-label'?: string
  }) => (
    <button
      type={(type as 'button' | 'submit') ?? 'button'}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  ),
}))

vi.mock('@ui/sidebar', () => ({
  SidebarSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarHeading: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  SidebarItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarLabel: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@headlessui/react', () => {
  const Disclosure = ({ children }: { children: (bag: { open: boolean }) => React.ReactNode }) => (
    <div>{children({ open: false })}</div>
  )
  const DisclosureButton = ({ children, ...rest }: { children: React.ReactNode; as?: React.ElementType; [k: string]: unknown }) => (
    <div>{children}</div>
  )
  const DisclosurePanel = () => null
  return { Disclosure, DisclosureButton, DisclosurePanel }
})

// Dialog mock — this is the critical mock. It must render when open=true.
vi.mock('@ui/dialog', () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode
    open: boolean
    onClose: () => void
  }) =>
    open ? (
      <div role="dialog" data-testid="connection-dialog">
        {children}
      </div>
    ) : null,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogActions: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@ui/fieldset', () => ({
  Fieldset: ({ children }: { children: React.ReactNode }) => <fieldset>{children}</fieldset>,
  FieldGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Field: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}))

vi.mock('@ui/select', () => ({
  Select: ({
    children,
    value,
    onChange,
    id,
  }: {
    children: React.ReactNode
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
    id?: string
  }) => (
    <select id={id} value={value} onChange={onChange}>
      {children}
    </select>
  ),
}))

vi.mock('@ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    type,
    id,
  }: {
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    placeholder?: string
    type?: string
    id?: string
  }) => (
    <input
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type ?? 'text'}
    />
  ),
}))

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { Providers } from '../../app/providers'
import HomePage from '../../app/page'

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderApp() {
  return render(
    <Providers>
      <HomePage />
    </Providers>,
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: Connect button and ConnectionDialog', () => {
  it('dialog is NOT visible on initial render', () => {
    renderApp()
    expect(screen.queryByTestId('connection-dialog')).not.toBeInTheDocument()
  })

  it('clicking Connect button shows the connection dialog', () => {
    renderApp()

    // Find and click the Connect button in the navbar
    const connectButton = screen.getByRole('button', { name: /^connect$/i })
    fireEvent.click(connectButton)

    // Dialog should now be visible
    expect(screen.getByTestId('connection-dialog')).toBeInTheDocument()
  })

  it('dialog shows "Connect to Database" title', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }))

    expect(screen.getByText('Connect to Database')).toBeInTheDocument()
  })

  it('dialog shows PostgreSQL form fields by default', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }))

    const dialog = screen.getByTestId('connection-dialog')
    expect(within(dialog).getByLabelText(/host/i)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/port/i)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/database$/i)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/username/i)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('switching to SQLite shows file path field instead', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }))

    const dialog = screen.getByTestId('connection-dialog')
    const select = within(dialog).getByLabelText(/database type/i)
    fireEvent.change(select, { target: { value: 'sqlite' } })

    expect(within(dialog).getByLabelText(/file path/i)).toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/^host$/i)).not.toBeInTheDocument()
  })

  it('Cancel button closes the dialog', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }))

    expect(screen.getByTestId('connection-dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.queryByTestId('connection-dialog')).not.toBeInTheDocument()
  })

  it('Connect button in dialog is disabled when required fields are empty', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }))

    const dialog = screen.getByTestId('connection-dialog')
    // The submit Connect button inside the dialog (not the navbar one)
    const buttons = within(dialog).getAllByRole('button', { name: /connect/i })
    const submitButton = buttons[0]
    expect(submitButton).toBeDisabled()
  })
})
