/**
 * Step 22 — RED: Integration test — database connection and schema browsing flow.
 *
 * Scenario A: User clicks Connect → fills PostgreSQL form → submits →
 *   header updates to "Connected — PostgreSQL" → schema browser shows tables →
 *   user expands table → columns visible.
 *
 * Scenario B: User connects to SQLite → previous PostgreSQL connection is
 *   replaced → schema browser updates with SQLite schema tables.
 *
 * Strategy:
 *  - Use real contexts (ConnectionProvider + ChatProvider) and real page/component logic.
 *  - Mock heavy Catalyst @ui/* components (use browser APIs incompatible with happy-dom).
 *  - Mock @headlessui/react Disclosure to enable expand/collapse in test env.
 *  - Mock fetch to control /api/connect and /api/schema responses.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@uiw/react-codemirror', () => ({
  default: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string
    onChange?: (val: string) => void
    placeholder?: string
  }) => (
    <textarea
      data-testid="codemirror-editor"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}))

vi.mock('@codemirror/lang-sql', () => ({
  sql: vi.fn(() => ({})),
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
  NavbarSpacer: () => <div aria-hidden="true" />,
}))

vi.mock('@ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="status-badge">{children}</span>
  ),
}))

vi.mock('@ui/button', () => ({
  Button: ({
    children,
    onClick,
    type,
    disabled,
    plain,
    'aria-label': ariaLabel,
  }: {
    children: React.ReactNode
    onClick?: () => void
    type?: string
    disabled?: boolean
    plain?: boolean
    'aria-label'?: string
  }) => (
    <button
      type={(type as 'button' | 'submit') ?? 'button'}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  ),
}))

vi.mock('@ui/sidebar', () => ({
  SidebarSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarHeading: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  SidebarItem: ({
    children,
    onClick,
    'aria-expanded': ariaExpanded,
    'aria-controls': ariaControls,
  }: {
    children: React.ReactNode
    onClick?: () => void
    'aria-expanded'?: boolean
    'aria-controls'?: string
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
    >
      {children}
    </button>
  ),
  SidebarLabel: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

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
    name,
  }: {
    children: React.ReactNode
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
    id?: string
    name?: string
  }) => (
    <select id={id} name={name} value={value} onChange={onChange}>
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
    name,
    required,
  }: {
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    placeholder?: string
    type?: string
    id?: string
    name?: string
    required?: boolean
  }) => (
    <input
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type ?? 'text'}
      name={name}
      required={required}
    />
  ),
}))

// ---------------------------------------------------------------------------
// Headless UI Disclosure mock — enables expand/collapse in happy-dom
// ---------------------------------------------------------------------------

vi.mock('@headlessui/react', () => {
  // Shared context so Button and Panel can communicate through a Disclosure
  const DisclosureCtx = React.createContext<{ open: boolean; toggle: () => void }>({
    open: false,
    toggle: () => {},
  })

  const DisclosureWithCtx = ({
    children,
  }: {
    children: (bag: { open: boolean }) => React.ReactNode
  }) => {
    const [open, setOpen] = React.useState(false)
    const toggle = React.useCallback(() => setOpen((v) => !v), [])
    return (
      <DisclosureCtx.Provider value={{ open, toggle }}>
        <div>{children({ open })}</div>
      </DisclosureCtx.Provider>
    )
  }

  const DisclosureButton = ({
    as: As = 'button',
    children,
    onClick,
    ...rest
  }: {
    as?: React.ElementType
    children: React.ReactNode
    onClick?: (e: React.MouseEvent) => void
    [key: string]: unknown
  }) => {
    const ctx = React.useContext(DisclosureCtx)
    return (
      <As
        {...rest}
        onClick={(e: React.MouseEvent) => {
          ctx.toggle()
          onClick?.(e)
        }}
      >
        {children}
      </As>
    )
  }

  const DisclosurePanel = ({
    children,
    id,
    className,
  }: {
    children: React.ReactNode
    id?: string
    className?: string
  }) => {
    const ctx = React.useContext(DisclosureCtx)
    if (!ctx.open) return null
    return (
      <div id={id} className={className}>
        {children}
      </div>
    )
  }

  return {
    Disclosure: DisclosureWithCtx,
    DisclosureButton,
    DisclosurePanel,
  }
})

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { Providers } from '../../app/providers'
import HomePage from '../../app/page'
import type { DatabaseSchema } from '@repo/shared/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const pgSchema: DatabaseSchema = {
  dialect: 'postgresql',
  tables: [
    {
      name: 'users',
      columns: [
        { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true },
        { name: 'email', dataType: 'varchar', nullable: false, isPrimaryKey: false },
        { name: 'created_at', dataType: 'timestamp', nullable: true, isPrimaryKey: false },
      ],
    },
    {
      name: 'orders',
      columns: [
        { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true },
        {
          name: 'user_id',
          dataType: 'integer',
          nullable: false,
          isPrimaryKey: false,
          foreignKey: { table: 'users', column: 'id' },
        },
      ],
    },
  ],
}

const sqliteSchema: DatabaseSchema = {
  dialect: 'sqlite',
  tables: [
    {
      name: 'products',
      columns: [
        { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true },
        { name: 'name', dataType: 'text', nullable: false, isPrimaryKey: false },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

function mockFetchForConnection(
  type: 'postgresql' | 'sqlite',
  schema: DatabaseSchema,
): ReturnType<typeof vi.spyOn> {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementationOnce(async (url) => {
      if (String(url).includes('/api/connect')) {
        return new Response(JSON.stringify({ status: 'connected', type }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(null, { status: 404 })
    })
    .mockImplementationOnce(async (url) => {
      if (String(url).includes('/api/schema')) {
        return new Response(JSON.stringify(schema), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(null, { status: 404 })
    })
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderApp() {
  return render(
    <Providers>
      <HomePage />
    </Providers>,
  )
}

// ---------------------------------------------------------------------------
// Dialog submit helper — clicks the "Connect" button inside the dialog only
// ---------------------------------------------------------------------------

async function submitDialog() {
  const dialog = screen.getByTestId('connection-dialog')
  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: /^connect$/i }))
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: database connection and schema browsing flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // A1 — clicking Connect opens the dialog
  // -------------------------------------------------------------------------

  it('clicking the Connect button opens the connection dialog', () => {
    renderApp()

    expect(screen.queryByTestId('connection-dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }))

    expect(screen.getByTestId('connection-dialog')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // A2 — PG form shown by default; SQLite form hidden
  // -------------------------------------------------------------------------

  it('connection dialog shows PostgreSQL fields by default', () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }))

    // PG-specific fields visible (exact label text to avoid ambiguity with "Database type")
    expect(screen.getByLabelText('Host')).toBeInTheDocument()
    expect(screen.getByLabelText('Port')).toBeInTheDocument()
    expect(screen.getByLabelText('Database')).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toBeInTheDocument()

    // SQLite field not visible
    expect(screen.queryByLabelText('File path')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // A3 — Submit PG form → header shows "Connected — PostgreSQL"
  // -------------------------------------------------------------------------

  it('connecting to PostgreSQL updates the status badge to "Connected — PostgreSQL"', async () => {
    mockFetchForConnection('postgresql', pgSchema)
    renderApp()

    // Initial state: not connected
    expect(screen.getByTestId('status-badge')).toHaveTextContent('Not connected')

    // Open dialog
    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }))

    // Fill PostgreSQL form (exact label text to avoid "Database type" ambiguity)
    fireEvent.change(screen.getByLabelText('Host'), { target: { value: 'localhost' } })
    fireEvent.change(screen.getByLabelText('Database'), { target: { value: 'mydb' } })
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'postgres' } })

    // Submit via the dialog's own Connect button
    await submitDialog()

    await waitFor(() => {
      expect(screen.getByTestId('status-badge')).toHaveTextContent('Connected — PostgreSQL')
    })
  })

  // -------------------------------------------------------------------------
  // A4 — Schema browser shows tables after PG connection
  // -------------------------------------------------------------------------

  it('schema browser displays PostgreSQL tables after connecting', async () => {
    mockFetchForConnection('postgresql', pgSchema)
    renderApp()

    // Initially shows connect prompt
    expect(screen.getByText('Connect a database to browse schema')).toBeInTheDocument()

    // Open dialog, fill form, submit
    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }))
    fireEvent.change(screen.getByLabelText('Host'), { target: { value: 'localhost' } })
    fireEvent.change(screen.getByLabelText('Database'), { target: { value: 'mydb' } })
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'postgres' } })

    await submitDialog()

    await waitFor(() => {
      expect(screen.getByText('users')).toBeInTheDocument()
      expect(screen.getByText('orders')).toBeInTheDocument()
    })

    // Connect prompt no longer visible
    expect(screen.queryByText('Connect a database to browse schema')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // A5 — Expanding a table shows its columns
  // -------------------------------------------------------------------------

  it('expanding a table in the schema browser reveals its columns', async () => {
    mockFetchForConnection('postgresql', pgSchema)
    renderApp()

    // Connect
    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }))
    fireEvent.change(screen.getByLabelText('Host'), { target: { value: 'localhost' } })
    fireEvent.change(screen.getByLabelText('Database'), { target: { value: 'mydb' } })
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'postgres' } })

    await submitDialog()

    // Wait for schema to load
    await waitFor(() => {
      expect(screen.getByText('users')).toBeInTheDocument()
    })

    // Columns not yet visible
    expect(screen.queryByText('email')).not.toBeInTheDocument()

    // Expand the users table
    fireEvent.click(screen.getByRole('button', { name: /users/i }))

    // Columns now visible
    expect(screen.getByText('email')).toBeInTheDocument()
    expect(screen.getByText('created_at')).toBeInTheDocument()
    expect(screen.getByText('varchar')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // A6 — Dialog closes after successful connection
  // -------------------------------------------------------------------------

  it('connection dialog closes after a successful connection', async () => {
    mockFetchForConnection('postgresql', pgSchema)
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }))
    expect(screen.getByTestId('connection-dialog')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Host'), { target: { value: 'localhost' } })
    fireEvent.change(screen.getByLabelText('Database'), { target: { value: 'mydb' } })
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'postgres' } })

    await submitDialog()

    await waitFor(() => {
      expect(screen.queryByTestId('connection-dialog')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // B — Switch from PostgreSQL to SQLite replaces connection + schema
  // -------------------------------------------------------------------------

  it('connecting to SQLite replaces PostgreSQL connection and updates schema browser', async () => {
    // First connection: PostgreSQL
    mockFetchForConnection('postgresql', pgSchema)

    renderApp()

    // Connect to PG
    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }))
    fireEvent.change(screen.getByLabelText('Host'), { target: { value: 'localhost' } })
    fireEvent.change(screen.getByLabelText('Database'), { target: { value: 'mydb' } })
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'postgres' } })

    await submitDialog()

    await waitFor(() => {
      expect(screen.getByTestId('status-badge')).toHaveTextContent('Connected — PostgreSQL')
      expect(screen.getByText('users')).toBeInTheDocument()
    })

    // Now set up mock for SQLite connection
    mockFetchForConnection('sqlite', sqliteSchema)

    // Open dialog again and switch to SQLite
    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }))

    // Switch to SQLite in the dialog
    fireEvent.change(within(screen.getByTestId('connection-dialog')).getByRole('combobox'), {
      target: { value: 'sqlite' },
    })

    // Fill SQLite file path
    await waitFor(() => {
      expect(screen.getByLabelText('File path')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText('File path'), {
      target: { value: '/tmp/test.db' },
    })

    await submitDialog()

    // Header now shows SQLite
    await waitFor(() => {
      expect(screen.getByTestId('status-badge')).toHaveTextContent('Connected — SQLite')
    })

    // Schema browser now shows SQLite tables, not PG tables
    await waitFor(() => {
      expect(screen.getByText('products')).toBeInTheDocument()
    })
    expect(screen.queryByText('users')).not.toBeInTheDocument()
    expect(screen.queryByText('orders')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // C — Switching to SQLite and expanding shows SQLite columns
  // -------------------------------------------------------------------------

  it('expanding a SQLite table shows its columns correctly', async () => {
    mockFetchForConnection('sqlite', sqliteSchema)
    renderApp()

    // Open dialog, switch to SQLite, connect
    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }))
    fireEvent.change(within(screen.getByTestId('connection-dialog')).getByRole('combobox'), {
      target: { value: 'sqlite' },
    })

    await waitFor(() => {
      expect(screen.getByLabelText('File path')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText('File path'), {
      target: { value: '/tmp/test.db' },
    })

    await submitDialog()

    // Wait for schema
    await waitFor(() => {
      expect(screen.getByText('products')).toBeInTheDocument()
    })

    // Expand products table
    fireEvent.click(screen.getByRole('button', { name: /products/i }))

    expect(screen.getByText('name')).toBeInTheDocument()
    expect(screen.getByText('text')).toBeInTheDocument()
  })
})
