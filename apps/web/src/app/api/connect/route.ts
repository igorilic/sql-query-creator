import { connectionManager } from '../../../lib/db/connection-manager'
import { isPostgresConfig, isSqliteConfig } from '@repo/shared/type-guards'
import type { ConnectionConfig, ConnectionStatus } from '@repo/shared/types'

export async function POST(request: Request): Promise<Response> {
  // Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Validate: must be a known dialect
  if (!isPostgresConfig(body) && !isSqliteConfig(body)) {
    return Response.json(
      { error: 'Invalid config: type must be "postgresql" or "sqlite"' },
      { status: 400 },
    )
  }

  let status: ConnectionStatus
  try {
    status = await connectionManager.connect(body as ConnectionConfig)
  } catch {
    return Response.json({ status: 'error', error: 'An internal error occurred' }, { status: 500 })
  }

  if (status.connected) {
    return Response.json({ status: 'connected', type: status.type })
  }

  return Response.json({ status: 'error', error: status.error }, { status: 502 })
}
