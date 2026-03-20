import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the connection manager singleton BEFORE importing the route
vi.mock('../../../../lib/db/connection-manager', () => ({
  connectionManager: {
    getStatus: vi.fn(),
    getSchema: vi.fn(),
  },
}))

import { GET } from '../route'
import { connectionManager } from '../../../../lib/db/connection-manager'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const postgresSchema = {
  dialect: 'postgresql' as const,
  tables: [
    {
      name: 'users',
      columns: [
        { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true },
        { name: 'email', dataType: 'varchar', nullable: false, isPrimaryKey: false },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/schema', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Happy path — connected
  // -------------------------------------------------------------------------
  it('returns 200 with schema JSON when connected', async () => {
    vi.mocked(connectionManager.getStatus).mockReturnValue({ connected: true, type: 'postgresql' })
    vi.mocked(connectionManager.getSchema).mockResolvedValueOnce(postgresSchema)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual(postgresSchema)
  })

  it('calls getSchema() when connected', async () => {
    vi.mocked(connectionManager.getStatus).mockReturnValue({ connected: true, type: 'sqlite' })
    vi.mocked(connectionManager.getSchema).mockResolvedValueOnce({
      dialect: 'sqlite',
      tables: [],
    })

    await GET()

    expect(connectionManager.getSchema).toHaveBeenCalledOnce()
  })

  // -------------------------------------------------------------------------
  // Not connected — 404
  // -------------------------------------------------------------------------
  it('returns 404 when not connected', async () => {
    vi.mocked(connectionManager.getStatus).mockReturnValue({ connected: false })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBeDefined()
  })

  it('does not call getSchema() when not connected', async () => {
    vi.mocked(connectionManager.getStatus).mockReturnValue({ connected: false })

    await GET()

    expect(connectionManager.getSchema).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Introspection failure — 500
  // -------------------------------------------------------------------------
  it('returns 500 when getSchema() throws', async () => {
    vi.mocked(connectionManager.getStatus).mockReturnValue({ connected: true, type: 'postgresql' })
    vi.mocked(connectionManager.getSchema).mockRejectedValueOnce(
      new Error('introspection failed'),
    )

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBeDefined()
  })

  it('includes the error message in the 500 response', async () => {
    vi.mocked(connectionManager.getStatus).mockReturnValue({ connected: true, type: 'postgresql' })
    vi.mocked(connectionManager.getSchema).mockRejectedValueOnce(
      new Error('permission denied'),
    )

    const response = await GET()
    const body = await response.json()

    expect(body.error).toContain('permission denied')
  })
})
