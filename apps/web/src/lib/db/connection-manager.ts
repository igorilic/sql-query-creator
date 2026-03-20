import { connectPostgres } from './postgres'
import { connectSqlite } from './sqlite'
import type { DatabaseClient } from './types'
import type { ConnectionConfig, ConnectionStatus } from '@repo/shared/types'

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
      await this.activeClient.disconnect()
      this.activeClient = null
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

    return this.status
  }

  /**
   * Close the active connection and reset status to disconnected.
   * Safe to call when no connection is open.
   */
  async disconnect(): Promise<void> {
    if (!this.activeClient) {
      return
    }

    await this.activeClient.disconnect()
    this.activeClient = null
    this.status = { connected: false }
  }

  /** Return a snapshot of the current connection status. */
  getStatus(): ConnectionStatus {
    return this.status
  }
}
