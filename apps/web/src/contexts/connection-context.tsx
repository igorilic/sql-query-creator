'use client'

import React, { createContext, useContext, useReducer, useCallback } from 'react'
import type { ConnectionConfig, ConnectionStatus, DatabaseSchema } from '@repo/shared/types'
import { isValidSchema } from '@repo/shared/type-guards'

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface ConnectionState {
  status: ConnectionStatus
  schema: DatabaseSchema | null
  connecting: boolean
}

const initialState: ConnectionState = {
  status: { connected: false },
  schema: null,
  connecting: false,
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type Action =
  | { type: 'CONNECTING' }
  | { type: 'CONNECTED'; payload: { type: 'postgresql' | 'sqlite' } }
  | { type: 'CONNECTION_ERROR'; payload: { error: string } }
  | { type: 'SCHEMA_LOADED'; payload: { schema: DatabaseSchema } }
  | { type: 'DISCONNECTED' }

function reducer(state: ConnectionState, action: Action): ConnectionState {
  switch (action.type) {
    case 'CONNECTING':
      return { ...state, connecting: true }
    case 'CONNECTED':
      return {
        ...state,
        connecting: false,
        status: { connected: true, type: action.payload.type },
      }
    case 'CONNECTION_ERROR':
      return {
        ...state,
        connecting: false,
        status: { connected: false, error: action.payload.error },
        schema: null,
      }
    case 'SCHEMA_LOADED':
      return { ...state, schema: action.payload.schema }
    case 'DISCONNECTED':
      return { status: { connected: false }, schema: null, connecting: false }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ConnectionContextValue {
  status: ConnectionStatus
  schema: DatabaseSchema | null
  connecting: boolean
  connect: (config: ConnectionConfig) => Promise<boolean>
  disconnect: () => void
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const connect = useCallback(async (config: ConnectionConfig): Promise<boolean> => {
    dispatch({ type: 'CONNECTING' })
    try {
      const connectRes = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      const connectBody = await connectRes.json()

      if (!connectRes.ok || connectBody.status !== 'connected') {
        dispatch({
          type: 'CONNECTION_ERROR',
          payload: { error: connectBody.error ?? 'Connection failed' },
        })
        return false
      }

      dispatch({ type: 'CONNECTED', payload: { type: connectBody.type } })

      // Fetch schema — best-effort; connection is still valid if this fails
      try {
        const schemaRes = await fetch('/api/schema')
        if (schemaRes.ok) {
          const body: unknown = await schemaRes.json()
          if (isValidSchema(body)) {
            dispatch({ type: 'SCHEMA_LOADED', payload: { schema: body } })
          }
        }
      } catch {
        // Schema unavailable — connection remains established
      }

      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      dispatch({ type: 'CONNECTION_ERROR', payload: { error: message } })
      return false
    }
  }, [])

  const disconnect = useCallback(() => {
    dispatch({ type: 'DISCONNECTED' })
  }, [])

  return (
    <ConnectionContext.Provider value={{ status: state.status, schema: state.schema, connecting: state.connecting, connect, disconnect }}>
      {children}
    </ConnectionContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useConnection(): ConnectionContextValue {
  const ctx = useContext(ConnectionContext)
  if (!ctx) {
    throw new Error('useConnection must be used within a ConnectionProvider')
  }
  return ctx
}
