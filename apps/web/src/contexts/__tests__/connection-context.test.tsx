import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import React from 'react'
import { ConnectionProvider, useConnection } from '../connection-context'
import type { ConnectionConfig } from '@repo/shared/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const pgConfig: ConnectionConfig = {
  type: 'postgresql',
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  username: 'user',
  password: 'pass',
}

const mockSchema = {
  tables: [
    { name: 'users', columns: [{ name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true }] },
  ],
  dialect: 'postgresql' as const,
}

// ---------------------------------------------------------------------------
// Helper component to consume the context in tests
// ---------------------------------------------------------------------------

function TestConsumer() {
  const { status, schema, connecting, connect, disconnect } = useConnection()
  return (
    <div>
      <span data-testid="connected">{String(status.connected)}</span>
      <span data-testid="type">{status.type ?? 'none'}</span>
      <span data-testid="error">{status.error ?? ''}</span>
      <span data-testid="connecting">{String(connecting)}</span>
      <span data-testid="schema-tables">{schema ? String(schema.tables.length) : 'null'}</span>
      <button
        data-testid="connect-btn"
        onClick={() => connect(pgConfig)}
      >
        Connect
      </button>
      <button
        data-testid="disconnect-btn"
        onClick={() => disconnect()}
      >
        Disconnect
      </button>
    </div>
  )
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ConnectionProvider>{children}</ConnectionProvider>
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConnectionContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------
  it('starts in disconnected state with no schema', () => {
    render(<TestConsumer />, { wrapper: Wrapper })

    expect(screen.getByTestId('connected').textContent).toBe('false')
    expect(screen.getByTestId('type').textContent).toBe('none')
    expect(screen.getByTestId('error').textContent).toBe('')
    expect(screen.getByTestId('schema-tables').textContent).toBe('null')
  })

  // -------------------------------------------------------------------------
  // Successful connection
  // -------------------------------------------------------------------------
  it('updates status to connected and populates schema after successful connect()', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'connected', type: 'postgresql' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockSchema), { status: 200 }),
      )

    render(<TestConsumer />, { wrapper: Wrapper })

    await act(async () => {
      screen.getByTestId('connect-btn').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('connected').textContent).toBe('true')
    })

    expect(screen.getByTestId('type').textContent).toBe('postgresql')
    expect(screen.getByTestId('error').textContent).toBe('')
    expect(screen.getByTestId('schema-tables').textContent).toBe('1')
  })

  // -------------------------------------------------------------------------
  // Connection error from API
  // -------------------------------------------------------------------------
  it('updates status with error message when /api/connect returns an error response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'error', error: 'Connection refused' }), { status: 502 }),
    )

    render(<TestConsumer />, { wrapper: Wrapper })

    await act(async () => {
      screen.getByTestId('connect-btn').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('Connection refused')
    })

    expect(screen.getByTestId('connected').textContent).toBe('false')
    expect(screen.getByTestId('schema-tables').textContent).toBe('null')
  })

  // -------------------------------------------------------------------------
  // Network error
  // -------------------------------------------------------------------------
  it('updates status with error message when fetch throws (network error)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    render(<TestConsumer />, { wrapper: Wrapper })

    await act(async () => {
      screen.getByTestId('connect-btn').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('Network error')
    })

    expect(screen.getByTestId('connected').textContent).toBe('false')
  })

  // -------------------------------------------------------------------------
  // Disconnect
  // -------------------------------------------------------------------------
  it('resets to disconnected state after disconnect()', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'connected', type: 'postgresql' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockSchema), { status: 200 }),
      )

    render(<TestConsumer />, { wrapper: Wrapper })

    await act(async () => {
      screen.getByTestId('connect-btn').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('connected').textContent).toBe('true')
    })

    act(() => {
      screen.getByTestId('disconnect-btn').click()
    })

    expect(screen.getByTestId('connected').textContent).toBe('false')
    expect(screen.getByTestId('type').textContent).toBe('none')
    expect(screen.getByTestId('schema-tables').textContent).toBe('null')
  })

  // -------------------------------------------------------------------------
  // Schema fetch failure (connection succeeds but schema fails)
  // -------------------------------------------------------------------------
  it('is connected but schema is null when /api/schema fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'connected', type: 'sqlite' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'No connection' }), { status: 404 }),
      )

    render(<TestConsumer />, { wrapper: Wrapper })

    await act(async () => {
      screen.getByTestId('connect-btn').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('connected').textContent).toBe('true')
    })

    expect(screen.getByTestId('schema-tables').textContent).toBe('null')
  })

  // -------------------------------------------------------------------------
  // useConnection throws outside provider
  // -------------------------------------------------------------------------
  it('throws when useConnection is used outside ConnectionProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<TestConsumer />)).toThrow()

    spy.mockRestore()
  })

  // -------------------------------------------------------------------------
  // Loading / connecting state (Issue 1)
  // -------------------------------------------------------------------------
  it('exposes connecting=true while connect() is in-flight, then false after resolve', async () => {
    let resolveConnect!: (value: Response) => void
    const connectPromise = new Promise<Response>((res) => {
      resolveConnect = res
    })

    vi.spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(connectPromise)
      // Mock the subsequent /api/schema fetch so it does not bleed into the next test.
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ tables: [], dialect: 'postgresql' }), { status: 200 }),
      )

    render(<TestConsumer />, { wrapper: Wrapper })

    // Start connect — do NOT await
    act(() => {
      screen.getByTestId('connect-btn').click()
    })

    // Should be connecting
    await waitFor(() => {
      expect(screen.getByTestId('connecting').textContent).toBe('true')
    })

    // Resolve the fetch
    await act(async () => {
      resolveConnect(new Response(JSON.stringify({ status: 'connected', type: 'postgresql' }), { status: 200 }))
    })

    // Connecting flag should clear
    await waitFor(() => {
      expect(screen.getByTestId('connecting').textContent).toBe('false')
    })
  })

  it('exposes connecting=false after connect() resolves with an error', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'error', error: 'refused' }), { status: 502 }),
      )
      // Guard: /api/schema must NOT be called on a connection error (early return).
      // If this mock is consumed it means the context leaked a schema fetch after failure.
      .mockRejectedValueOnce(new Error('[test] Unexpected /api/schema fetch after connection error'))

    render(<TestConsumer />, { wrapper: Wrapper })

    await act(async () => {
      screen.getByTestId('connect-btn').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('connecting').textContent).toBe('false')
    })
    expect(screen.getByTestId('error').textContent).toBe('refused')
  })

  // -------------------------------------------------------------------------
  // Schema validation (Issue 3)
  // -------------------------------------------------------------------------
  it('does not dispatch SCHEMA_LOADED when /api/schema returns a malformed body', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'connected', type: 'postgresql' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        // Missing required `dialect` field → isValidSchema returns false
        new Response(JSON.stringify({ tables: [] }), { status: 200 }),
      )

    render(<TestConsumer />, { wrapper: Wrapper })

    await act(async () => {
      screen.getByTestId('connect-btn').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('connected').textContent).toBe('true')
    })

    // Schema should stay null because body failed validation
    expect(screen.getByTestId('schema-tables').textContent).toBe('null')
  })
})
