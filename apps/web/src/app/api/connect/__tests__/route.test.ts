import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the connection manager singleton BEFORE importing the route
vi.mock('../../../../lib/db/connection-manager', () => ({
  connectionManager: {
    connect: vi.fn(),
  },
}))

import { POST } from '../route'
import { connectionManager } from '../../../../lib/db/connection-manager'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validPgConfig = {
  type: 'postgresql',
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  username: 'user',
  password: 'pass',
}

const validSqliteConfig = {
  type: 'sqlite',
  filePath: '/tmp/test.db',
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/connect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Happy path — PostgreSQL
  // -------------------------------------------------------------------------
  it('returns 200 with connected status for a valid PostgreSQL config', async () => {
    vi.mocked(connectionManager.connect).mockResolvedValueOnce({
      connected: true,
      type: 'postgresql',
    })

    const response = await POST(makeRequest(validPgConfig))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ status: 'connected', type: 'postgresql' })
  })

  // -------------------------------------------------------------------------
  // Happy path — SQLite
  // -------------------------------------------------------------------------
  it('returns 200 with connected status for a valid SQLite config', async () => {
    vi.mocked(connectionManager.connect).mockResolvedValueOnce({
      connected: true,
      type: 'sqlite',
    })

    const response = await POST(makeRequest(validSqliteConfig))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ status: 'connected', type: 'sqlite' })
  })

  // -------------------------------------------------------------------------
  // Validation — invalid config
  // -------------------------------------------------------------------------
  it('returns 400 when the request body has no type field', async () => {
    const response = await POST(makeRequest({ host: 'localhost', database: 'db' }))

    expect(response.status).toBe(400)
    expect(connectionManager.connect).not.toHaveBeenCalled()
  })

  it('returns 400 when the type field is unrecognised', async () => {
    const response = await POST(makeRequest({ type: 'mysql', host: 'localhost' }))

    expect(response.status).toBe(400)
    expect(connectionManager.connect).not.toHaveBeenCalled()
  })

  it('returns 400 when the body is not valid JSON', async () => {
    const request = new Request('http://localhost/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  // -------------------------------------------------------------------------
  // Connection failure
  // -------------------------------------------------------------------------
  it('returns error body when the connection manager reports a failure', async () => {
    vi.mocked(connectionManager.connect).mockResolvedValueOnce({
      connected: false,
      error: 'Connection refused',
    })

    const response = await POST(makeRequest(validPgConfig))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ status: 'error', error: 'Connection refused' })
  })

  it('passes the parsed config object to connectionManager.connect', async () => {
    vi.mocked(connectionManager.connect).mockResolvedValueOnce({
      connected: true,
      type: 'postgresql',
    })

    await POST(makeRequest(validPgConfig))

    expect(connectionManager.connect).toHaveBeenCalledWith(validPgConfig)
  })
})
