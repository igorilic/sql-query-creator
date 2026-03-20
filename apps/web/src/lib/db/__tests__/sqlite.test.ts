import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock better-sqlite3 before any imports so the constructor is intercepted
vi.mock('better-sqlite3', () => {
  const mockDb = {
    close: vi.fn(),
    prepare: vi.fn(),
  }
  const MockDatabase = vi.fn(() => mockDb)
  return { default: MockDatabase }
})

import Database from 'better-sqlite3'
import { connectSqlite, SqliteConnectionError } from '../sqlite'
import type { ConnectionConfig } from '@repo/shared/types'

const validSqliteConfig: ConnectionConfig = {
  type: 'sqlite',
  filePath: '/tmp/test.db',
}

describe('connectSqlite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a DatabaseClient with a disconnect method on success', async () => {
    const client = await connectSqlite(validSqliteConfig)

    expect(Database).toHaveBeenCalledWith('/tmp/test.db')
    expect(client).toBeDefined()
    expect(typeof client.disconnect).toBe('function')
  })

  it('throws a SqliteConnectionError when the constructor throws (nonexistent path)', async () => {
    ;(Database as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('SQLITE_CANTOPEN: unable to open database file')
    })

    await expect(connectSqlite(validSqliteConfig)).rejects.toMatchObject({
      name: 'SqliteConnectionError',
      message: expect.stringContaining('SQLITE_CANTOPEN'),
    })
  })

  it('throws a SqliteConnectionError when filePath is missing', async () => {
    const configWithoutPath: ConnectionConfig = {
      type: 'sqlite',
    }

    await expect(connectSqlite(configWithoutPath)).rejects.toMatchObject({
      name: 'SqliteConnectionError',
    })
  })

  it('includes the original error as cause in the thrown error', async () => {
    const originalError = new Error('SQLITE_CANTOPEN: unable to open database file')
    ;(Database as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw originalError
    })

    await expect(connectSqlite(validSqliteConfig)).rejects.toMatchObject({
      name: 'SqliteConnectionError',
      cause: originalError,
    })
  })
})

describe('DatabaseClient returned by connectSqlite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls close() on the underlying Database when disconnect() is called', async () => {
    const mockClose = vi.fn()
    ;(Database as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      close: mockClose,
    }))

    const client = await connectSqlite(validSqliteConfig)
    await client.disconnect()

    expect(mockClose).toHaveBeenCalledOnce()
  })

  it('resolves without throwing when disconnect() succeeds', async () => {
    ;(Database as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      close: vi.fn(),
    }))

    const client = await connectSqlite(validSqliteConfig)
    await expect(client.disconnect()).resolves.toBeUndefined()
  })

  it('propagates the error when the underlying close() throws', async () => {
    const closeError = new Error('database disk image is malformed')
    ;(Database as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      close: vi.fn(() => {
        throw closeError
      }),
    }))

    const client = await connectSqlite(validSqliteConfig)
    await expect(client.disconnect()).rejects.toThrow('database disk image is malformed')
  })
})

describe('SqliteConnectionError', () => {
  it('has name set to SqliteConnectionError', () => {
    const err = new SqliteConnectionError('test error')
    expect(err.name).toBe('SqliteConnectionError')
  })

  it('is an instance of Error', () => {
    const err = new SqliteConnectionError('test error')
    expect(err).toBeInstanceOf(Error)
  })
})
