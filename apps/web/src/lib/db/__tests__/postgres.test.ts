import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock pg before any imports so the Client constructor is intercepted
vi.mock('pg', () => {
  const mockClient = {
    connect: vi.fn(),
    end: vi.fn(),
    query: vi.fn(),
  }
  return {
    default: { Client: vi.fn(() => mockClient) },
    Client: vi.fn(() => mockClient),
  }
})

import { Client } from 'pg'
import { connectPostgres, PostgresConnectionError } from '../postgres'
import type { ConnectionConfig } from '@repo/shared/types'

const validPgConfig: ConnectionConfig = {
  type: 'postgresql',
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  username: 'testuser',
  password: 'testpass',
}

describe('connectPostgres', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a DatabaseClient with a disconnect method on success', async () => {
    ;(Client as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      end: vi.fn().mockResolvedValue(undefined),
    }))

    const client = await connectPostgres(validPgConfig)

    expect(Client).toHaveBeenCalledWith({
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      user: 'testuser',
      password: 'testpass',
    })
    expect(client).toBeDefined()
    expect(typeof client.disconnect).toBe('function')
  })

  it('throws a PostgresConnectionError when connection fails', async () => {
    ;(Client as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      connect: vi.fn().mockRejectedValue(new Error('password authentication failed')),
      end: vi.fn(),
    }))

    await expect(connectPostgres(validPgConfig)).rejects.toMatchObject({
      name: 'PostgresConnectionError',
      message: expect.stringContaining('password authentication failed'),
    })
  })

  it('throws a PostgresConnectionError for connection refused', async () => {
    ;(Client as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      connect: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432')),
      end: vi.fn(),
    }))

    await expect(connectPostgres(validPgConfig)).rejects.toMatchObject({
      name: 'PostgresConnectionError',
    })
  })

  it('includes the original error cause in the thrown error', async () => {
    const originalError = new Error('FATAL: role "baduser" does not exist')
    ;(Client as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      connect: vi.fn().mockRejectedValue(originalError),
      end: vi.fn(),
    }))

    await expect(connectPostgres(validPgConfig)).rejects.toMatchObject({
      name: 'PostgresConnectionError',
      cause: originalError,
    })
  })
})

describe('DatabaseClient returned by connectPostgres', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls end() on the underlying pg.Client when disconnect() is called', async () => {
    const mockEnd = vi.fn().mockResolvedValue(undefined)
    ;(Client as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      end: mockEnd,
    }))

    const client = await connectPostgres(validPgConfig)
    await client.disconnect()

    expect(mockEnd).toHaveBeenCalledOnce()
  })

  it('resolves without throwing when disconnect() succeeds', async () => {
    ;(Client as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      end: vi.fn().mockResolvedValue(undefined),
    }))

    const client = await connectPostgres(validPgConfig)
    await expect(client.disconnect()).resolves.toBeUndefined()
  })

  it('throws a PostgresConnectionError when the underlying end() rejects', async () => {
    const endError = new Error('connection terminated unexpectedly')
    ;(Client as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      end: vi.fn().mockRejectedValue(endError),
    }))

    const client = await connectPostgres(validPgConfig)
    await expect(client.disconnect()).rejects.toMatchObject({
      name: 'PostgresConnectionError',
      message: expect.stringContaining('connection terminated unexpectedly'),
      cause: endError,
    })
  })
})

describe('PostgresConnectionError', () => {
  it('has name set to PostgresConnectionError', () => {
    const err = new PostgresConnectionError('test error')
    expect(err.name).toBe('PostgresConnectionError')
  })

  it('is an instance of Error', () => {
    const err = new PostgresConnectionError('test error')
    expect(err).toBeInstanceOf(Error)
  })
})
