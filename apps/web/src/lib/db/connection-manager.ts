import { connectPostgres } from './postgres'
import { connectSqlite } from './sqlite'
import type { DatabaseClient } from './types'
import type { ConnectionConfig, ConnectionStatus, DatabaseSchema } from '@repo/shared/types'

/**
 * Manages a single active database connection.
 *
 * Only one connection is open at a time. Calling {@link connect} while already
 * connected will close the existing connection before opening the new one.
 */
export class ConnectionManager {
  private activeClient: DatabaseClient | null = null
  private status: ConnectionStatus = { connected: false }

  /**
   * Open a connection for the given config, closing any existing connection
   * first. Updates and returns the new {@link ConnectionStatus}.
   */
  async connect(config: ConnectionConfig): Promise<ConnectionStatus> {
    if (this.activeClient) {
      const client = this.activeClient
      this.activeClient = null
      try {
        await client.disconnect()
      } catch (err) {
        // The old connection failed to close cleanly. Record the error in
        // status so callers can distinguish success from failure, then
        // rethrow — we cannot safely open a new connection when we don't
        // know whether the previous one is actually gone.
        const message = err instanceof Error ? err.message : String(err)
        this.status = { connected: false, error: message }
        throw err
      }
    }

    try {
      if (config.type === 'postgresql') {
        this.activeClient = await connectPostgres(config)
        this.status = { connected: true, type: 'postgresql' }
      } else {
        this.activeClient = await connectSqlite(config)
        this.status = { connected: true, type: 'sqlite' }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.status = { connected: false, error: message }
    }

    return { ...this.status }
  }

  /**
   * Close the active connection and reset status to disconnected.
   * Safe to call when no connection is open.
   */
  async disconnect(): Promise<void> {
    if (!this.activeClient) {
      return
    }

    const client = this.activeClient
    this.activeClient = null
    try {
      await client.disconnect()
      this.status = { connected: false }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.status = { connected: false, error: message }
      throw err
    }
  }

  /** Return a snapshot of the current connection status. */
  getStatus(): ConnectionStatus {
    return { ...this.status }
  }

  /**
   * Introspect the active connection and return its schema.
   * @throws if no connection is currently open.
   */
  async getSchema(): Promise<DatabaseSchema> {
    if (!this.activeClient) {
      throw new Error('Not connected to a database')
    }
    return this.activeClient.introspect()
  }
}

/**
 * Module-level singleton.
 *
 * Import this instance (not the class) in API routes and server-side code so
 * all callers share the same active connection state.
 */
export const connectionManager = new ConnectionManager()
