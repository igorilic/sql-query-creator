'use client'

import React from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { sql } from '@codemirror/lang-sql'

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
  function handleCopy() {
    navigator.clipboard.writeText(value)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex justify-end p-2 border-b">
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy SQL"
          className="text-sm px-3 py-1 rounded border hover:bg-gray-50"
        >
          Copy
        </button>
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
