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

// Typed helper to access the mocked Database constructor
const MockDatabase = Database as unknown as ReturnType<typeof vi.fn>

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

    expect(MockDatabase).toHaveBeenCalledWith('/tmp/test.db')
    expect(client).toBeDefined()
    expect(typeof client.disconnect).toBe('function')
  })

  it('throws a SqliteConnectionError when the constructor throws (nonexistent path)', async () => {
    MockDatabase.mockImplementationOnce(() => {
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

  it('throws a SqliteConnectionError when filePath is an empty string', async () => {
    const configEmptyPath: ConnectionConfig = {
      type: 'sqlite',
      filePath: '',
    }

    await expect(connectSqlite(configEmptyPath)).rejects.toMatchObject({
      name: 'SqliteConnectionError',
    })
  })

  it('throws a SqliteConnectionError when config.type is not sqlite', async () => {
    const wrongTypeConfig: ConnectionConfig = {
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      username: 'user',
      password: 'pass',
    }

    await expect(connectSqlite(wrongTypeConfig)).rejects.toMatchObject({
      name: 'SqliteConnectionError',
      message: expect.stringContaining('sqlite'),
    })
  })

  it('includes the original error as cause in the thrown error', async () => {
    const originalError = new Error('SQLITE_CANTOPEN: unable to open database file')
    MockDatabase.mockImplementationOnce(() => {
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
    MockDatabase.mockImplementationOnce(() => ({ close: mockClose }))

    const client = await connectSqlite(validSqliteConfig)
    await client.disconnect()

    expect(mockClose).toHaveBeenCalledOnce()
  })

  it('resolves without throwing when disconnect() succeeds', async () => {
    MockDatabase.mockImplementationOnce(() => ({ close: vi.fn() }))

    const client = await connectSqlite(validSqliteConfig)
    await expect(client.disconnect()).resolves.toBeUndefined()
  })

  it('throws a SqliteConnectionError when the underlying close() throws', async () => {
    const closeError = new Error('database disk image is malformed')
    MockDatabase.mockImplementationOnce(() => ({
      close: vi.fn(() => { throw closeError }),
    }))

    const client = await connectSqlite(validSqliteConfig)
    await expect(client.disconnect()).rejects.toMatchObject({
      name: 'SqliteConnectionError',
      message: expect.stringContaining('database disk image is malformed'),
      cause: closeError,
    })
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
