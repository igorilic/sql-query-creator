import type { DatabaseSchema, TableInfo, ColumnInfo } from '@repo/shared/types'

/** Minimal interface required for PostgreSQL schema introspection. */
export interface PostgresQueryable {
  query(sql: string): Promise<{ rows: Record<string, string>[] }>
}

/**
 * Introspect the public schema of a PostgreSQL database.
 *
 * Queries `information_schema.columns`, `information_schema.table_constraints`,
 * and `information_schema.key_column_usage` to build a {@link DatabaseSchema}
 * containing tables, columns, data types, nullability, PKs, and FKs.
 */
export async function introspectPostgres(client: PostgresQueryable): Promise<DatabaseSchema> {
  const [columnsResult, pkResult, fkResult] = await Promise.all([
    client.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `),
    client.query(`
      SELECT kcu.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
    `),
    client.query(`
      SELECT kcu.table_name, kcu.column_name,
             ccu.table_name AS foreign_table_name,
             ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
    `),
  ])

  if (columnsResult.rows.length === 0) {
    return { tables: [], dialect: 'postgresql' }
  }

  const pkSet = new Set(pkResult.rows.map((r) => `${r.table_name}.${r.column_name}`))

  const fkMap = new Map<string, { table: string; column: string }>()
  for (const row of fkResult.rows) {
    fkMap.set(`${row.table_name}.${row.column_name}`, {
      table: row.foreign_table_name,
      column: row.foreign_column_name,
    })
  }

  // Group columns by table, preserving ordinal_position order from the query
  const tableMap = new Map<string, ColumnInfo[]>()
  for (const row of columnsResult.rows) {
    const tableName = row.table_name
    const key = `${tableName}.${row.column_name}`
    const col: ColumnInfo = {
      name: row.column_name,
      dataType: row.data_type,
      nullable: row.is_nullable === 'YES',
      isPrimaryKey: pkSet.has(key),
    }
    const fk = fkMap.get(key)
    if (fk) col.foreignKey = fk

    if (!tableMap.has(tableName)) tableMap.set(tableName, [])
    tableMap.get(tableName)!.push(col)
  }

  const tables: TableInfo[] = Array.from(tableMap.entries()).map(([name, columns]) => ({
    name,
    columns,
  }))

  return { tables, dialect: 'postgresql' }
}
