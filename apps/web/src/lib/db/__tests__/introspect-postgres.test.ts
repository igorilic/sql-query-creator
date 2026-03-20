import { describe, it, expect, vi } from 'vitest'
import { introspectPostgres } from '../introspect-postgres'

type MockRow = Record<string, string>

function createMockClient(queryFn: (sql: string) => { rows: MockRow[] }) {
  return {
    query: vi.fn().mockImplementation((sql: string) => Promise.resolve(queryFn(sql))),
  }
}

describe('introspectPostgres', () => {
  it('returns empty schema for an empty database', async () => {
    const client = createMockClient(() => ({ rows: [] }))

    const schema = await introspectPostgres(client)

    expect(schema).toEqual({ tables: [], dialect: 'postgresql' })
  })

  it('queries information_schema.columns, primary keys, and foreign keys', async () => {
    const client = createMockClient(() => ({ rows: [] }))

    await introspectPostgres(client)

    const calls = (client.query as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as string,
    )
    expect(calls.some((sql) => sql.includes('information_schema.columns'))).toBe(true)
    expect(calls.some((sql) => sql.includes('PRIMARY KEY'))).toBe(true)
    expect(calls.some((sql) => sql.includes('FOREIGN KEY'))).toBe(true)
  })

  it('maps rows from information_schema.columns into tables and columns', async () => {
    const columnsRows: MockRow[] = [
      { table_name: 'users', column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
      { table_name: 'users', column_name: 'email', data_type: 'character varying', is_nullable: 'NO' },
      {
        table_name: 'users',
        column_name: 'created_at',
        data_type: 'timestamp without time zone',
        is_nullable: 'YES',
      },
    ]

    const client = createMockClient((sql) => {
      if (sql.includes('information_schema.columns')) return { rows: columnsRows }
      return { rows: [] }
    })

    const schema = await introspectPostgres(client)

    expect(schema.dialect).toBe('postgresql')
    expect(schema.tables).toHaveLength(1)
    expect(schema.tables[0].name).toBe('users')
    expect(schema.tables[0].columns).toHaveLength(3)
  })

  it('marks primary key columns with isPrimaryKey: true', async () => {
    const columnsRows: MockRow[] = [
      { table_name: 'users', column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
      { table_name: 'users', column_name: 'email', data_type: 'character varying', is_nullable: 'NO' },
    ]
    const pkRows: MockRow[] = [{ table_name: 'users', column_name: 'id' }]

    const client = createMockClient((sql) => {
      if (sql.includes('information_schema.columns')) return { rows: columnsRows }
      if (sql.includes('PRIMARY KEY')) return { rows: pkRows }
      return { rows: [] }
    })

    const schema = await introspectPostgres(client)

    const [idCol, emailCol] = schema.tables[0].columns
    expect(idCol.isPrimaryKey).toBe(true)
    expect(emailCol.isPrimaryKey).toBe(false)
  })

  it('marks nullable columns with nullable: true', async () => {
    const columnsRows: MockRow[] = [
      { table_name: 'users', column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
      { table_name: 'users', column_name: 'bio', data_type: 'text', is_nullable: 'YES' },
    ]

    const client = createMockClient((sql) => {
      if (sql.includes('information_schema.columns')) return { rows: columnsRows }
      return { rows: [] }
    })

    const schema = await introspectPostgres(client)

    const [idCol, bioCol] = schema.tables[0].columns
    expect(idCol.nullable).toBe(false)
    expect(bioCol.nullable).toBe(true)
  })

  it('populates foreignKey on columns that reference another table', async () => {
    const columnsRows: MockRow[] = [
      { table_name: 'orders', column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
      { table_name: 'orders', column_name: 'user_id', data_type: 'integer', is_nullable: 'NO' },
    ]
    const pkRows: MockRow[] = [{ table_name: 'orders', column_name: 'id' }]
    const fkRows: MockRow[] = [
      {
        table_name: 'orders',
        column_name: 'user_id',
        foreign_table_name: 'users',
        foreign_column_name: 'id',
      },
    ]

    const client = createMockClient((sql) => {
      if (sql.includes('information_schema.columns')) return { rows: columnsRows }
      if (sql.includes('PRIMARY KEY')) return { rows: pkRows }
      if (sql.includes('FOREIGN KEY')) return { rows: fkRows }
      return { rows: [] }
    })

    const schema = await introspectPostgres(client)

    const userIdCol = schema.tables[0].columns.find((c) => c.name === 'user_id')
    expect(userIdCol?.foreignKey).toEqual({ table: 'users', column: 'id' })
  })

  it('does not set foreignKey on non-FK columns', async () => {
    const columnsRows: MockRow[] = [
      { table_name: 'users', column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
    ]
    const pkRows: MockRow[] = [{ table_name: 'users', column_name: 'id' }]

    const client = createMockClient((sql) => {
      if (sql.includes('information_schema.columns')) return { rows: columnsRows }
      if (sql.includes('PRIMARY KEY')) return { rows: pkRows }
      return { rows: [] }
    })

    const schema = await introspectPostgres(client)

    expect(schema.tables[0].columns[0].foreignKey).toBeUndefined()
  })

  it('groups columns from multiple tables into separate TableInfo entries', async () => {
    const columnsRows: MockRow[] = [
      { table_name: 'users', column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
      { table_name: 'orders', column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
      { table_name: 'products', column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
    ]

    const client = createMockClient((sql) => {
      if (sql.includes('information_schema.columns')) return { rows: columnsRows }
      return { rows: [] }
    })

    const schema = await introspectPostgres(client)

    expect(schema.tables).toHaveLength(3)
    expect(schema.tables.map((t) => t.name)).toEqual(['users', 'orders', 'products'])
  })

  it('returns full ColumnInfo shape for each column', async () => {
    const columnsRows: MockRow[] = [
      { table_name: 'users', column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
    ]
    const pkRows: MockRow[] = [{ table_name: 'users', column_name: 'id' }]

    const client = createMockClient((sql) => {
      if (sql.includes('information_schema.columns')) return { rows: columnsRows }
      if (sql.includes('PRIMARY KEY')) return { rows: pkRows }
      return { rows: [] }
    })

    const schema = await introspectPostgres(client)

    expect(schema.tables[0].columns[0]).toEqual({
      name: 'id',
      dataType: 'integer',
      nullable: false,
      isPrimaryKey: true,
    })
  })
})
