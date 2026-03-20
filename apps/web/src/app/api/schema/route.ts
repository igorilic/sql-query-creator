import { connectionManager } from '../../../lib/db/connection-manager'

export async function GET(): Promise<Response> {
  const status = connectionManager.getStatus()

  if (!status.connected) {
    return Response.json({ error: 'Not connected to a database' }, { status: 404 })
  }

  try {
    const schema = await connectionManager.getSchema()
    return Response.json(schema)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Schema introspection failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
