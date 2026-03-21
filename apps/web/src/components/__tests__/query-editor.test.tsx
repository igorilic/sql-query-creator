import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Mocks — CodeMirror uses browser APIs unavailable in the test environment.
// Replace with a plain textarea so we can assert value / onChange / placeholder.
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

vi.mock('@ui/button', () => ({
  Button: ({
    children,
    onClick,
    'aria-label': ariaLabel,
    type,
  }: {
    children: React.ReactNode
    onClick?: () => void
    'aria-label'?: string
    type?: string
    outline?: boolean
  }) => (
    <button type={(type as 'button' | 'submit' | 'reset') ?? 'button'} onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}))

import { QueryEditor } from '../query-editor'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SQL_FIXTURE = 'SELECT * FROM users;'

function renderEditor(
  props: Partial<React.ComponentProps<typeof QueryEditor>> = {},
) {
  const merged = {
    value: SQL_FIXTURE,
    onChange: vi.fn(),
    ...props,
  }
  return { ...render(<QueryEditor {...merged} />), ...merged }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('QueryEditor', () => {
  let writeTextMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    writeTextMock = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', {
      clipboard: { writeText: writeTextMock },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Content is displayed
  // -------------------------------------------------------------------------
  it('displays the provided SQL content in the editor', () => {
    renderEditor()

    const editor = screen.getByTestId('codemirror-editor') as HTMLTextAreaElement
    expect(editor.value).toBe(SQL_FIXTURE)
  })

  it('displays different SQL when value prop changes', () => {
    renderEditor({ value: 'SELECT id FROM orders;' })

    const editor = screen.getByTestId('codemirror-editor') as HTMLTextAreaElement
    expect(editor.value).toBe('SELECT id FROM orders;')
  })

  // -------------------------------------------------------------------------
  // Content is editable — onChange callback fires
  // -------------------------------------------------------------------------
  it('calls onChange when the editor content is changed', () => {
    const { onChange } = renderEditor()

    const editor = screen.getByTestId('codemirror-editor')
    fireEvent.change(editor, { target: { value: 'SELECT id FROM users;' } })

    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith('SELECT id FROM users;')
  })

  // -------------------------------------------------------------------------
  // Copy button
  // -------------------------------------------------------------------------
  it('renders a copy button', () => {
    renderEditor()

    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
  })

  it('calls navigator.clipboard.writeText with the current content when copy is clicked', () => {
    renderEditor({ value: SQL_FIXTURE })

    fireEvent.click(screen.getByRole('button', { name: /copy/i }))

    expect(writeTextMock).toHaveBeenCalledOnce()
    expect(writeTextMock).toHaveBeenCalledWith(SQL_FIXTURE)
  })

  it('copies updated content after value prop changes', () => {
    const { rerender } = render(<QueryEditor value={SQL_FIXTURE} onChange={vi.fn()} />)

    rerender(<QueryEditor value="SELECT id FROM products;" onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /copy/i }))

    expect(writeTextMock).toHaveBeenCalledWith('SELECT id FROM products;')
  })

  it('calls navigator.clipboard.writeText with empty string when value is empty', () => {
    renderEditor({ value: '' })

    fireEvent.click(screen.getByRole('button', { name: /copy/i }))

    expect(writeTextMock).toHaveBeenCalledOnce()
    expect(writeTextMock).toHaveBeenCalledWith('')
  })

  it('shows an error message when clipboard write is rejected', async () => {
    writeTextMock.mockRejectedValue(new Error('Permission denied'))
    renderEditor()

    fireEvent.click(screen.getByRole('button', { name: /copy/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent(/failed to copy/i)
    })
  })

  it('does not throw an uncaught error when clipboard write is rejected', async () => {
    writeTextMock.mockRejectedValue(new Error('Permission denied'))
    renderEditor()

    await expect(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy/i }))
      await waitFor(() => screen.getByRole('alert'))
    }).not.toThrow()
  })

  // -------------------------------------------------------------------------
  // Toolbar accessibility
  // -------------------------------------------------------------------------
  it('renders the toolbar with role="toolbar" and aria-label', () => {
    renderEditor()

    const toolbar = screen.getByRole('toolbar')
    expect(toolbar).toBeInTheDocument()
    expect(toolbar).toHaveAttribute('aria-label', 'Editor actions')
  })

  // -------------------------------------------------------------------------
  // Empty string — shows placeholder
  // -------------------------------------------------------------------------
  it('shows placeholder when value is empty string', () => {
    renderEditor({ value: '', placeholder: '-- Write your SQL here' })

    const editor = screen.getByTestId('codemirror-editor') as HTMLTextAreaElement
    expect(editor.placeholder).toBe('-- Write your SQL here')
  })

  it('renders with empty value without crashing', () => {
    renderEditor({ value: '' })

    const editor = screen.getByTestId('codemirror-editor') as HTMLTextAreaElement
    expect(editor.value).toBe('')
  })

  it('uses a default placeholder when none is provided', () => {
    renderEditor({ value: '' })

    const editor = screen.getByTestId('codemirror-editor') as HTMLTextAreaElement
    expect(editor.placeholder).toBeTruthy()
  })
})
