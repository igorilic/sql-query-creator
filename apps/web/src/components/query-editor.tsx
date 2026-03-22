'use client'

import React, { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { sql } from '@codemirror/lang-sql'
import { Button } from '@ui/button'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QueryEditorProps {
  value: string
  onChange?: (value: string) => void
  placeholder?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QueryEditor({
  value,
  onChange,
  placeholder = '-- Write your SQL here',
}: QueryEditorProps) {
  const [copyError, setCopyError] = useState<string | null>(null)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopyError(null)
    } catch {
      setCopyError('Failed to copy')
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        role="toolbar"
        aria-label="Editor actions"
        className="flex items-center justify-end gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700"
      >
        {copyError && (
          <span role="alert" className="text-sm text-red-600 dark:text-red-400">
            {copyError}
          </span>
        )}
        <Button
          type="button"
          outline
          onClick={handleCopy}
          aria-label="Copy SQL"
          className="px-5 py-2"
        >
          Copy
        </Button>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={value}
          onChange={onChange}
          extensions={[sql()]}
          placeholder={placeholder}
          height="100%"
        />
      </div>
    </div>
  )
}
