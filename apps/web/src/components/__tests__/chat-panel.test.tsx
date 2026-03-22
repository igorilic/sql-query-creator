import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Mocks — Catalyst components use browser APIs unavailable in jsdom.
// ---------------------------------------------------------------------------

vi.mock('@ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}))

vi.mock('@ui/button', () => ({
  Button: ({
    children,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button {...rest}>{children}</button>
  ),
}))

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

    expect(screen.getByRole('textbox', { name: /chat message/i })).toBeInTheDocument()
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

    const codeBlock = screen.getByTestId('sql-block')
    expect(codeBlock).toBeInTheDocument()
    expect(codeBlock.textContent).toContain('SELECT * FROM users;')
  })

  it('does not render a <code> element when assistant message has no sql', () => {
    renderPanel({ messages: [assistantMessageNoSql] })

    expect(screen.queryByTestId('sql-block')).not.toBeInTheDocument()
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

  it('does not call onSend when loading even if form is submitted directly', () => {
    const { onSend } = renderPanel({ loading: true })

    const input = screen.getByRole('textbox', { name: /chat message/i })
    fireEvent.change(input, { target: { value: 'Show me all users' } })
    fireEvent.submit(input.closest('form')!)

    expect(onSend).not.toHaveBeenCalled()
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

  // -------------------------------------------------------------------------
  // Dark mode classes
  // -------------------------------------------------------------------------
  describe('dark mode classes', () => {
    it('form container has dark:border-zinc-700', () => {
      renderPanel()
      const form = screen.getByRole('textbox', { name: /chat message/i }).closest('form')!
      expect(form.className).toContain('dark:border-zinc-700')
    })

    it('message area has dark:text-zinc-300', () => {
      renderPanel({ messages: [userMessage] })
      const msgArea = screen.getByText('Show me all users').closest('div[class*="overflow"]')!
      expect(msgArea.className).toContain('dark:text-zinc-300')
    })
  })

  // -------------------------------------------------------------------------
  // Message spacing and visual styling
  // -------------------------------------------------------------------------
  describe('message spacing and styling', () => {
    it('message list has space-y-4 and p-6 for adequate spacing', () => {
      renderPanel({ messages: [userMessage] })
      const msgArea = screen.getByText('Show me all users').closest('div[class*="overflow"]')!
      expect(msgArea.className).toContain('space-y-4')
      expect(msgArea.className).toContain('p-6')
    })

    it('user message has rounded background styling', () => {
      renderPanel({ messages: [userMessage] })
      const article = screen.getByText('Show me all users').closest('article')!
      expect(article.className).toContain('rounded-lg')
      expect(article.className).toContain('bg-zinc-100')
      expect(article.className).toContain('dark:bg-zinc-800')
      expect(article.className).toContain('p-4')
    })

    it('assistant message has distinct styling from user message', () => {
      renderPanel({ messages: [assistantMessageNoSql] })
      const article = screen.getByText('I need more context to answer that.').closest('article')!
      expect(article.className).toContain('rounded-lg')
      expect(article.className).toContain('bg-white')
      expect(article.className).toContain('dark:bg-zinc-800/50')
      expect(article.className).toContain('p-4')
    })

    it('SQL code block has background, padding, and overflow-x-auto', () => {
      renderPanel({ messages: [assistantMessage] })
      const pre = screen.getByTestId('sql-block').closest('pre')!
      expect(pre.className).toContain('rounded-lg')
      expect(pre.className).toContain('bg-zinc-50')
      expect(pre.className).toContain('dark:bg-zinc-900')
      expect(pre.className).toContain('p-4')
      expect(pre.className).toContain('overflow-x-auto')
      expect(pre.className).toContain('mt-3')
    })

    it('SQL code element has font-mono class', () => {
      renderPanel({ messages: [assistantMessage] })
      const code = screen.getByTestId('sql-block')
      expect(code.className).toContain('font-mono')
    })
  })
})
