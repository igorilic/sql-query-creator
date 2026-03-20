import type { LmStudioMessage, LmStudioOptions, LmStudioError } from './types'

const TIMEOUT_MS = 30_000
const DEFAULT_BASE_URL = 'http://localhost:1234/v1'

function createLmStudioError(
  message: string,
  code: LmStudioError['code'],
  status?: number,
): LmStudioError {
  const err = new Error(message) as LmStudioError
  err.name = 'LmStudioError'
  err.code = code
  if (status !== undefined) err.status = status
  return err
}

function getBaseUrl(): string {
  return process.env.LMSTUDIO_BASE_URL ?? DEFAULT_BASE_URL
}

/**
 * Sends a chat completion request to LM Studio (OpenAI-compatible API) and
 * yields token content chunks from the SSE stream.
 */
export async function* sendChatCompletion(
  messages: LmStudioMessage[],
  options: LmStudioOptions = {},
): AsyncGenerator<string> {
  const { model, temperature, maxTokens, signal: externalSignal } = options

  // Track whether the timeout fired so we can distinguish it from an external abort
  let timedOut = false
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => {
    timedOut = true
    timeoutController.abort()
  }, TIMEOUT_MS)

  // Combine internal timeout signal with optional external signal
  const signal = externalSignal
    ? anySignal([timeoutController.signal, externalSignal])
    : timeoutController.signal

  const body: Record<string, unknown> = { messages, stream: true }
  if (model !== undefined) body.model = model
  if (temperature !== undefined) body.temperature = temperature
  if (maxTokens !== undefined) body.max_tokens = maxTokens

  let response: Response
  try {
    response = await fetch(`${getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (timedOut) {
        throw createLmStudioError('Request timed out after 30 seconds', 'timeout')
      }
      throw createLmStudioError('Request was cancelled', 'connection_error')
    }
    throw createLmStudioError(
      err instanceof Error ? err.message : 'Connection failed',
      'connection_error',
    )
  }

  if (!response.ok) {
    clearTimeout(timeoutId)
    throw createLmStudioError(
      `API error: ${response.status} ${response.statusText}`,
      'api_error',
      response.status,
    )
  }

  if (response.body === null) {
    clearTimeout(timeoutId)
    throw createLmStudioError('Response body is null', 'stream_error')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      let done: boolean
      let value: Uint8Array | undefined
      try {
        ;({ done, value } = await reader.read())
      } catch (err) {
        throw createLmStudioError(
          err instanceof Error ? err.message : 'Stream read failed',
          'stream_error',
        )
      }
      if (done) break

      const text = decoder.decode(value, { stream: true })
      for (const line of text.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue

        const data = trimmed.slice('data:'.length).trim()
        if (data === '[DONE]') return

        try {
          const parsed = JSON.parse(data) as {
            choices: Array<{ delta?: { content?: string }; finish_reason: string | null }>
          }
          const content = parsed.choices[0]?.delta?.content
          if (content) yield content
        } catch {
          // Malformed SSE line — skip
        }
      }
    }
  } finally {
    clearTimeout(timeoutId)
    reader.releaseLock()
  }
}

/**
 * Returns an AbortSignal that aborts when ANY of the provided signals aborts.
 * Cleans up listeners when the combined signal fires.
 */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()

  const handlers: Array<{ signal: AbortSignal; handler: () => void }> = []

  const cleanup = (): void => {
    for (const { signal, handler } of handlers) {
      signal.removeEventListener('abort', handler)
    }
  }

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort()
      cleanup()
      return controller.signal
    }
    const handler = (): void => {
      controller.abort()
      cleanup()
    }
    handlers.push({ signal, handler })
    signal.addEventListener('abort', handler, { once: true })
  }

  return controller.signal
}
