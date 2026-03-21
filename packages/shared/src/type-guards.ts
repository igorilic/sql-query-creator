import type { ConnectionConfig, DatabaseSchema } from './types'

export function isPostgresConfig(
  config: unknown,
): config is ConnectionConfig & { type: 'postgresql' } {
  return (
    config !== null &&
    typeof config === 'object' &&
    !Array.isArray(config) &&
    (config as ConnectionConfig).type === 'postgresql'
  )
}

export function isSqliteConfig(
  config: unknown,
): config is ConnectionConfig & { type: 'sqlite' } {
  return (
    config !== null &&
    typeof config === 'object' &&
    !Array.isArray(config) &&
    (config as ConnectionConfig).type === 'sqlite'
  )
}

export function isValidSchema(schema: unknown): schema is DatabaseSchema {
  if (schema === null || typeof schema !== 'object') return false
  const s = schema as Record<string, unknown>
  if (s.dialect !== 'postgresql' && s.dialect !== 'sqlite') return false
  if (!Array.isArray(s.tables)) return false
  return s.tables.every(
    (table) =>
      table !== null &&
      typeof table === 'object' &&
      typeof (table as Record<string, unknown>).name === 'string' &&
      Array.isArray((table as Record<string, unknown>).columns),
  )
}
