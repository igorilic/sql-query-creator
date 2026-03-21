import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { SchemaBrowser } from '../schema-browser'
import type { DatabaseSchema } from '@repo/shared/types'

// ---------------------------------------------------------------------------
// Mocks — @ui/sidebar imports motion/react which is not installed in test env
// ---------------------------------------------------------------------------
vi.mock('@ui/sidebar', () => ({
  SidebarSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarHeading: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  SidebarItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
  SidebarLabel: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

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
  // FK badge
  // -------------------------------------------------------------------------
  it('shows FK badge for foreign key columns', () => {
    render(<SchemaBrowser schema={mockSchema} />)

    fireEvent.click(screen.getByText('orders'))

    // FK badge should appear for user_id
    expect(screen.getByText(/fk/i)).toBeInTheDocument()
  })

  it('does not show FK badge for non-FK columns', () => {
    render(<SchemaBrowser schema={mockSchema} />)

    fireEvent.click(screen.getByText('users'))

    // users table has no FK columns
    expect(screen.queryByText(/fk/i)).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // FK badge tooltip / content — shows referenced table.column
  // -------------------------------------------------------------------------
  it('FK badge shows the referenced table and column', () => {
    render(<SchemaBrowser schema={mockSchema} />)

    fireEvent.click(screen.getByText('orders'))

    // The badge should reference users.id
    expect(screen.getByText(/users\.id/i)).toBeInTheDocument()
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
})
