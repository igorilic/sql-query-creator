import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendChatCompletion } from '../lm-studio-client'
import type { LmStudioError } from '../types'

// Helper: encode SSE lines into a ReadableStream<Uint8Array>
function createSseStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line))
      }
      controller.close()
    },
  })
}

// Collect all yielded chunks from the async generator
async function collectChunks(gen: AsyncIterable<string>): Promise<string[]> {
  const chunks: string[] = []
  for await (const chunk of gen) {
    chunks.push(chunk)
  }
  return chunks
}

const MESSAGES = [
  { role: 'user' as const, content: 'Write a SELECT query for users' },
]

describe('sendChatCompletion', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    vi.resetAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('sends a POST to /v1/chat/completions with stream: true', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: createSseStream(['data: [DONE]\n']),
    })
    vi.stubGlobal('fetch', mockFetch)

    await collectChunks(sendChatCompletion(MESSAGES))

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/v1\/chat\/completions$/)
    const body = JSON.parse(init.body as string)
    expect(body.stream).toBe(true)
    expect(body.messages).toEqual(MESSAGES)
  })

  it('uses LMSTUDIO_BASE_URL env var when set', async () => {
    process.env.LMSTUDIO_BASE_URL = 'http://custom-host:5678/v1'
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: createSseStream(['data: [DONE]\n']),
    })
    vi.stubGlobal('fetch', mockFetch)

    await collectChunks(sendChatCompletion(MESSAGES))

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://custom-host:5678/v1/chat/completions')
  })

  it('defaults to http://localhost:1234/v1 when env var is not set', async () => {
    delete process.env.LMSTUDIO_BASE_URL
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: createSseStream(['data: [DONE]\n']),
    })
    vi.stubGlobal('fetch', mockFetch)

    await collectChunks(sendChatCompletion(MESSAGES))

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:1234/v1/chat/completions')
  })

  it('yields token content from SSE delta chunks', async () => {
    const sseLines = [
      'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n',
      'data: {"choices":[{"delta":{"content":" world"},"finish_reason":null}]}\n',
      'data: [DONE]\n',
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: createSseStream(sseLines),
    }))

    const chunks = await collectChunks(sendChatCompletion(MESSAGES))

    expect(chunks).toEqual(['Hello', ' world'])
  })

  it('skips SSE lines with empty delta content', async () => {
    const sseLines = [
      'data: {"choices":[{"delta":{},"finish_reason":null}]}\n',
      'data: {"choices":[{"delta":{"content":"Hi"},"finish_reason":null}]}\n',
      'data: [DONE]\n',
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: createSseStream(sseLines),
    }))

    const chunks = await collectChunks(sendChatCompletion(MESSAGES))

    expect(chunks).toEqual(['Hi'])
  })

  it('stops yielding after [DONE] sentinel', async () => {
    const sseLines = [
      'data: {"choices":[{"delta":{"content":"Token"},"finish_reason":null}]}\n',
      'data: [DONE]\n',
      'data: {"choices":[{"delta":{"content":"After done"},"finish_reason":null}]}\n',
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: createSseStream(sseLines),
    }))

    const chunks = await collectChunks(sendChatCompletion(MESSAGES))

    expect(chunks).toEqual(['Token'])
    expect(chunks).not.toContain('After done')
  })

  it('throws LmStudioError with code connection_error when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    let caught: LmStudioError | null = null
    try {
      await collectChunks(sendChatCompletion(MESSAGES))
    } catch (err) {
      caught = err as LmStudioError
    }

    expect(caught).not.toBeNull()
    expect(caught!.name).toBe('LmStudioError')
    expect(caught!.code).toBe('connection_error')
  })

  it('throws LmStudioError with code connection_error on a generic AbortError (not timer)', async () => {
    // A raw AbortError that did NOT come from our 30-second timer maps to connection_error
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError))

    let caught: LmStudioError | null = null
    try {
      await collectChunks(sendChatCompletion(MESSAGES))
    } catch (err) {
      caught = err as LmStudioError
    }

    expect(caught).not.toBeNull()
    expect(caught!.name).toBe('LmStudioError')
    expect(caught!.code).toBe('connection_error')
  })

  it('throws LmStudioError with code api_error on non-ok HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      body: null,
    }))

    let caught: LmStudioError | null = null
    try {
      await collectChunks(sendChatCompletion(MESSAGES))
    } catch (err) {
      caught = err as LmStudioError
    }

    expect(caught).not.toBeNull()
    expect(caught!.name).toBe('LmStudioError')
    expect(caught!.code).toBe('api_error')
    expect(caught!.status).toBe(500)
  })

  it('sets a 30-second timeout via AbortController', async () => {
    vi.useFakeTimers()

    // fetch never resolves
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        if (init.signal) {
          init.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        }
      })
    }))

    const promise = collectChunks(sendChatCompletion(MESSAGES))

    // Advance just under 30s — should not reject yet
    await vi.advanceTimersByTimeAsync(29_000)

    // Advance to 30s — should trigger abort
    await vi.advanceTimersByTimeAsync(1_001)

    let caught: LmStudioError | null = null
    try {
      await promise
    } catch (err) {
      caught = err as LmStudioError
    }

    expect(caught).not.toBeNull()
    expect(caught!.code).toBe('timeout')

    vi.useRealTimers()
  })

  it('passes an AbortSignal to fetch', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: createSseStream(['data: [DONE]\n']),
    })
    vi.stubGlobal('fetch', mockFetch)

    await collectChunks(sendChatCompletion(MESSAGES))

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('respects an externally provided AbortSignal', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        if (init.signal) {
          init.signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }
      })
    }))

    const promise = collectChunks(sendChatCompletion(MESSAGES, { signal: controller.signal }))
    controller.abort()

    let caught: LmStudioError | null = null
    try {
      await promise
    } catch (err) {
      caught = err as LmStudioError
    }

    expect(caught).not.toBeNull()
    expect(caught!.code).toBe('connection_error')
  })

  it('throws LmStudioError with code stream_error when response body is null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: null,
    }))

    let caught: LmStudioError | null = null
    try {
      await collectChunks(sendChatCompletion(MESSAGES))
    } catch (err) {
      caught = err as LmStudioError
    }

    expect(caught).not.toBeNull()
    expect(caught!.name).toBe('LmStudioError')
    expect(caught!.code).toBe('stream_error')
  })

  it('throws LmStudioError with code stream_error when the stream reader throws', async () => {
    const encoder = new TextEncoder()
    const errorStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hi"},"finish_reason":null}]}\n'))
        controller.error(new TypeError('Network connection lost'))
      },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: errorStream,
    }))

    let caught: LmStudioError | null = null
    try {
      await collectChunks(sendChatCompletion(MESSAGES))
    } catch (err) {
      caught = err as LmStudioError
    }

    expect(caught).not.toBeNull()
    expect(caught!.name).toBe('LmStudioError')
    expect(caught!.code).toBe('stream_error')
  })

  it('includes optional model in request body when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: createSseStream(['data: [DONE]\n']),
    })
    vi.stubGlobal('fetch', mockFetch)

    await collectChunks(sendChatCompletion(MESSAGES, { model: 'my-model' }))

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('my-model')
  })
})
