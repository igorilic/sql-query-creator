const SQL_CODE_BLOCK_RE = /```sql\n([\s\S]*?)```/g

/**
 * Extracts all SQL statements from markdown ```sql ... ``` code blocks.
 * Returns an array of trimmed SQL strings.
 */
export function parseSqlFromMarkdown(text: string): string[] {
  const results: string[] = []
  let match: RegExpExecArray | null
  SQL_CODE_BLOCK_RE.lastIndex = 0
  while ((match = SQL_CODE_BLOCK_RE.exec(text)) !== null) {
    const sql = match[1].trim()
    if (sql.length > 0) {
      results.push(sql)
    }
  }
  return results
}
