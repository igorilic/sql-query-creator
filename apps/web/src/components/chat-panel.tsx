'use client'

import React, { useState } from 'react'
import { Input } from '@ui/input'
import { Button } from '@ui/button'
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
      <div className="flex-1 overflow-y-auto space-y-2 p-4 dark:text-zinc-300">
        {messages.map((msg) => (
          <article key={msg.id} data-role={msg.role}>
            <p>{msg.content}</p>
            {msg.sql && (
              <pre>
                <code data-testid="sql-block">{msg.sql}</code>
              </pre>
            )}
          </article>
        ))}

        {/* Loading indicator */}
        {loading && <div role="status" aria-label="Loading…">…</div>}
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t border-zinc-200 dark:border-zinc-700">
        <Input
          type="text"
          aria-label="Chat message"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1"
          placeholder="Ask a question…"
        />
        <Button type="submit" disabled={!canSubmit}>
          Send
        </Button>
      </form>
    </div>
  )
}
