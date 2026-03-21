import { connectionManager } from '../../../lib/db/connection-manager'
import { sendChatCompletion } from '../../../lib/llm/lm-studio-client'
import { buildMessages } from '../../../lib/llm/prompt-builder'
import type { ChatMessage, DatabaseSchema } from '@repo/shared/types'

interface ChatRequestBody {
  message: string
  history?: ChatMessage[]
}

function isValidBody(body: unknown): body is ChatRequestBody {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  return typeof b.message === 'string'
}

function sseToken(token: string): string {
  return `data: ${JSON.stringify({ token })}\n\n`
}

function sseError(message: string): string {
  return `event: error\ndata: ${JSON.stringify({ error: message })}\n\n`
}

const SSE_DONE = 'data: [DONE]\n\n'

export async function POST(request: Request): Promise<Response> {
  // 1. Parse and validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!isValidBody(body)) {
    return Response.json({ error: 'message is required and must be a string' }, { status: 400 })
  }

  const { message, history = [] } = body

  // 2. Resolve schema from the active connection (if any)
  const status = connectionManager.getStatus()
  const dialect: 'postgresql' | 'sqlite' =
    status.connected && status.type ? status.type : 'postgresql'

  let schema: DatabaseSchema | null = null
  if (status.connected) {
    try {
      schema = await connectionManager.getSchema()
    } catch {
      schema = null
    }
  }

  // 3. Build the LM Studio message list
  const messages = buildMessages(history, message, schema, dialect)

  // 4. Stream the response as SSE
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const token of sendChatCompletion(messages)) {
          controller.enqueue(encoder.encode(sseToken(token)))
        }
        controller.enqueue(encoder.encode(SSE_DONE))
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Stream failed'
        controller.enqueue(encoder.encode(sseError(errorMessage)))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
