export interface ColumnInfo {
  name: string
  dataType: string
  nullable: boolean
  isPrimaryKey: boolean
  foreignKey?: { table: string; column: string }
}

export interface TableInfo {
  name: string
  columns: ColumnInfo[]
}

export interface DatabaseSchema {
  tables: TableInfo[]
  dialect: 'postgresql' | 'sqlite'
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sql?: string
  timestamp: number
}

export interface ConnectionConfig {
  type: 'postgresql' | 'sqlite'
  // PostgreSQL
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
  // SQLite
  filePath?: string
}

export interface ConnectionStatus {
  connected: boolean
  type?: 'postgresql' | 'sqlite'
  error?: string
}
