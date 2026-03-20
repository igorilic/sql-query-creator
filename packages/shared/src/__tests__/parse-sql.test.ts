import { describe, it, expect } from 'vitest'
import { parseSqlFromMarkdown } from '../parse-sql'

describe('parseSqlFromMarkdown', () => {
  it('extracts SQL from a single sql code block', () => {
    const text = 'Here is the query:\n```sql\nSELECT * FROM users;\n```'
    expect(parseSqlFromMarkdown(text)).toEqual(['SELECT * FROM users;'])
  })

  it('extracts SQL from multiple sql code blocks', () => {
    const text =
      '```sql\nSELECT id FROM users;\n```\nThen:\n```sql\nSELECT * FROM orders;\n```'
    expect(parseSqlFromMarkdown(text)).toEqual([
      'SELECT id FROM users;',
      'SELECT * FROM orders;',
    ])
  })

  it('returns an empty array when there are no code blocks', () => {
    expect(parseSqlFromMarkdown('No SQL here, just text.')).toEqual([])
  })

  it('returns an empty array for an empty string', () => {
    expect(parseSqlFromMarkdown('')).toEqual([])
  })

  it('ignores non-sql code blocks', () => {
    const text = '```js\nconsole.log("hi")\n```\n```sql\nSELECT 1;\n```'
    expect(parseSqlFromMarkdown(text)).toEqual(['SELECT 1;'])
  })

  it('trims leading and trailing whitespace from extracted SQL', () => {
    const text = '```sql\n  SELECT 1;  \n```'
    expect(parseSqlFromMarkdown(text)).toEqual(['SELECT 1;'])
  })

  it('handles multi-line SQL statements', () => {
    const sql = 'SELECT\n  id,\n  name\nFROM users\nWHERE active = true;'
    const text = `\`\`\`sql\n${sql}\n\`\`\``
    expect(parseSqlFromMarkdown(text)).toEqual([sql])
  })

  it('handles code blocks without language tag (not sql) — ignores them', () => {
    const text = '```\nSELECT 1;\n```'
    expect(parseSqlFromMarkdown(text)).toEqual([])
  })
})
