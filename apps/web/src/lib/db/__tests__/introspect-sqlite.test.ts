import { describe, it, expect, vi } from 'vitest'
import { introspectSqlite } from '../introspect-sqlite'

type MockRow = Record<string, unknown>

function createMockClient(prepareImpl: (sql: string) => { all(): MockRow[] }) {
  return {
    prepare: vi.fn().mockImplementation(prepareImpl),
  }
}

describe('introspectSqlite', () => {
  it('returns empty schema for an empty database', () => {
    const client = createMockClient(() => ({ all: () => [] }))

    const schema = introspectSqlite(client)

    expect(schema).toEqual({ tables: [], dialect: 'sqlite' })
  })

  it('queries sqlite_master, PRAGMA table_info, and PRAGMA foreign_key_list', () => {
    const client = createMockClient(() => ({ all: () => [] }))

    introspectSqlite(client)

    const calls = (client.prepare as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as string,
    )
    expect(calls.some((sql) => sql.includes('sqlite_master'))).toBe(true)
  })

  it('queries PRAGMA table_info for each discovered table', () => {
    const client = createMockClient((sql) => {
      if (sql.includes('sqlite_master')) return { all: () => [{ name: 'users' }] }
      return { all: () => [] }
    })

    introspectSqlite(client)

    const calls = (client.prepare as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as string,
    )
    expect(calls.some((sql) => sql.includes('table_info') && sql.includes('users'))).toBe(true)
    expect(calls.some((sql) => sql.includes('foreign_key_list') && sql.includes('users'))).toBe(
      true,
    )
  })

  it('maps PRAGMA table_info rows into tables and columns', () => {
    const tableInfoRows: MockRow[] = [
      { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
      { cid: 1, name: 'email', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
      { cid: 2, name: 'bio', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
    ]

    const client = createMockClient((sql) => {
      if (sql.includes('sqlite_master')) return { all: () => [{ name: 'users' }] }
      if (sql.includes('table_info')) return { all: () => tableInfoRows }
      return { all: () => [] }
    })

    const schema = introspectSqlite(client)

    expect(schema.dialect).toBe('sqlite')
    expect(schema.tables).toHaveLength(1)
    expect(schema.tables[0].name).toBe('users')
    expect(schema.tables[0].columns).toHaveLength(3)
  })

  it('marks primary key columns with isPrimaryKey: true', () => {
    const tableInfoRows: MockRow[] = [
      { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
      { cid: 1, name: 'email', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
    ]

    const client = createMockClient((sql) => {
      if (sql.includes('sqlite_master')) return { all: () => [{ name: 'users' }] }
      if (sql.includes('table_info')) return { all: () => tableInfoRows }
      return { all: () => [] }
    })

    const schema = introspectSqlite(client)

    const [idCol, emailCol] = schema.tables[0].columns
    expect(idCol.isPrimaryKey).toBe(true)
    expect(emailCol.isPrimaryKey).toBe(false)
  })

  it('marks nullable columns with nullable: true', () => {
    const tableInfoRows: MockRow[] = [
      { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
      { cid: 1, name: 'bio', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
    ]

    const client = createMockClient((sql) => {
      if (sql.includes('sqlite_master')) return { all: () => [{ name: 'users' }] }
      if (sql.includes('table_info')) return { all: () => tableInfoRows }
      return { all: () => [] }
    })

    const schema = introspectSqlite(client)

    const [idCol, bioCol] = schema.tables[0].columns
    expect(idCol.nullable).toBe(false)
    expect(bioCol.nullable).toBe(true)
  })

  it('populates foreignKey on columns that reference another table', () => {
    const tableInfoRows: MockRow[] = [
      { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
      { cid: 1, name: 'user_id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 0 },
    ]
    const fkRows: MockRow[] = [
      {
        id: 0,
        seq: 0,
        table: 'users',
        from: 'user_id',
        to: 'id',
        on_update: 'NO ACTION',
        on_delete: 'NO ACTION',
        match: 'NONE',
      },
    ]

    const client = createMockClient((sql) => {
      if (sql.includes('sqlite_master')) return { all: () => [{ name: 'orders' }] }
      if (sql.includes('table_info')) return { all: () => tableInfoRows }
      if (sql.includes('foreign_key_list')) return { all: () => fkRows }
      return { all: () => [] }
    })

    const schema = introspectSqlite(client)

    const userIdCol = schema.tables[0].columns.find((c) => c.name === 'user_id')
    expect(userIdCol?.foreignKey).toEqual({ table: 'users', column: 'id' })
  })

  it('does not set foreignKey on non-FK columns', () => {
    const tableInfoRows: MockRow[] = [
      { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
    ]

    const client = createMockClient((sql) => {
      if (sql.includes('sqlite_master')) return { all: () => [{ name: 'users' }] }
      if (sql.includes('table_info')) return { all: () => tableInfoRows }
      return { all: () => [] }
    })

    const schema = introspectSqlite(client)

    expect(schema.tables[0].columns[0].foreignKey).toBeUndefined()
  })

  it('groups columns from multiple tables into separate TableInfo entries', () => {
    const client = createMockClient((sql) => {
      if (sql.includes('sqlite_master'))
        return {
          all: () => [{ name: 'users' }, { name: 'orders' }, { name: 'products' }],
        }
      if (sql.includes('table_info'))
        return {
          all: () => [{ cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 }],
        }
      return { all: () => [] }
    })

    const schema = introspectSqlite(client)

    expect(schema.tables).toHaveLength(3)
    expect(schema.tables.map((t) => t.name)).toEqual(['users', 'orders', 'products'])
  })

  it('returns full ColumnInfo shape for each column', () => {
    const tableInfoRows: MockRow[] = [
      { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
    ]

    const client = createMockClient((sql) => {
      if (sql.includes('sqlite_master')) return { all: () => [{ name: 'users' }] }
      if (sql.includes('table_info')) return { all: () => tableInfoRows }
      return { all: () => [] }
    })

    const schema = introspectSqlite(client)

    expect(schema.tables[0].columns[0]).toEqual({
      name: 'id',
      dataType: 'INTEGER',
      nullable: false,
      isPrimaryKey: true,
    })
  })

  it('excludes internal sqlite_ tables from results', () => {
    // The sqlite_master query should filter out sqlite_ tables via SQL WHERE clause
    // This test verifies the query contains the filter
    const client = createMockClient(() => ({ all: () => [] }))

    introspectSqlite(client)

    const calls = (client.prepare as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as string,
    )
    const masterQuery = calls.find((sql) => sql.includes('sqlite_master'))
    expect(masterQuery).toMatch(/sqlite_%/)
  })
})
