/**
 * Minimal interface for a database client, implemented by both
 * the PostgreSQL (pg.Client) and SQLite (better-sqlite3.Database) adapters.
 */
export interface DatabaseClient {
  /** Disconnect / close the underlying connection. */
  disconnect(): Promise<void>
}
