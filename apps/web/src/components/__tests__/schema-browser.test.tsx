import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { SchemaBrowser } from '../schema-browser'
import type { DatabaseSchema } from '@repo/shared/types'

// ---------------------------------------------------------------------------
// Mocks — @ui/sidebar and @headlessui/react use browser APIs not available
// in the jsdom test environment.
// ---------------------------------------------------------------------------

vi.mock('@ui/sidebar', () => ({
  SidebarSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarHeading: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  SidebarItem: ({ children, onClick, 'aria-expanded': ariaExpanded, 'aria-controls': ariaControls }: {
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

vi.mock('@headlessui/react', () => {
  const Disclosure = ({ children }: { children: (bag: { open: boolean }) => React.ReactNode }) => {
    const [open, setOpen] = React.useState(false)
    return <div>{children({ open })}</div>
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
    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0)
    // Find the parent Disclosure's setOpen via context — simplified: toggle via click.
    // Because Headless UI Disclosure in real usage manages state internally, our mock
    // needs to wire the button click to the parent Disclosure's toggle. We accomplish
    // this by using a React context.
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
    return <div id={id} className={className}>{children}</div>
  }

  // Context to wire Button ↔ Panel through Disclosure
  const DisclosureCtx = React.createContext<{ open: boolean; toggle: () => void }>({
    open: false,
    toggle: () => {},
  })

  const DisclosureWithCtx = ({ children }: { children: (bag: { open: boolean }) => React.ReactNode }) => {
    const [open, setOpen] = React.useState(false)
    const toggle = React.useCallback(() => setOpen((v) => !v), [])
    return (
      <DisclosureCtx.Provider value={{ open, toggle }}>
        <div>{children({ open })}</div>
      </DisclosureCtx.Provider>
    )
  }

  return {
    Disclosure: DisclosureWithCtx,
    DisclosureButton,
    DisclosurePanel,
  }
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockSchema: DatabaseSchema = {
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
        { name: 'total', dataType: 'numeric', nullable: true, isPrimaryKey: false },
      ],
    },
  ],
}

const emptySchema: DatabaseSchema = {
  dialect: 'sqlite',
  tables: [],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SchemaBrowser', () => {
  // -------------------------------------------------------------------------
  // null schema — no connection
  // -------------------------------------------------------------------------
  it('shows "Connect a database to browse schema" when schema is null', () => {
    render(<SchemaBrowser schema={null} />)
    expect(screen.getByText(/connect a database to browse schema/i)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // empty schema — connected but no tables
  // -------------------------------------------------------------------------
  it('shows "No tables found" when schema has no tables', () => {
    render(<SchemaBrowser schema={emptySchema} />)
    expect(screen.getByText(/no tables found/i)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // schema with tables — tables are listed
  // -------------------------------------------------------------------------
  it('lists all table names when schema has tables', () => {
    render(<SchemaBrowser schema={mockSchema} />)
    expect(screen.getByText('users')).toBeInTheDocument()
    expect(screen.getByText('orders')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // expand / collapse — columns hidden by default
  // -------------------------------------------------------------------------
  it('does not show columns before a table is expanded', () => {
    render(<SchemaBrowser schema={mockSchema} />)
    expect(screen.queryByText('email')).not.toBeInTheDocument()
    expect(screen.queryByText('user_id')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // expand — clicking a table shows its columns
  // -------------------------------------------------------------------------
  it('shows columns with data types after clicking a table', () => {
    render(<SchemaBrowser schema={mockSchema} />)

    fireEvent.click(screen.getByText('users'))

    expect(screen.getByText('id')).toBeInTheDocument()
    expect(screen.getByText('email')).toBeInTheDocument()
    expect(screen.getByText('created_at')).toBeInTheDocument()
    // data types are visible
    expect(screen.getByText('integer')).toBeInTheDocument()
    expect(screen.getByText('varchar')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // collapse — clicking an expanded table hides columns again
  // -------------------------------------------------------------------------
  it('hides columns when an expanded table is clicked again', () => {
    render(<SchemaBrowser schema={mockSchema} />)

    fireEvent.click(screen.getByText('users'))
    expect(screen.getByText('email')).toBeInTheDocument()

    fireEvent.click(screen.getByText('users'))
    expect(screen.queryByText('email')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // FK badge — exact text match (not a loose regex)
  // -------------------------------------------------------------------------
  it('shows FK badge for foreign key columns', () => {
    render(<SchemaBrowser schema={mockSchema} />)

    fireEvent.click(screen.getByText('orders'))

    // Exact text 'FK' — not a broad /fk/i regex
    expect(screen.getByText('FK')).toBeInTheDocument()
  })

  it('does not show FK badge for non-FK columns', () => {
    render(<SchemaBrowser schema={mockSchema} />)

    fireEvent.click(screen.getByText('users'))

    // users table has no FK columns
    expect(screen.queryByText('FK')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // FK badge — shows referenced table.column inline
  // -------------------------------------------------------------------------
  it('FK badge shows the referenced table and column', () => {
    render(<SchemaBrowser schema={mockSchema} />)

    fireEvent.click(screen.getByText('orders'))

    // The inline reference text → users.id
    expect(screen.getByText(/→ users\.id/)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // accessibility — toggle button carries aria-expanded
  // -------------------------------------------------------------------------
  it('toggle button has aria-expanded=false when table is collapsed', () => {
    render(<SchemaBrowser schema={mockSchema} />)

    const btn = screen.getByRole('button', { name: /users/i })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
  })

  it('toggle button has aria-expanded=true when table is expanded', () => {
    render(<SchemaBrowser schema={mockSchema} />)

    const btn = screen.getByRole('button', { name: /users/i })
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
  })

  // -------------------------------------------------------------------------
  // multiple tables can be expanded independently
  // -------------------------------------------------------------------------
  it('can expand multiple tables at the same time', () => {
    render(<SchemaBrowser schema={mockSchema} />)

    fireEvent.click(screen.getByText('users'))
    fireEvent.click(screen.getByText('orders'))

    expect(screen.getByText('email')).toBeInTheDocument()
    expect(screen.getByText('user_id')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Dark mode classes
  // -------------------------------------------------------------------------
  describe('dark mode classes', () => {
    it('empty-state container has dark:text-zinc-400', () => {
      render(<SchemaBrowser schema={null} />)
      const el = screen.getByText(/connect a database/i)
      expect(el.closest('div')!.className).toContain('dark:text-zinc-400')
    })

    it('column row has dark:text-zinc-400', () => {
      render(<SchemaBrowser schema={mockSchema} />)
      fireEvent.click(screen.getByText('users'))
      const colRow = screen.getByText('email').closest('div')!
      expect(colRow.className).toContain('dark:text-zinc-400')
    })

    it('data-type span has dark:text-zinc-500', () => {
      render(<SchemaBrowser schema={mockSchema} />)
      fireEvent.click(screen.getByText('users'))
      const dataType = screen.getByText('integer')
      expect(dataType.className).toContain('dark:text-zinc-500')
    })

    it('FK badge has dark:bg-amber-900/50 and dark:text-amber-400', () => {
      render(<SchemaBrowser schema={mockSchema} />)
      fireEvent.click(screen.getByText('orders'))
      const fkBadge = screen.getByText('FK')
      expect(fkBadge.className).toContain('dark:bg-amber-900/50')
      expect(fkBadge.className).toContain('dark:text-amber-400')
    })
  })
})
