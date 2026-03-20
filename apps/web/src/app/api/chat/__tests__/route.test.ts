import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the connection manager singleton BEFORE importing the route
vi.mock('../../../../lib/db/connection-manager', () => ({
  connectionManager: {
    getStatus: vi.fn(),
    getSchema: vi.fn(),
  },
}))

// Mock the LM Studio client BEFORE importing the route
vi.mock('../../../../lib/llm/lm-studio-client', () => ({
  sendChatCompletion: vi.fn(),
}))

// Mock the prompt builder BEFORE importing the route
vi.mock('../../../../lib/llm/prompt-builder', () => ({
  buildMessages: vi.fn(),
}))

import { POST } from '../route'
import { connectionManager } from '../../../../lib/db/connection-manager'
import { sendChatCompletion } from '../../../../lib/llm/lm-studio-client'
import { buildMessages } from '../../../../lib/llm/prompt-builder'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Async generator that yields each token in order. */
async function* tokensGen(tokens: string[]): AsyncGenerator<string> {
  for (const token of tokens) {
    yield token
  }
}

/** Async generator that immediately throws. */
async function* errorGen(error: Error): AsyncGenerator<string> {
  throw error
  // eslint-disable-next-line no-unreachable
  yield ''
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Consume the full SSE stream body as a string. */
async function readSSE(response: Response): Promise<string> {
  return response.text()
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockMessages = [
  { role: 'system' as const, content: 'You are an expert SQL assistant.' },
  { role: 'user' as const, content: 'Give me a query' },
]

const postgresSchema = {
  dialect: 'postgresql' as const,
  tables: [
    {
      name: 'users',
      columns: [{ name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true }],
    },
  ],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: not connected
    vi.mocked(connectionManager.getStatus).mockReturnValue({ connected: false })
    // Default: buildMessages returns mock messages
    vi.mocked(buildMessages).mockReturnValue(mockMessages)
  })

  // -------------------------------------------------------------------------
  // Happy path — SSE streaming
  // -------------------------------------------------------------------------

  it('returns 200 with text/event-stream content type', async () => {
    vi.mocked(sendChatCompletion).mockReturnValue(tokensGen(['Hello']))

    const response = await POST(makeRequest({ message: 'Hello' }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/event-stream')
  })

  it('streams a data event for each yielded token', async () => {
    vi.mocked(sendChatCompletion).mockReturnValue(tokensGen(['Hello', ' world']))

    const response = await POST(makeRequest({ message: 'Hello' }))
    const text = await readSSE(response)

    expect(text).toContain('data: {"token":"Hello"}')
    expect(text).toContain('data: {"token":" world"}')
  })

  it('sends a [DONE] event after all tokens are streamed', async () => {
    vi.mocked(sendChatCompletion).mockReturnValue(tokensGen(['SELECT 1']))

    const response = await POST(makeRequest({ message: 'Hello' }))
    const text = await readSSE(response)

    expect(text).toContain('data: [DONE]')
  })

  it('handles empty token stream gracefully', async () => {
    vi.mocked(sendChatCompletion).mockReturnValue(tokensGen([]))

    const response = await POST(makeRequest({ message: 'Hello' }))
    const text = await readSSE(response)

    expect(response.status).toBe(200)
    expect(text).toContain('data: [DONE]')
  })

  // -------------------------------------------------------------------------
  // Error — LM Studio is down / throws
  // -------------------------------------------------------------------------

  it('sends an error SSE event when sendChatCompletion throws', async () => {
    const lmError = new Error('Connection refused')
    vi.mocked(sendChatCompletion).mockReturnValue(errorGen(lmError))

    const response = await POST(makeRequest({ message: 'Hello' }))
    const text = await readSSE(response)

    expect(text).toContain('event: error')
    expect(text).toContain('Connection refused')
  })

  it('includes the error message in the error event data', async () => {
    vi.mocked(sendChatCompletion).mockReturnValue(errorGen(new Error('LM Studio is offline')))

    const response = await POST(makeRequest({ message: 'Hello' }))
    const text = await readSSE(response)

    expect(text).toContain('LM Studio is offline')
  })

  it('still returns 200 even when streaming fails (SSE carries the error)', async () => {
    vi.mocked(sendChatCompletion).mockReturnValue(errorGen(new Error('timeout')))

    const response = await POST(makeRequest({ message: 'Hello' }))

    expect(response.status).toBe(200)
  })

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  it('returns 400 when message field is missing', async () => {
    const response = await POST(makeRequest({ history: [] }))

    expect(response.status).toBe(400)
    expect(sendChatCompletion).not.toHaveBeenCalled()
  })

  it('returns 400 when message is not a string', async () => {
    const response = await POST(makeRequest({ message: 123 }))

    expect(response.status).toBe(400)
  })

  it('returns 400 for invalid JSON', async () => {
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  // -------------------------------------------------------------------------
  // Schema context — not connected
  // -------------------------------------------------------------------------

  it('calls buildMessages with null schema when not connected', async () => {
    vi.mocked(connectionManager.getStatus).mockReturnValue({ connected: false })
    vi.mocked(sendChatCompletion).mockReturnValue(tokensGen([]))

    await POST(makeRequest({ message: 'Give me SQL' }))

    expect(buildMessages).toHaveBeenCalledWith([], 'Give me SQL', null, expect.any(String))
  })

  it('does not call getSchema() when not connected', async () => {
    vi.mocked(connectionManager.getStatus).mockReturnValue({ connected: false })
    vi.mocked(sendChatCompletion).mockReturnValue(tokensGen([]))

    await POST(makeRequest({ message: 'Hello' }))

    expect(connectionManager.getSchema).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Schema context — connected
  // -------------------------------------------------------------------------

  it('calls buildMessages with schema when connected', async () => {
    vi.mocked(connectionManager.getStatus).mockReturnValue({
      connected: true,
      type: 'postgresql',
    })
    vi.mocked(connectionManager.getSchema).mockResolvedValueOnce(postgresSchema)
    vi.mocked(sendChatCompletion).mockReturnValue(tokensGen([]))

    await POST(makeRequest({ message: 'List users' }))

    expect(buildMessages).toHaveBeenCalledWith([], 'List users', postgresSchema, 'postgresql')
  })

  it('calls buildMessages with null schema when getSchema() throws', async () => {
    vi.mocked(connectionManager.getStatus).mockReturnValue({
      connected: true,
      type: 'sqlite',
    })
    vi.mocked(connectionManager.getSchema).mockRejectedValueOnce(new Error('introspection failed'))
    vi.mocked(sendChatCompletion).mockReturnValue(tokensGen([]))

    await POST(makeRequest({ message: 'Hello' }))

    expect(buildMessages).toHaveBeenCalledWith([], 'Hello', null, 'sqlite')
  })

  // -------------------------------------------------------------------------
  // History
  // -------------------------------------------------------------------------

  it('passes history from the request body to buildMessages', async () => {
    const history = [
      { role: 'user' as const, content: 'Previous message' },
      { role: 'assistant' as const, content: 'Previous answer' },
    ]
    vi.mocked(sendChatCompletion).mockReturnValue(tokensGen([]))

    await POST(makeRequest({ message: 'Follow up', history }))

    expect(buildMessages).toHaveBeenCalledWith(history, 'Follow up', null, expect.any(String))
  })

  it('defaults to empty history when history is not provided', async () => {
    vi.mocked(sendChatCompletion).mockReturnValue(tokensGen([]))

    await POST(makeRequest({ message: 'Hello' }))

    expect(buildMessages).toHaveBeenCalledWith([], 'Hello', null, expect.any(String))
  })

  // -------------------------------------------------------------------------
  // sendChatCompletion integration
  // -------------------------------------------------------------------------

  it('passes the messages from buildMessages to sendChatCompletion', async () => {
    vi.mocked(sendChatCompletion).mockReturnValue(tokensGen([]))

    await POST(makeRequest({ message: 'Hello' }))

    expect(sendChatCompletion).toHaveBeenCalledWith(mockMessages)
  })
})
