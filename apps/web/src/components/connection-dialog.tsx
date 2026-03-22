'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@ui/button'
import type { ConnectionConfig } from '@repo/shared/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ConnectionDialogProps {
  open: boolean
  onClose: () => void
  onConnect: (config: ConnectionConfig) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConnectionDialog({ open, onClose, onConnect }: ConnectionDialogProps) {
  const [dbType, setDbType] = useState<'postgresql' | 'sqlite'>('postgresql')
  const dialogRef = useRef<HTMLDivElement>(null)

  // PostgreSQL fields
  const [host, setHost] = useState('')
  const [port, setPort] = useState('5432')
  const [database, setDatabase] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // SQLite fields
  const [filePath, setFilePath] = useState('')

  const portNumber = parseInt(port, 10)
  const portValid = /^\d+$/.test(port) && portNumber > 0 && portNumber <= 65535

  const isValid =
    dbType === 'postgresql'
      ? Boolean(host && portValid && database && username)
      : Boolean(filePath)

  function resetFields() {
    setDbType('postgresql')
    setHost('')
    setPort('5432')
    setDatabase('')
    setUsername('')
    setPassword('')
    setFilePath('')
  }

  function handleClose() {
    resetFields()
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return

    if (dbType === 'postgresql') {
      onConnect({
        type: 'postgresql',
        host,
        port: portNumber,
        database,
        username,
        password,
      })
    } else {
      onConnect({ type: 'sqlite', filePath })
    }
  }

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  // Close on backdrop click
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) handleClose()
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="connection-dialog-title"
      className="fixed inset-0 z-[100] flex items-center justify-center"
      data-testid="connection-dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-zinc-950/25 dark:bg-zinc-950/50"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-lg mx-4 rounded-2xl bg-white dark:bg-zinc-900 p-8 shadow-lg ring-1 ring-zinc-950/10 dark:ring-white/10"
      >
        <h2
          id="connection-dialog-title"
          className="text-lg font-semibold text-zinc-950 dark:text-white"
        >
          Connect to Database
        </h2>

        <form onSubmit={handleSubmit} className="mt-6">
          <fieldset>
            <div className="space-y-4">
              {/* Database type */}
              <div>
                <label htmlFor="db-type" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Database type
                </label>
                <select
                  id="db-type"
                  value={dbType}
                  onChange={(e) => setDbType(e.target.value as 'postgresql' | 'sqlite')}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="postgresql">PostgreSQL</option>
                  <option value="sqlite">SQLite</option>
                </select>
              </div>

              {dbType === 'postgresql' && (
                <>
                  <div>
                    <label htmlFor="pg-host" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Host
                    </label>
                    <input
                      id="pg-host"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder="localhost"
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="pg-port" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Port
                    </label>
                    <input
                      id="pg-port"
                      type="number"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      placeholder="5432"
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="pg-database" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Database
                    </label>
                    <input
                      id="pg-database"
                      value={database}
                      onChange={(e) => setDatabase(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="pg-username" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Username
                    </label>
                    <input
                      id="pg-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="pg-password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Password
                    </label>
                    <input
                      id="pg-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {dbType === 'sqlite' && (
                <div>
                  <label htmlFor="sqlite-path" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    File path
                  </label>
                  <input
                    id="sqlite-path"
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                    placeholder="/path/to/database.db"
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </fieldset>

          <div className="mt-8 flex justify-end gap-3">
            <Button outline type="button" onClick={handleClose} className="px-5 py-2">
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid} color="dark/zinc" className="px-5 py-2">
              Connect
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
