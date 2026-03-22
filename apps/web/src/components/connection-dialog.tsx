'use client'

import React, { useState } from 'react'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@ui/dialog'
import { Fieldset, FieldGroup, Field, Label } from '@ui/fieldset'
import { Select } from '@ui/select'
import { Input } from '@ui/input'
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

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Connect to Database</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogBody>
          <Fieldset>
            <FieldGroup>
              <Field>
                <Label htmlFor="db-type">Database type</Label>
                <Select
                  id="db-type"
                  value={dbType}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setDbType(e.target.value as 'postgresql' | 'sqlite')
                  }
                >
                  <option value="postgresql">PostgreSQL</option>
                  <option value="sqlite">SQLite</option>
                </Select>
              </Field>

              {dbType === 'postgresql' && (
                <>
                  <Field>
                    <Label htmlFor="pg-host">Host</Label>
                    <Input
                      id="pg-host"
                      value={host}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHost(e.target.value)}
                      placeholder="localhost"
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="pg-port">Port</Label>
                    <Input
                      id="pg-port"
                      type="number"
                      value={port}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPort(e.target.value)}
                      placeholder="5432"
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="pg-database">Database</Label>
                    <Input
                      id="pg-database"
                      value={database}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDatabase(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="pg-username">Username</Label>
                    <Input
                      id="pg-username"
                      value={username}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="pg-password">Password</Label>
                    <Input
                      id="pg-password"
                      type="password"
                      value={password}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    />
                  </Field>
                </>
              )}

              {dbType === 'sqlite' && (
                <Field>
                  <Label htmlFor="sqlite-path">File path</Label>
                  <Input
                    id="sqlite-path"
                    value={filePath}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilePath(e.target.value)}
                    placeholder="/path/to/database.db"
                  />
                </Field>
              )}
            </FieldGroup>
          </Fieldset>
        </DialogBody>
        <DialogActions>
          <Button plain type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!isValid}>
            Connect
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
