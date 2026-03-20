import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the low-level services before any imports
vi.mock('../postgres', () => ({
  connectPostgres: vi.fn(),
}))
vi.mock('../sqlite', () => ({
  connectSqlite: vi.fn(),
}))

import { connectPostgres } from '../postgres'
import { connectSqlite } from '../sqlite'
import { ConnectionManager } from '../connection-manager'
import type { ConnectionConfig } from '@repo/shared/types'

const pgConfig: ConnectionConfig = {
  type: 'postgresql',
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  username: 'user',
  password: 'pass',
}

const sqliteConfig: ConnectionConfig = {
  type: 'sqlite',
  filePath: '/tmp/test.db',
}

describe('ConnectionManager', () => {
  let manager: ConnectionManager

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new ConnectionManager()
  })

  // -------------------------------------------------------------------------
  // getStatus
  // -------------------------------------------------------------------------
  describe('getStatus', () => {
    it('returns disconnected status initially', () => {
      expect(manager.getStatus()).toEqual({ connected: false })
    })
  })

  // -------------------------------------------------------------------------
  // connect — delegation
  // -------------------------------------------------------------------------
  describe('connect — delegation', () => {
    it('delegates to connectPostgres for a PostgreSQL config', async () => {
      vi.mocked(connectPostgres).mockResolvedValueOnce({ disconnect: vi.fn(), introspect: vi.fn() })

      await manager.connect(pgConfig)

      expect(connectPostgres).toHaveBeenCalledWith(pgConfig)
      expect(connectSqlite).not.toHaveBeenCalled()
    })

    it('delegates to connectSqlite for a SQLite config', async () => {
      vi.mocked(connectSqlite).mockResolvedValueOnce({ disconnect: vi.fn(), introspect: vi.fn() })

      await manager.connect(sqliteConfig)

      expect(connectSqlite).toHaveBeenCalledWith(sqliteConfig)
      expect(connectPostgres).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // connect — status updates
  // -------------------------------------------------------------------------
  describe('connect — returned status', () => {
    it('returns connected status with type postgresql after a successful PG connection', async () => {
      vi.mocked(connectPostgres).mockResolvedValueOnce({ disconnect: vi.fn(), introspect: vi.fn() })

      const status = await manager.connect(pgConfig)

      expect(status).toEqual({ connected: true, type: 'postgresql' })
    })

    it('returns connected status with type sqlite after a successful SQLite connection', async () => {
      vi.mocked(connectSqlite).mockResolvedValueOnce({ disconnect: vi.fn(), introspect: vi.fn() })

      const status = await manager.connect(sqliteConfig)

      expect(status).toEqual({ connected: true, type: 'sqlite' })
    })

    it('returns error status when connectPostgres rejects', async () => {
      vi.mocked(connectPostgres).mockRejectedValueOnce(new Error('Connection refused'))

      const status = await manager.connect(pgConfig)

      expect(status).toEqual({ connected: false, error: 'Connection refused' })
    })

    it('returns error status when connectSqlite rejects', async () => {
      vi.mocked(connectSqlite).mockRejectedValueOnce(
        new Error('SQLITE_CANTOPEN: unable to open database file'),
      )

      const status = await manager.connect(sqliteConfig)

      expect(status).toEqual({
        connected: false,
        error: 'SQLITE_CANTOPEN: unable to open database file',
      })
    })
  })

  // -------------------------------------------------------------------------
  // connect — getStatus side-effects
  // -------------------------------------------------------------------------
  describe('connect — getStatus side-effects', () => {
    it('getStatus reflects connected state after a successful connection', async () => {
      vi.mocked(connectPostgres).mockResolvedValueOnce({ disconnect: vi.fn(), introspect: vi.fn() })

      await manager.connect(pgConfig)

      expect(manager.getStatus()).toEqual({ connected: true, type: 'postgresql' })
    })

    it('getStatus reflects error state when connection fails', async () => {
      vi.mocked(connectPostgres).mockRejectedValueOnce(new Error('ECONNREFUSED'))

      await manager.connect(pgConfig)

      expect(manager.getStatus()).toEqual({ connected: false, error: 'ECONNREFUSED' })
    })
  })

  // -------------------------------------------------------------------------
  // connect — single-connection enforcement
  // -------------------------------------------------------------------------
  describe('connect — single-connection enforcement', () => {
    it('closes the previous connection before opening a new one', async () => {
      const firstDisconnect = vi.fn().mockResolvedValue(undefined)
      vi.mocked(connectPostgres).mockResolvedValueOnce({ disconnect: firstDisconnect, introspect: vi.fn() })
      vi.mocked(connectSqlite).mockResolvedValueOnce({ disconnect: vi.fn(), introspect: vi.fn() })

      await manager.connect(pgConfig)
      await manager.connect(sqliteConfig)

      expect(firstDisconnect).toHaveBeenCalledOnce()
    })

    it('opens the second connection even after closing the first', async () => {
      vi.mocked(connectPostgres).mockResolvedValueOnce({ disconnect: vi.fn().mockResolvedValue(undefined), introspect: vi.fn() })
      vi.mocked(connectSqlite).mockResolvedValueOnce({ disconnect: vi.fn(), introspect: vi.fn() })

      await manager.connect(pgConfig)
      const status = await manager.connect(sqliteConfig)

      expect(connectSqlite).toHaveBeenCalledWith(sqliteConfig)
      expect(status).toEqual({ connected: true, type: 'sqlite' })
    })
  })

  // -------------------------------------------------------------------------
  // disconnect
  // -------------------------------------------------------------------------
  describe('disconnect', () => {
    it('calls disconnect on the active client', async () => {
      const mockDisconnect = vi.fn().mockResolvedValue(undefined)
      vi.mocked(connectPostgres).mockResolvedValueOnce({ disconnect: mockDisconnect, introspect: vi.fn() })

      await manager.connect(pgConfig)
      await manager.disconnect()

      expect(mockDisconnect).toHaveBeenCalledOnce()
    })

    it('updates getStatus to disconnected after disconnect', async () => {
      vi.mocked(connectPostgres).mockResolvedValueOnce({
        disconnect: vi.fn().mockResolvedValue(undefined),
        introspect: vi.fn(),
      })

      await manager.connect(pgConfig)
      await manager.disconnect()

      expect(manager.getStatus()).toEqual({ connected: false })
    })

    it('resolves without throwing when there is no active connection', async () => {
      await expect(manager.disconnect()).resolves.toBeUndefined()
    })

    it('sets error in status and rethrows when the underlying client.disconnect() throws', async () => {
      vi.mocked(connectPostgres).mockResolvedValueOnce({
        disconnect: vi.fn().mockRejectedValueOnce(new Error('socket hang up')),
        introspect: vi.fn(),
      })

      await manager.connect(pgConfig)

      await expect(manager.disconnect()).rejects.toThrow('socket hang up')

      // Manager must expose the error in status so callers can distinguish
      // a clean disconnect from a failed one.
      expect(manager.getStatus()).toEqual({ connected: false, error: 'socket hang up' })
    })
  })

  // -------------------------------------------------------------------------
  // connect — stale status when pre-disconnect throws
  // -------------------------------------------------------------------------
  describe('connect — pre-disconnect failure', () => {
    it('resets status to error state when the prior connection cannot be closed', async () => {
      const failingDisconnect = vi.fn().mockRejectedValueOnce(new Error('connection reset'))
      vi.mocked(connectPostgres).mockResolvedValueOnce({ disconnect: failingDisconnect, introspect: vi.fn() })

      await manager.connect(pgConfig)

      // Second connect attempt — first client's disconnect() will throw.
      // The manager must NOT leave status as "connected: true, type: 'postgresql'".
      vi.mocked(connectSqlite).mockResolvedValueOnce({ disconnect: vi.fn(), introspect: vi.fn() })
      await expect(manager.connect(sqliteConfig)).rejects.toThrow('connection reset')

      expect(manager.getStatus()).toEqual({ connected: false, error: 'connection reset' })
    })
  })

  // -------------------------------------------------------------------------
  // getStatus — snapshot isolation
  // -------------------------------------------------------------------------
  describe('getStatus — snapshot isolation', () => {
    it('returns a snapshot: mutating the returned object does not corrupt internal state', async () => {
      vi.mocked(connectPostgres).mockResolvedValueOnce({ disconnect: vi.fn(), introspect: vi.fn() })
      await manager.connect(pgConfig)

      const snapshot = manager.getStatus() as Record<string, unknown>
      snapshot.connected = false // caller mutates returned value

      // Internal state must be unaffected
      expect(manager.getStatus()).toEqual({ connected: true, type: 'postgresql' })
    })

    it('connect() returns a snapshot: mutating the result does not corrupt internal state', async () => {
      vi.mocked(connectPostgres).mockResolvedValueOnce({ disconnect: vi.fn(), introspect: vi.fn() })

      const result = (await manager.connect(pgConfig)) as Record<string, unknown>
      result.connected = false // caller mutates returned value

      // Internal state must be unaffected
      expect(manager.getStatus()).toEqual({ connected: true, type: 'postgresql' })
    })
  })
})
