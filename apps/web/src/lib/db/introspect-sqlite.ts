import type { DatabaseSchema, TableInfo, ColumnInfo } from '@repo/shared/types'

/** Minimal synchronous interface required for SQLite schema introspection. */
export interface SqliteQueryable {
  prepare(sql: string): { all(): Record<string, unknown>[] }
}

/**
 * Introspect the schema of a SQLite database.
 *
 * Queries `sqlite_master` for table names, then uses `PRAGMA table_info` and
 * `PRAGMA foreign_key_list` per table to build a {@link DatabaseSchema}
 * containing tables, columns, data types, nullability, PKs, and FKs.
 */
export function introspectSqlite(client: SqliteQueryable): DatabaseSchema {
  const tableRows = client
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    )
    .all()

  if (tableRows.length === 0) {
    return { tables: [], dialect: 'sqlite' }
  }

  const tables: TableInfo[] = tableRows.map((tableRow) => {
    const tableName = tableRow.name as string

    const columnRows = client.prepare(`PRAGMA table_info(${tableName})`).all()

    const fkRows = client.prepare(`PRAGMA foreign_key_list(${tableName})`).all()

    const fkMap = new Map<string, { table: string; column: string }>()
    for (const fk of fkRows) {
      fkMap.set(fk.from as string, {
        table: fk.table as string,
        column: fk.to as string,
      })
    }

    const columns: ColumnInfo[] = columnRows.map((row) => {
      const colName = row.name as string
      const col: ColumnInfo = {
        name: colName,
        dataType: row.type as string,
        nullable: (row.notnull as number) === 0,
        isPrimaryKey: (row.pk as number) > 0,
      }
      const fk = fkMap.get(colName)
      if (fk) col.foreignKey = fk
      return col
    })

    return { name: tableName, columns }
  })

  return { tables, dialect: 'sqlite' }
}
