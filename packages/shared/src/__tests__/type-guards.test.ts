import { describe, it, expect } from 'vitest'
import { isPostgresConfig, isSqliteConfig, isValidSchema } from '../type-guards'
import type { ConnectionConfig, DatabaseSchema } from '../types'

describe('isPostgresConfig', () => {
  it('returns true for a valid PostgreSQL config', () => {
    const config: ConnectionConfig = {
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      username: 'user',
      password: 'pass',
    }
    expect(isPostgresConfig(config)).toBe(true)
  })

  it('returns false for a SQLite config', () => {
    const config: ConnectionConfig = {
      type: 'sqlite',
      filePath: '/tmp/mydb.sqlite',
    }
    expect(isPostgresConfig(config)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isPostgresConfig(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isPostgresConfig(undefined)).toBe(false)
  })

  it('returns false for an object without type', () => {
    expect(isPostgresConfig({ host: 'localhost' })).toBe(false)
  })

  it('returns false for an object with an unknown type', () => {
    expect(isPostgresConfig({ type: 'mysql' })).toBe(false)
  })
})

describe('isSqliteConfig', () => {
  it('returns true for a valid SQLite config', () => {
    const config: ConnectionConfig = {
      type: 'sqlite',
      filePath: '/tmp/mydb.sqlite',
    }
    expect(isSqliteConfig(config)).toBe(true)
  })

  it('returns false for a PostgreSQL config', () => {
    const config: ConnectionConfig = {
      type: 'postgresql',
      host: 'localhost',
    }
    expect(isSqliteConfig(config)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isSqliteConfig(null)).toBe(false)
  })
})

describe('isValidSchema', () => {
  it('returns true for a valid schema with tables', () => {
    const schema: DatabaseSchema = {
      dialect: 'postgresql',
      tables: [
        {
          name: 'users',
          columns: [
            {
              name: 'id',
              dataType: 'integer',
              nullable: false,
              isPrimaryKey: true,
            },
          ],
        },
      ],
    }
    expect(isValidSchema(schema)).toBe(true)
  })

  it('returns true for a valid sqlite schema with empty tables', () => {
    const schema: DatabaseSchema = {
      dialect: 'sqlite',
      tables: [],
    }
    expect(isValidSchema(schema)).toBe(true)
  })

  it('returns false when tables is missing', () => {
    expect(isValidSchema({ dialect: 'postgresql' })).toBe(false)
  })

  it('returns false when dialect is missing', () => {
    expect(isValidSchema({ tables: [] })).toBe(false)
  })

  it('returns false when dialect is invalid', () => {
    expect(isValidSchema({ dialect: 'mysql', tables: [] })).toBe(false)
  })

  it('returns false when tables is not an array', () => {
    expect(isValidSchema({ dialect: 'postgresql', tables: 'bad' })).toBe(false)
  })

  it('returns false for null', () => {
    expect(isValidSchema(null)).toBe(false)
  })

  it('returns false for a non-object', () => {
    expect(isValidSchema('string')).toBe(false)
  })
})
