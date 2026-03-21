import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import React from 'react'
import { ChatProvider, useChat } from '../chat-context'

// ---------------------------------------------------------------------------
// SSE stream helpers
// ---------------------------------------------------------------------------

function makeSseStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(event))
      }
      controller.close()
    },
  })
}

function makeSseResponse(events: string[]): Response {
  return new Response(makeSseStream(events), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

// ---------------------------------------------------------------------------
// Test consumer component
// ---------------------------------------------------------------------------

function TestConsumer() {
  const { messages, loading, currentSql, sendMessage, clearChat } = useChat()
  return (
    <div>
      <span data-testid="message-count">{messages.length}</span>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="current-sql">{currentSql ?? 'null'}</span>
      <ul data-testid="messages">
        {messages.map((m, i) => (
          <li key={m.id} data-testid={`msg-${i}`} data-role={m.role}>
            {m.content}
          </li>
        ))}
      </ul>
      <button data-testid="send-btn" onClick={() => sendMessage('show me all users')}>
        Send
      </button>
      <button data-testid="clear-btn" onClick={clearChat}>
        Clear
      </button>
    </div>
  )
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ChatProvider>{children}</ChatProvider>
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChatContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------
  it('starts with empty messages, loading=false, and currentSql=null', () => {
    render(<TestConsumer />, { wrapper: Wrapper })

    expect(screen.getByTestId('message-count').textContent).toBe('0')
    expect(screen.getByTestId('loading').textContent).toBe('false')
    expect(screen.getByTestId('current-sql').textContent).toBe('null')
  })

  // -------------------------------------------------------------------------
  // sendMessage — happy path streaming
  // -------------------------------------------------------------------------
  it('sendMessage adds user message then accumulates streamed tokens into assistant message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      makeSseResponse([
        'data: {"token":"SELECT"}\n\n',
        'data: {"token":" * FROM users"}\n\n',
        'data: [DONE]\n\n',
      ]),
    )

    render(<TestConsumer />, { wrapper: Wrapper })

    await act(async () => {
      screen.getByTestId('send-btn').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })

    // Two messages: user + assistant
    expect(screen.getByTestId('message-count').textContent).toBe('2')

    const msg0 = screen.getByTestId('msg-0')
    expect(msg0.getAttribute('data-role')).toBe('user')
    expect(msg0.textContent).toBe('show me all users')

    const msg1 = screen.getByTestId('msg-1')
    expect(msg1.getAttribute('data-role')).toBe('assistant')
    expect(msg1.textContent).toBe('SELECT * FROM users')
  })

  // -------------------------------------------------------------------------
  // SQL extraction
  // -------------------------------------------------------------------------
  it('extracts SQL from a markdown code block in the assistant response and sets currentSql', async () => {
    const assistantContent = 'Here is the query:\n```sql\nSELECT id FROM orders\n```'
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      makeSseResponse([
        `data: ${JSON.stringify({ token: assistantContent })}\n\n`,
        'data: [DONE]\n\n',
      ]),
    )

    render(<TestConsumer />, { wrapper: Wrapper })

    await act(async () => {
      screen.getByTestId('send-btn').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })

    expect(screen.getByTestId('current-sql').textContent).toBe('SELECT id FROM orders')
  })

  // -------------------------------------------------------------------------
  // currentSql stays null when no SQL block present
  // -------------------------------------------------------------------------
  it('does not change currentSql when assistant response contains no SQL block', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      makeSseResponse([
        'data: {"token":"Sure, I can help with that."}\n\n',
        'data: [DONE]\n\n',
      ]),
    )

    render(<TestConsumer />, { wrapper: Wrapper })

    await act(async () => {
      screen.getByTestId('send-btn').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })

    expect(screen.getByTestId('current-sql').textContent).toBe('null')
  })

  // -------------------------------------------------------------------------
  // History passed to subsequent API calls
  // -------------------------------------------------------------------------
  it('sends existing messages as history on subsequent sendMessage calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        makeSseResponse(['data: {"token":"ok"}\n\n', 'data: [DONE]\n\n']),
      ),
    )

    render(<TestConsumer />, { wrapper: Wrapper })

    // First send
    await act(async () => {
      screen.getByTestId('send-btn').click()
    })
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

    // Second send — history should include the previous exchange
    await act(async () => {
      screen.getByTestId('send-btn').click()
    })
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

    const secondCallBody = JSON.parse(fetchSpy.mock.calls[1][1]?.body as string)
    expect(Array.isArray(secondCallBody.history)).toBe(true)
    expect(secondCallBody.history.length).toBeGreaterThan(0)
  })

  // -------------------------------------------------------------------------
  // History trimmed at 20 messages
  // -------------------------------------------------------------------------
  it('trims the messages array to at most 20 entries when many messages accumulate', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        makeSseResponse(['data: {"token":"ok"}\n\n', 'data: [DONE]\n\n']),
      ),
    )

    render(<TestConsumer />, { wrapper: Wrapper })

    // 11 sends × (1 user + 1 assistant) = 22 messages → capped at 20
    for (let i = 0; i < 11; i++) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        screen.getByTestId('send-btn').click()
      })
      // eslint-disable-next-line no-await-in-loop
      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    }

    expect(Number(screen.getByTestId('message-count').textContent)).toBeLessThanOrEqual(20)
  })

  // -------------------------------------------------------------------------
  // SSE error event
  // -------------------------------------------------------------------------
  it('sets loading=false after an SSE error event without crashing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      makeSseResponse(['event: error\n', 'data: {"error":"LM Studio unavailable"}\n\n']),
    )

    render(<TestConsumer />, { wrapper: Wrapper })

    await act(async () => {
      screen.getByTestId('send-btn').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })

    expect(screen.getByTestId('loading').textContent).toBe('false')
  })

  // -------------------------------------------------------------------------
  // Network / fetch error
  // -------------------------------------------------------------------------
  it('sets loading=false when fetch throws a network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    render(<TestConsumer />, { wrapper: Wrapper })

    await act(async () => {
      screen.getByTestId('send-btn').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
  })

  // -------------------------------------------------------------------------
  // Concurrent sendMessage guard (Finding 1)
  // -------------------------------------------------------------------------
  it('ignores a second sendMessage call while the first is still streaming', async () => {
    // Deferred resolution — lets us control when the first fetch resolves
    let resolveFirst!: (r: Response) => void
    const firstFetch = new Promise<Response>((resolve) => {
      resolveFirst = resolve
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy.mockReturnValueOnce(firstFetch)

    render(<TestConsumer />, { wrapper: Wrapper })

    // Start the first send (does not await — intentionally leaves it in-flight)
    act(() => {
      screen.getByTestId('send-btn').click()
    })

    // At this point loading should be true — fire a second send synchronously
    act(() => {
      screen.getByTestId('send-btn').click()
    })

    // Resolve the first stream so the component can settle
    resolveFirst(
      makeSseResponse(['data: {"token":"ok"}\n\n', 'data: [DONE]\n\n']),
    )

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

    // fetch must have been called exactly once — the second send was blocked
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  // -------------------------------------------------------------------------
  // STREAM_ERROR removes orphan placeholder (Finding 2)
  // -------------------------------------------------------------------------
  it('removes the empty assistant placeholder from messages on SSE error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      makeSseResponse(['event: error\n', 'data: {"error":"LM Studio unavailable"}\n\n']),
    )

    render(<TestConsumer />, { wrapper: Wrapper })

    await act(async () => {
      screen.getByTestId('send-btn').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })

    // Only the user message remains — no blank assistant bubble
    expect(screen.getByTestId('message-count').textContent).toBe('1')
  })

  it('removes the empty assistant placeholder from messages on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    render(<TestConsumer />, { wrapper: Wrapper })

    await act(async () => {
      screen.getByTestId('send-btn').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })

    // Only the user message remains — no blank assistant bubble
    expect(screen.getByTestId('message-count').textContent).toBe('1')
  })

  // -------------------------------------------------------------------------
  // clearChat action (Finding 3)
  // -------------------------------------------------------------------------
  it('clearChat resets messages, currentSql, and loading back to initial state', async () => {
    const assistantContent = 'Here is the query:\n```sql\nSELECT 1\n```'
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      makeSseResponse([
        `data: ${JSON.stringify({ token: assistantContent })}\n\n`,
        'data: [DONE]\n\n',
      ]),
    )

    render(<TestConsumer />, { wrapper: Wrapper })

    // Send a message so we have state to clear
    await act(async () => {
      screen.getByTestId('send-btn').click()
    })
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

    expect(screen.getByTestId('message-count').textContent).toBe('2')
    expect(screen.getByTestId('current-sql').textContent).toBe('SELECT 1')

    // Clear
    act(() => {
      screen.getByTestId('clear-btn').click()
    })

    expect(screen.getByTestId('message-count').textContent).toBe('0')
    expect(screen.getByTestId('current-sql').textContent).toBe('null')
    expect(screen.getByTestId('loading').textContent).toBe('false')
  })

  // -------------------------------------------------------------------------
  // useChat outside provider
  // -------------------------------------------------------------------------
  it('throws when useChat is used outside ChatProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestConsumer />)).toThrow()
    spy.mockRestore()
  })
})
