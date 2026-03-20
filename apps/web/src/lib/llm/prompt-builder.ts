import type { DatabaseSchema, ChatMessage } from '@shared/types'
import type { LmStudioMessage } from './types'

const MAX_HISTORY = 20

function formatSchema(schema: DatabaseSchema): string {
  if (schema.tables.length === 0) {
    return 'No tables found in the database.'
  }

  return schema.tables
    .map((table) => {
      const columns = table.columns.map((col) => {
        const pk = col.isPrimaryKey ? ' [PK]' : ''
        const nullable = col.nullable ? '' : ' NOT NULL'
        const fk = col.foreignKey
          ? ` [FK -> ${col.foreignKey.table}.${col.foreignKey.column}]`
          : ''
        return `  - ${col.name}: ${col.dataType}${nullable}${pk}${fk}`
      })
      return `Table: ${table.name}\n${columns.join('\n')}`
    })
    .join('\n\n')
}

export function buildSystemPrompt(
  dialect: 'postgresql' | 'sqlite',
  schema: DatabaseSchema | null,
): string {
  const lines: string[] = [
    `You are an expert SQL assistant for ${dialect} databases.`,
    'Generate correct, efficient SQL queries based on user requests.',
    'When providing SQL, wrap it in a markdown code block with the sql language tag.',
  ]

  if (schema !== null) {
    lines.push('')
    lines.push('## Database Schema')
    lines.push(formatSchema(schema))
  }

  return lines.join('\n')
}

export function buildMessages(
  history: ChatMessage[],
  userMessage: string,
  schema: DatabaseSchema | null,
  dialect: 'postgresql' | 'sqlite',
): LmStudioMessage[] {
  const trimmed = history.slice(-MAX_HISTORY)

  const systemPrompt = buildSystemPrompt(dialect, schema)

  const historyMessages: LmStudioMessage[] = trimmed.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }))

  return [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: userMessage },
  ]
}
