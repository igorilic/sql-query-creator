import Database from 'better-sqlite3'
import type { ConnectionConfig } from '@repo/shared/types'
import type { DatabaseClient } from './types'

/** Typed error thrown when a SQLite connection attempt fails or is closed unexpectedly. */
export class SqliteConnectionError extends Error {
  override readonly name = 'SqliteConnectionError'

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
  }
}

/**
 * Open a SQLite database from the given config.
 * Returns a {@link DatabaseClient} adapter so callers do not depend on
 * `better-sqlite3` internals — the underlying Database instance is fully
 * encapsulated.
 *
 * Declared `async` to keep the signature consistent with `connectPostgres`
 * even though `better-sqlite3` opens connections synchronously.
 *
 * @throws {SqliteConnectionError} when config.type is not 'sqlite', filePath
 *   is missing, or the database cannot be opened.
 */
export async function connectSqlite(config: ConnectionConfig): Promise<DatabaseClient> {
  if (config.type !== 'sqlite') {
    throw new SqliteConnectionError(
      `connectSqlite requires config.type to be 'sqlite', got '${config.type}'`,
    )
  }

  if (!config.filePath) {
    throw new SqliteConnectionError('filePath is required for a SQLite connection')
  }

  let db: Database.Database

  try {
    db = new Database(config.filePath)
  } catch (err) {
    const cause = err instanceof Error ? err : new Error(String(err))
    throw new SqliteConnectionError(cause.message, { cause })
  }

  return {
    disconnect: async () => {
      try {
        db.close()
      } catch (err) {
        const cause = err instanceof Error ? err : new Error(String(err))
        throw new SqliteConnectionError(cause.message, { cause })
      }
    },
  }
}
