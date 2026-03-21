'use client'

import React, { useState } from 'react'
import type { ChatMessage } from '@repo/shared/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChatPanelProps {
  messages: ChatMessage[]
  loading: boolean
  onSend: (text: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatPanel({ messages, loading, onSend }: ChatPanelProps) {
  const [input, setInput] = useState('')

  const canSubmit = input.trim().length > 0 && !loading

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    onSend(input.trim())
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-2 p-4">
        {messages.map((msg) => (
          <article key={msg.id} data-role={msg.role}>
            <p>{msg.content}</p>
            {msg.sql && (
              <pre>
                <code role="code">{msg.sql}</code>
              </pre>
            )}
          </article>
        ))}

        {/* Loading indicator */}
        {loading && <div role="status" aria-label="Loading…">…</div>}
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 border rounded px-2 py-1"
          placeholder="Ask a question…"
        />
        <button type="submit" disabled={!canSubmit}>
          Send
        </button>
      </form>
    </div>
  )
}
