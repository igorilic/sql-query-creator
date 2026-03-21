import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { ChatPanel } from '../chat-panel'
import type { ChatMessage } from '@repo/shared/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const userMessage: ChatMessage = {
  id: 'msg-1',
  role: 'user',
  content: 'Show me all users',
  timestamp: 1000,
}

const assistantMessage: ChatMessage = {
  id: 'msg-2',
  role: 'assistant',
  content: 'Here is a query:\n```sql\nSELECT * FROM users;\n```',
  sql: 'SELECT * FROM users;',
  timestamp: 2000,
}

const assistantMessageNoSql: ChatMessage = {
  id: 'msg-3',
  role: 'assistant',
  content: 'I need more context to answer that.',
  timestamp: 3000,
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderPanel(overrides: Partial<React.ComponentProps<typeof ChatPanel>> = {}) {
  const props = {
    messages: [] as ChatMessage[],
    loading: false,
    onSend: vi.fn(),
    ...overrides,
  }
  return { ...render(<ChatPanel {...props} />), ...props }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------
  it('renders the input field and submit button', () => {
    renderPanel()

    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // User message rendering
  // -------------------------------------------------------------------------
  it('displays user messages', () => {
    renderPanel({ messages: [userMessage] })

    expect(screen.getByText('Show me all users')).toBeInTheDocument()
  })

  it('marks user messages with a "user" role indicator', () => {
    renderPanel({ messages: [userMessage] })

    // A data-role attribute or visible "You" label distinguishes the message
    const userEl = screen.getByText('Show me all users').closest('[data-role="user"]')
    expect(userEl).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Assistant message rendering
  // -------------------------------------------------------------------------
  it('displays assistant messages', () => {
    renderPanel({ messages: [assistantMessageNoSql] })

    expect(screen.getByText('I need more context to answer that.')).toBeInTheDocument()
  })

  it('marks assistant messages with a "assistant" role indicator', () => {
    renderPanel({ messages: [assistantMessageNoSql] })

    const assistantEl = screen
      .getByText('I need more context to answer that.')
      .closest('[data-role="assistant"]')
    expect(assistantEl).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Multiple messages — order preserved
  // -------------------------------------------------------------------------
  it('renders multiple messages in order', () => {
    renderPanel({ messages: [userMessage, assistantMessageNoSql] })

    const messages = screen.getAllByRole('article')
    expect(messages).toHaveLength(2)
  })

  // -------------------------------------------------------------------------
  // SQL block rendered distinctly
  // -------------------------------------------------------------------------
  it('renders SQL code block inside a <code> element for assistant messages with sql', () => {
    renderPanel({ messages: [assistantMessage] })

    const codeBlock = screen.getByRole('code')
    expect(codeBlock).toBeInTheDocument()
    expect(codeBlock.textContent).toContain('SELECT * FROM users;')
  })

  it('does not render a <code> element when assistant message has no sql', () => {
    renderPanel({ messages: [assistantMessageNoSql] })

    expect(screen.queryByRole('code')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Input field interaction
  // -------------------------------------------------------------------------
  it('accepts text typed into the input field', () => {
    renderPanel()

    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'List all orders' } })

    expect(input.value).toBe('List all orders')
  })

  // -------------------------------------------------------------------------
  // Submit — fires onSend with text and clears field
  // -------------------------------------------------------------------------
  it('calls onSend with the input value when send is clicked', () => {
    const { onSend } = renderPanel()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Show me all users' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    expect(onSend).toHaveBeenCalledOnce()
    expect(onSend).toHaveBeenCalledWith('Show me all users')
  })

  it('clears the input field after submit', () => {
    renderPanel()

    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Show me all users' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    expect(input.value).toBe('')
  })

  it('submits via the Enter key', () => {
    const { onSend } = renderPanel()

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Give me the schema' } })
    fireEvent.submit(input.closest('form')!)

    expect(onSend).toHaveBeenCalledWith('Give me the schema')
  })

  // -------------------------------------------------------------------------
  // Submit disabled while loading
  // -------------------------------------------------------------------------
  it('disables the send button while loading', () => {
    renderPanel({ loading: true })

    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('enables the send button when not loading', () => {
    renderPanel({ loading: false })

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } })
    expect(screen.getByRole('button', { name: /send/i })).not.toBeDisabled()
  })

  // -------------------------------------------------------------------------
  // Empty input cannot be submitted
  // -------------------------------------------------------------------------
  it('disables the send button when input is empty', () => {
    renderPanel()

    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('does not call onSend when input is empty and form is submitted', () => {
    const { onSend } = renderPanel()

    const input = screen.getByRole('textbox')
    fireEvent.submit(input.closest('form')!)

    expect(onSend).not.toHaveBeenCalled()
  })

  it('disables send button when input contains only whitespace', () => {
    renderPanel()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  // -------------------------------------------------------------------------
  // Loading indicator
  // -------------------------------------------------------------------------
  it('shows a loading indicator while loading is true', () => {
    renderPanel({ loading: true })

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('does not show a loading indicator when loading is false', () => {
    renderPanel({ loading: false })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
