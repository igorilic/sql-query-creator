'use client'

import React, { useState } from 'react'
import Markdown from 'react-markdown'
import { Input } from '@ui/input'
import { Button } from '@ui/button'
import { Badge } from '@ui/badge'
import type { ChatMessage } from '@repo/shared/types'
import type { SchemaMeta } from '../contexts/chat-context'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChatPanelProps {
  messages: ChatMessage[]
  loading: boolean
  schemaContext?: SchemaMeta | null
  onSend: (text: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatPanel({ messages, loading, schemaContext, onSend }: ChatPanelProps) {
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
      {/* Schema context indicator */}
      {schemaContext && (
        <div className="flex items-center gap-2 px-6 pt-4 text-xs" data-testid="schema-indicator">
          {schemaContext.schemaAvailable ? (
            <Badge color="green">
              Schema loaded: {schemaContext.tableCount} {schemaContext.tableCount === 1 ? 'table' : 'tables'}
            </Badge>
          ) : (
            <Badge color="amber">
              {schemaContext.schemaError ?? 'No schema available — connect to a database for better results'}
            </Badge>
          )}
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-4 p-6 dark:text-zinc-300">
        {messages.map((msg) => (
          <article
            key={msg.id}
            data-role={msg.role}
            className={
              msg.role === 'user'
                ? 'rounded-lg bg-zinc-100 dark:bg-zinc-800 p-4'
                : 'rounded-lg bg-white dark:bg-zinc-800/50 p-4 ring-1 ring-zinc-200 dark:ring-zinc-700'
            }
          >
            <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-zinc-50 prose-pre:dark:bg-zinc-900 prose-pre:rounded-lg prose-pre:p-4 prose-pre:overflow-x-auto prose-code:font-mono">
              <Markdown>{msg.content}</Markdown>
            </div>
            {msg.sql && (
              <pre className="mt-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 p-4 overflow-x-auto text-sm">
                <code data-testid="sql-block" className="font-mono">{msg.sql}</code>
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
