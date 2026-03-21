'use client'

import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react'
import type { ChatMessage } from '@repo/shared/types'
import { parseSqlFromMarkdown } from '@repo/shared/parse-sql'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_MESSAGES = 20

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface ChatState {
  messages: ChatMessage[]
  loading: boolean
  currentSql: string | null
}

const initialState: ChatState = {
  messages: [],
  loading: false,
  currentSql: null,
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type Action =
  | { type: 'SEND_MESSAGE'; payload: ChatMessage }
  | { type: 'STREAM_START'; payload: { message: ChatMessage } }
  | { type: 'STREAM_TOKEN'; payload: { id: string; token: string } }
  | { type: 'STREAM_DONE'; payload: { id: string; sql: string | null } }
  | { type: 'STREAM_ERROR' }

function reducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case 'SEND_MESSAGE': {
      const messages = [...state.messages, action.payload].slice(-MAX_MESSAGES)
      return { ...state, messages, loading: true }
    }
    case 'STREAM_START': {
      const messages = [...state.messages, action.payload.message].slice(-MAX_MESSAGES)
      return { ...state, messages }
    }
    case 'STREAM_TOKEN': {
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.payload.id
            ? { ...m, content: m.content + action.payload.token }
            : m,
        ),
      }
    }
    case 'STREAM_DONE': {
      return {
        ...state,
        loading: false,
        currentSql: action.payload.sql !== null ? action.payload.sql : state.currentSql,
        messages: state.messages.map((m) =>
          m.id === action.payload.id && action.payload.sql !== null
            ? { ...m, sql: action.payload.sql }
            : m,
        ),
      }
    }
    case 'STREAM_ERROR': {
      return { ...state, loading: false }
    }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// SSE parser
// ---------------------------------------------------------------------------

async function* parseSSEEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ token?: string; error?: string }> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEventType = 'message'

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const parts = buffer.split('\n')
      buffer = parts.pop() ?? ''

      for (const line of parts) {
        if (line.startsWith('event: ')) {
          currentEventType = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') return
          try {
            const parsed = JSON.parse(data) as Record<string, unknown>
            if (currentEventType === 'error') {
              yield { error: typeof parsed.error === 'string' ? parsed.error : 'Unknown error' }
              return
            } else if (typeof parsed.token === 'string') {
              yield { token: parsed.token }
            }
          } catch {
            // ignore malformed JSON
          }
          currentEventType = 'message'
        } else if (line === '') {
          currentEventType = 'message'
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ChatContextValue {
  messages: ChatMessage[]
  loading: boolean
  currentSql: string | null
  sendMessage: (text: string) => Promise<void>
}

const ChatContext = createContext<ChatContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Stable ref so sendMessage always reads the latest messages without needing
  // to be recreated on every state change.
  const messagesRef = useRef<ChatMessage[]>(state.messages)
  messagesRef.current = state.messages

  const sendMessage = useCallback(async (text: string) => {
    const history = messagesRef.current

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    dispatch({ type: 'SEND_MESSAGE', payload: userMessage })

    const assistantId = crypto.randomUUID()
    dispatch({
      type: 'STREAM_START',
      payload: {
        message: {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
        },
      },
    })

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      })

      if (!res.ok || !res.body) {
        dispatch({ type: 'STREAM_ERROR' })
        return
      }

      let fullContent = ''
      for await (const event of parseSSEEvents(res.body)) {
        if (event.token !== undefined) {
          fullContent += event.token
          dispatch({ type: 'STREAM_TOKEN', payload: { id: assistantId, token: event.token } })
        } else if (event.error !== undefined) {
          dispatch({ type: 'STREAM_ERROR' })
          return
        }
      }

      const sqls = parseSqlFromMarkdown(fullContent)
      const sql = sqls[0] ?? null
      dispatch({ type: 'STREAM_DONE', payload: { id: assistantId, sql } })
    } catch {
      dispatch({ type: 'STREAM_ERROR' })
    }
  }, [])

  return (
    <ChatContext.Provider
      value={{
        messages: state.messages,
        loading: state.loading,
        currentSql: state.currentSql,
        sendMessage,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext)
  if (!ctx) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return ctx
}
