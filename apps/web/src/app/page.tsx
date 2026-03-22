'use client'

import React, { useState } from 'react'
import { SidebarLayout } from '@ui/sidebar-layout'
import { AppHeader } from '../components/app-header'
import { SchemaBrowser } from '../components/schema-browser'
import { ChatPanel } from '../components/chat-panel'
import { QueryEditor } from '../components/query-editor'
import { ConnectionDialog } from '../components/connection-dialog'
import { useConnection } from '../contexts/connection-context'
import { useChat } from '../contexts/chat-context'
import type { ConnectionConfig } from '@repo/shared/types'

export default function HomePage() {
  const { status, schema, connect } = useConnection()
  const { messages, loading, currentSql, schemaContext, sendMessage } = useChat()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editorSql, setEditorSql] = useState<string>('')

  // Keep editor in sync with AI-generated SQL, but allow user edits
  const displaySql = editorSql || (currentSql ?? '')

  async function handleConnect(config: ConnectionConfig) {
    const success = await connect(config)
    if (success) {
      setDialogOpen(false)
    }
  }

  return (
    <>
      <SidebarLayout
        navbar={<AppHeader status={status} onConnectClick={() => setDialogOpen(true)} />}
        sidebar={<SchemaBrowser schema={schema} />}
      >
        <ChatPanel messages={messages} loading={loading} schemaContext={schemaContext} onSend={sendMessage} />
        <QueryEditor value={displaySql} onChange={setEditorSql} />
      </SidebarLayout>

      <ConnectionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConnect={handleConnect}
      />
    </>
  )
}
