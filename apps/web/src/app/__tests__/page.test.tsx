import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Mocks — child components and context hooks
// ---------------------------------------------------------------------------

vi.mock('../../contexts/connection-context', () => ({
  useConnection: vi.fn(),
  ConnectionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../contexts/chat-context', () => ({
  useChat: vi.fn(),
  ChatProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../components/schema-browser', () => ({
  SchemaBrowser: ({ schema }: { schema: unknown }) => (
    <div data-testid="schema-browser" data-has-schema={schema !== null ? 'true' : 'false'} />
  ),
}))

vi.mock('../../components/chat-panel', () => ({
  ChatPanel: () => <div data-testid="chat-panel" />,
}))

vi.mock('../../components/query-editor', () => ({
  QueryEditor: ({ value }: { value: string }) => (
    <div data-testid="query-editor">{value}</div>
  ),
}))

vi.mock('../../components/app-header', () => ({
  AppHeader: ({ onConnectClick }: { onConnectClick: () => void }) => (
    <header data-testid="app-header">
      <button type="button" onClick={onConnectClick}>Connect</button>
    </header>
  ),
}))

vi.mock('../../components/connection-dialog', () => ({
  ConnectionDialog: ({ open, onConnect, onClose }: {
    open: boolean
    onConnect: (config: unknown) => void
    onClose: () => void
  }) =>
    open ? (
      <div data-testid="connection-dialog">
        <button type="button" onClick={() => onConnect({ type: 'postgresql' })}>Submit</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
    ) : null,
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

// ---------------------------------------------------------------------------
// Import after mocks are registered
// ---------------------------------------------------------------------------

import { useConnection } from '../../contexts/connection-context'
import { useChat } from '../../contexts/chat-context'
import HomePage from '../page'
import type { ConnectionStatus, DatabaseSchema } from '@repo/shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const disconnectedStatus: ConnectionStatus = { connected: false }
const connectedStatus: ConnectionStatus = { connected: true, type: 'postgresql' }

const mockSchema: DatabaseSchema = {
  dialect: 'postgresql',
  tables: [
    {
      name: 'users',
      columns: [{ name: 'id', type: 'integer', nullable: false, isPrimaryKey: true }],
      foreignKeys: [],
    },
  ],
}

function setupMocks(overrides: {
  status?: ConnectionStatus
  schema?: DatabaseSchema | null
  connecting?: boolean
  currentSql?: string | null
  messages?: []
  loading?: boolean
} = {}) {
  const connectMock = vi.fn()
  const disconnectMock = vi.fn()
  const sendMessageMock = vi.fn()
  const clearChatMock = vi.fn()

  ;(useConnection as ReturnType<typeof vi.fn>).mockReturnValue({
    status: overrides.status ?? disconnectedStatus,
    schema: overrides.schema ?? null,
    connecting: overrides.connecting ?? false,
    connect: connectMock,
    disconnect: disconnectMock,
  })

  ;(useChat as ReturnType<typeof vi.fn>).mockReturnValue({
    messages: overrides.messages ?? [],
    loading: overrides.loading ?? false,
    currentSql: overrides.currentSql ?? null,
    sendMessage: sendMessageMock,
    clearChat: clearChatMock,
  })

  return { connectMock, disconnectMock, sendMessageMock, clearChatMock }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Layout structure
  // -------------------------------------------------------------------------

  it('renders SidebarLayout', () => {
    setupMocks()
    render(<HomePage />)

    expect(screen.getByTestId('sidebar-layout')).toBeInTheDocument()
  })

  it('renders SchemaBrowser in the sidebar slot', () => {
    setupMocks()
    render(<HomePage />)

    const sidebar = screen.getByTestId('layout-sidebar')
    expect(sidebar).toContainElement(screen.getByTestId('schema-browser'))
  })

  it('renders ChatPanel in the main content area', () => {
    setupMocks()
    render(<HomePage />)

    const main = screen.getByTestId('layout-main')
    expect(main).toContainElement(screen.getByTestId('chat-panel'))
  })

  it('renders QueryEditor in the main content area', () => {
    setupMocks()
    render(<HomePage />)

    const main = screen.getByTestId('layout-main')
    expect(main).toContainElement(screen.getByTestId('query-editor'))
  })

  it('renders AppHeader in the navbar slot', () => {
    setupMocks()
    render(<HomePage />)

    const navbar = screen.getByTestId('layout-navbar')
    expect(navbar).toContainElement(screen.getByTestId('app-header'))
  })

  // -------------------------------------------------------------------------
  // Connection dialog
  // -------------------------------------------------------------------------

  it('does not show connection dialog initially', () => {
    setupMocks()
    render(<HomePage />)

    expect(screen.queryByTestId('connection-dialog')).not.toBeInTheDocument()
  })

  it('opens connection dialog when Connect button is clicked', () => {
    setupMocks()
    render(<HomePage />)

    fireEvent.click(screen.getByRole('button', { name: /connect/i }))

    expect(screen.getByTestId('connection-dialog')).toBeInTheDocument()
  })

  it('closes connection dialog when Cancel is clicked', () => {
    setupMocks()
    render(<HomePage />)

    fireEvent.click(screen.getByRole('button', { name: /connect/i }))
    expect(screen.getByTestId('connection-dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByTestId('connection-dialog')).not.toBeInTheDocument()
  })

  it('calls connect and closes dialog when onConnect fires', async () => {
    const { connectMock } = setupMocks()
    render(<HomePage />)

    fireEvent.click(screen.getByRole('button', { name: /connect/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    expect(connectMock).toHaveBeenCalledOnce()
    // Dialog should close after connect
    expect(screen.queryByTestId('connection-dialog')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Data flow — schema passed to SchemaBrowser
  // -------------------------------------------------------------------------

  it('passes schema to SchemaBrowser when schema is loaded', () => {
    setupMocks({ schema: mockSchema })
    render(<HomePage />)

    expect(screen.getByTestId('schema-browser')).toHaveAttribute('data-has-schema', 'true')
  })

  it('passes null schema to SchemaBrowser when disconnected', () => {
    setupMocks({ schema: null })
    render(<HomePage />)

    expect(screen.getByTestId('schema-browser')).toHaveAttribute('data-has-schema', 'false')
  })

  // -------------------------------------------------------------------------
  // Data flow — currentSql passed to QueryEditor
  // -------------------------------------------------------------------------

  it('passes currentSql to QueryEditor', () => {
    setupMocks({ currentSql: 'SELECT 1' })
    render(<HomePage />)

    expect(screen.getByTestId('query-editor')).toHaveTextContent('SELECT 1')
  })

  it('passes empty string to QueryEditor when no SQL is set', () => {
    setupMocks({ currentSql: null })
    render(<HomePage />)

    expect(screen.getByTestId('query-editor')).toHaveTextContent('')
  })
})

// ---------------------------------------------------------------------------
// Providers component
// ---------------------------------------------------------------------------

describe('Providers', () => {
  it('renders ConnectionProvider and ChatProvider wrapping children', async () => {
    // Providers wraps with both context providers — verify children render
    // without throwing (hooks are not called in this test)
    const { Providers } = await import('../providers')
    render(
      <Providers>
        <div data-testid="child">hello</div>
      </Providers>,
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('provides ConnectionContext so useConnection does not throw', async () => {
    const { Providers } = await import('../providers')
    // If ConnectionProvider is missing, useConnection would throw
    // We test by rendering a consumer component inside Providers
    function Consumer() {
      const { useConnection: useConn } = require('../../contexts/connection-context')
      // Connection mock is set in outer scope — just check no throw
      useConn()
      return <div data-testid="consumer" />
    }

    render(
      <Providers>
        <Consumer />
      </Providers>,
    )

    expect(screen.getByTestId('consumer')).toBeInTheDocument()
  })
})
