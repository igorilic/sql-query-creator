import { Client } from 'pg'
import type { ConnectionConfig } from '@repo/shared/types'
import type { DatabaseClient } from './types'

/** Typed error thrown when a PostgreSQL connection attempt fails. */
export class PostgresConnectionError extends Error {
  override readonly name = 'PostgresConnectionError'

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
  }
}

/**
 * Create and open a PostgreSQL connection from the given config.
 * Returns a {@link DatabaseClient} adapter so callers do not depend on `pg`
 * internals — the underlying `pg.Client` is fully encapsulated.
 *
 * @throws {PostgresConnectionError} when the underlying pg client cannot connect.
 */
export async function connectPostgres(config: ConnectionConfig): Promise<DatabaseClient> {
  const client = new Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
  })

  try {
    await client.connect()
    return {
      disconnect: async () => {
        await client.end()
      },
    }
  } catch (err) {
    const cause = err instanceof Error ? err : new Error(String(err))
    throw new PostgresConnectionError(cause.message, { cause })
  }
}
