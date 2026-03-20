import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, buildMessages } from '../prompt-builder'
import type { DatabaseSchema, ChatMessage } from '@shared/types'

const pgSchema: DatabaseSchema = {
  dialect: 'postgresql',
  tables: [
    {
      name: 'users',
      columns: [
        { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true },
        { name: 'email', dataType: 'varchar', nullable: false, isPrimaryKey: false },
        {
          name: 'org_id',
          dataType: 'integer',
          nullable: true,
          isPrimaryKey: false,
          foreignKey: { table: 'organisations', column: 'id' },
        },
      ],
    },
    {
      name: 'organisations',
      columns: [
        { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true },
        { name: 'name', dataType: 'varchar', nullable: false, isPrimaryKey: false },
      ],
    },
  ],
}

const history: ChatMessage[] = [
  { id: '1', role: 'user', content: 'Show all users', timestamp: 1 },
  { id: '2', role: 'assistant', content: 'SELECT * FROM users', timestamp: 2 },
]

// ---------------------------------------------------------------------------
// buildSystemPrompt
// ---------------------------------------------------------------------------

describe('buildSystemPrompt', () => {
  it('includes the dialect in the system prompt', () => {
    const prompt = buildSystemPrompt('postgresql', pgSchema)
    expect(prompt).toContain('postgresql')
  })

  it('includes table names from the schema', () => {
    const prompt = buildSystemPrompt('postgresql', pgSchema)
    expect(prompt).toContain('users')
    expect(prompt).toContain('organisations')
  })

  it('includes column names and types', () => {
    const prompt = buildSystemPrompt('postgresql', pgSchema)
    expect(prompt).toContain('email')
    expect(prompt).toContain('varchar')
  })

  it('includes foreign key information', () => {
    const prompt = buildSystemPrompt('postgresql', pgSchema)
    expect(prompt).toContain('organisations')
  })

  it('omits schema section when schema is null', () => {
    const prompt = buildSystemPrompt('postgresql', null)
    expect(prompt).not.toContain('users')
    expect(prompt).not.toContain('organisations')
  })

  it('still includes dialect when schema is null', () => {
    const prompt = buildSystemPrompt('postgresql', null)
    expect(prompt).toContain('postgresql')
  })

  it('works with sqlite dialect', () => {
    const sqliteSchema: DatabaseSchema = { dialect: 'sqlite', tables: [] }
    const prompt = buildSystemPrompt('sqlite', sqliteSchema)
    expect(prompt).toContain('sqlite')
  })

  it('handles empty tables array gracefully', () => {
    const emptySchema: DatabaseSchema = { dialect: 'postgresql', tables: [] }
    const prompt = buildSystemPrompt('postgresql', emptySchema)
    expect(prompt).toContain('postgresql')
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// buildMessages
// ---------------------------------------------------------------------------

describe('buildMessages', () => {
  it('returns an array starting with a system message', () => {
    const messages = buildMessages([], 'hello', null, 'postgresql')
    expect(messages[0].role).toBe('system')
  })

  it('places the new user message last', () => {
    const messages = buildMessages([], 'hello', null, 'postgresql')
    const last = messages[messages.length - 1]
    expect(last.role).toBe('user')
    expect(last.content).toBe('hello')
  })

  it('interleaves conversation history between system prompt and new user message', () => {
    const messages = buildMessages(history, 'follow up', null, 'postgresql')
    // [system, user(history), assistant(history), user(new)]
    expect(messages).toHaveLength(4)
    expect(messages[0].role).toBe('system')
    expect(messages[1].role).toBe('user')
    expect(messages[1].content).toBe('Show all users')
    expect(messages[2].role).toBe('assistant')
    expect(messages[2].content).toBe('SELECT * FROM users')
    expect(messages[3].role).toBe('user')
    expect(messages[3].content).toBe('follow up')
  })

  it('history messages map role and content correctly', () => {
    const messages = buildMessages(history, 'new', null, 'postgresql')
    const [, histUser, histAssistant] = messages
    expect(histUser.role).toBe('user')
    expect(histAssistant.role).toBe('assistant')
  })

  it('trims history to the last 20 messages', () => {
    const longHistory: ChatMessage[] = Array.from({ length: 30 }, (_, i) => ({
      id: String(i),
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `message ${i}`,
      timestamp: i,
    }))

    const messages = buildMessages(longHistory, 'latest', null, 'postgresql')
    // system + 20 history + 1 new user = 22
    expect(messages).toHaveLength(22)
  })

  it('keeps the most recent 20 history messages when trimming', () => {
    const longHistory: ChatMessage[] = Array.from({ length: 25 }, (_, i) => ({
      id: String(i),
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `message ${i}`,
      timestamp: i,
    }))

    const messages = buildMessages(longHistory, 'latest', null, 'postgresql')
    // First history message should be message 5 (last 20 of 25 = indices 5..24)
    expect(messages[1].content).toBe('message 5')
  })

  it('includes schema context in the system message when schema is provided', () => {
    const messages = buildMessages([], 'query', pgSchema, 'postgresql')
    const systemContent = messages[0].content
    expect(systemContent).toContain('users')
  })

  it('does not include schema in system message when schema is null', () => {
    const messages = buildMessages([], 'query', null, 'postgresql')
    const systemContent = messages[0].content
    expect(systemContent).not.toContain('users')
  })

  it('returns only system + user when history is empty', () => {
    const messages = buildMessages([], 'hello', null, 'postgresql')
    expect(messages).toHaveLength(2)
  })
})
