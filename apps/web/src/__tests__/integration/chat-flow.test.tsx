/**
 * Step 21 — RED: Integration test — end-to-end chat flow.
 *
 * Scenario: User opens app (disconnected) → types message → assistant response
 * streams in → SQL extracted to editor → user sends follow-up → editor updates.
 * Also verifies conversation history accumulates and the copy button works.
 *
 * Strategy:
 *  - Use real contexts (ConnectionProvider + ChatProvider) and real page/component logic.
 *  - Mock heavy Catalyst @ui/* components (use browser APIs incompatible with happy-dom).
 *  - Mock CodeMirror with a plain textarea so we can assert value.
 *  - Mock fetch to control /api/chat SSE responses.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@uiw/react-codemirror', () => ({
  default: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string
    onChange?: (val: string) => void
    placeholder?: string
  }) => (
    <textarea
      data-testid="codemirror-editor"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}))

vi.mock('@codemirror/lang-sql', () => ({
  sql: vi.fn(() => ({})),
}))

vi.mock('@ui/sidebar-layout', () => ({
  SidebarLayout: ({
    navbar,
    sidebar,
    children,
  }: {
    navbar: React.ReactNode
    sidebar: React.ReactNode
    children: React.ReactNode
  }) => (
    <div data-testid="sidebar-layout">
      <div data-testid="layout-navbar">{navbar}</div>
      <div data-testid="layout-sidebar">{sidebar}</div>
      <div data-testid="layout-main">{children}</div>
    </div>
  ),
}))

vi.mock('@ui/navbar', () => ({
  Navbar: ({ children }: { children: React.ReactNode }) => <nav>{children}</nav>,
  NavbarSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  NavbarItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  NavbarLabel: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  NavbarSpacer: () => <div aria-hidden="true" />,
}))

vi.mock('@ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="status-badge">{children}</span>
  ),
}))

vi.mock('@ui/button', () => ({
  Button: ({
    children,
    onClick,
    type,
    disabled,
    'aria-label': ariaLabel,
  }: {
    children: React.ReactNode
    onClick?: () => void
    type?: string
    disabled?: boolean
    outline?: boolean
    'aria-label'?: string
  }) => (
    <button
      type={(type as 'button' | 'submit') ?? 'button'}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  ),
}))

vi.mock('@ui/sidebar', () => ({
  SidebarSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarHeading: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  SidebarItem: ({
    children,
    onClick,
    'aria-expanded': ariaExpanded,
    'aria-controls': ariaControls,
  }: {
    children: React.ReactNode
    onClick?: () => void
    'aria-expanded'?: boolean
    'aria-controls'?: string
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
    >
      {children}
    </button>
  ),
  SidebarLabel: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@ui/dialog', () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode
    open: boolean
    onClose: () => void
  }) =>
    open ? (
      <div role="dialog" data-testid="connection-dialog">
        {children}
      </div>
    ) : null,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogActions: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@ui/fieldset', () => ({
  Fieldset: ({ children }: { children: React.ReactNode }) => <fieldset>{children}</fieldset>,
  FieldGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Field: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}))

vi.mock('@ui/select', () => ({
  Select: ({
    children,
    value,
    onChange,
    name,
  }: {
    children: React.ReactNode
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
    name?: string
  }) => (
    <select name={name} value={value} onChange={onChange}>
      {children}
    </select>
  ),
}))

vi.mock('@ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    type,
    name,
    required,
    'aria-label': ariaLabel,
    className,
  }: {
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    placeholder?: string
    type?: string
    name?: string
    required?: boolean
    'aria-label'?: string
    className?: string
  }) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type ?? 'text'}
      name={name}
      required={required}
      aria-label={ariaLabel}
      className={className}
    />
  ),
}))

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { Providers } from '../../app/providers'
import HomePage from '../../app/page'

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
// Render helper
// ---------------------------------------------------------------------------

function renderApp() {
  return render(
    <Providers>
      <HomePage />
    </Providers>,
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: end-to-end chat flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    // Set up clipboard mock
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    })
  })

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  it('renders the app disconnected with empty chat and empty editor', () => {
    renderApp()

    // Status badge shows "Not connected"
    expect(screen.getByTestId('status-badge')).toHaveTextContent('Not connected')

    // No chat messages initially
    expect(screen.queryByRole('article')).not.toBeInTheDocument()

    // Editor starts empty
    expect(screen.getByTestId('codemirror-editor')).toHaveValue('')

    // Schema browser shows connect prompt (no DB connected)
    expect(screen.getByText('Connect a database to browse schema')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Happy path: message → stream → SQL extracted
  // -------------------------------------------------------------------------

  it('user sends a message, assistant response streams in, SQL is extracted to the editor', async () => {
    const assistantContent = 'Here is your query:\n```sql\nSELECT * FROM users\n```'
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      makeSseResponse([
        `data: ${JSON.stringify({ token: assistantContent })}\n\n`,
        'data: [DONE]\n\n',
      ]),
    )

    renderApp()

    const input = screen.getByRole('textbox', { name: /chat message/i })
    fireEvent.change(input, { target: { value: 'show me all users' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^send$/i }))
    })

    // Wait for streaming to finish (loading indicator disappears)
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    // User message is visible in the chat
    expect(screen.getByText('show me all users')).toBeInTheDocument()

    // Assistant article is rendered with the response content
    const assistantArticle = screen
      .getAllByRole('article')
      .find((el) => el.getAttribute('data-role') === 'assistant')
    expect(assistantArticle).toBeInTheDocument()
    expect(assistantArticle).toHaveTextContent('Here is your query')

    // Extracted SQL is in the editor
    expect(screen.getByTestId('codemirror-editor')).toHaveValue('SELECT * FROM users')
  })

  // -------------------------------------------------------------------------
  // Follow-up: editor updates with new SQL
  // -------------------------------------------------------------------------

  it('user sends a follow-up and the editor updates with the new SQL', async () => {
    const firstResponse = 'First answer:\n```sql\nSELECT * FROM users\n```'
    const secondResponse = 'Updated:\n```sql\nSELECT id, name FROM users WHERE active = true\n```'

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        makeSseResponse([
          `data: ${JSON.stringify({ token: firstResponse })}\n\n`,
          'data: [DONE]\n\n',
        ]),
      )
      .mockResolvedValueOnce(
        makeSseResponse([
          `data: ${JSON.stringify({ token: secondResponse })}\n\n`,
          'data: [DONE]\n\n',
        ]),
      )

    renderApp()

    const input = screen.getByRole('textbox', { name: /chat message/i })

    // --- First message ---
    fireEvent.change(input, { target: { value: 'show me all users' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^send$/i }))
    })
    await waitFor(() => {
      expect(screen.getByTestId('codemirror-editor')).toHaveValue('SELECT * FROM users')
    })

    // --- Follow-up ---
    fireEvent.change(input, { target: { value: 'only active users' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^send$/i }))
    })
    await waitFor(() => {
      expect(screen.getByTestId('codemirror-editor')).toHaveValue(
        'SELECT id, name FROM users WHERE active = true',
      )
    })
  })

  // -------------------------------------------------------------------------
  // Conversation history accumulates
  // -------------------------------------------------------------------------

  it('conversation history accumulates and is included in subsequent API calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        makeSseResponse(['data: {"token":"ok"}\n\n', 'data: [DONE]\n\n']),
      ),
    )

    renderApp()

    const input = screen.getByRole('textbox', { name: /chat message/i })

    // --- First message ---
    fireEvent.change(input, { target: { value: 'first question' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^send$/i }))
    })
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())

    // --- Second message ---
    fireEvent.change(input, { target: { value: 'follow up' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^send$/i }))
    })
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())

    // Second call must include history from the first exchange
    const secondCallBody = JSON.parse(fetchSpy.mock.calls[1][1]?.body as string)
    expect(Array.isArray(secondCallBody.history)).toBe(true)
    expect(secondCallBody.history.length).toBeGreaterThan(0)

    // Both user messages are visible in the chat
    expect(screen.getByText('first question')).toBeInTheDocument()
    expect(screen.getByText('follow up')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Copy button
  // -------------------------------------------------------------------------

  it('copy button copies the current SQL from the editor to the clipboard', async () => {
    const assistantContent = '```sql\nSELECT 1\n```'
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      makeSseResponse([
        `data: ${JSON.stringify({ token: assistantContent })}\n\n`,
        'data: [DONE]\n\n',
      ]),
    )

    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    })

    renderApp()

    const input = screen.getByRole('textbox', { name: /chat message/i })
    fireEvent.change(input, { target: { value: 'give me a query' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^send$/i }))
    })

    // Wait until SQL is in the editor
    await waitFor(() => {
      expect(screen.getByTestId('codemirror-editor')).toHaveValue('SELECT 1')
    })

    // Click copy
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy sql/i }))
    })

    expect(writeTextMock).toHaveBeenCalledWith('SELECT 1')
  })

  // -------------------------------------------------------------------------
  // Error resilience: LM Studio down
  // -------------------------------------------------------------------------

  it('LM Studio error does not crash the app and leaves no blank assistant bubble', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      makeSseResponse(['event: error\n', 'data: {"error":"LM Studio unavailable"}\n\n']),
    )

    renderApp()

    const input = screen.getByRole('textbox', { name: /chat message/i })
    fireEvent.change(input, { target: { value: 'any query' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^send$/i }))
    })

    // Loading must finish
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())

    // Only the user message should be in the chat — no blank assistant bubble
    const articles = screen.queryAllByRole('article')
    expect(articles).toHaveLength(1)
    expect(articles[0]).toHaveAttribute('data-role', 'user')
  })
})
