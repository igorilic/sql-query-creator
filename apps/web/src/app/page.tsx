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
  console.log('[HomePage] render, dialogOpen:', dialogOpen)
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
        navbar={<AppHeader status={status} onConnectClick={() => {
          console.log('[HomePage] onConnectClick fired, setting dialogOpen to true')
          setDialogOpen(true)
        }} />}
        sidebar={<SchemaBrowser schema={schema} />}
      >
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0">
            <ChatPanel messages={messages} loading={loading} schemaContext={schemaContext} onSend={sendMessage} />
          </div>
          <div className="h-64 shrink-0 border-t border-zinc-200 dark:border-zinc-700">
            <QueryEditor value={displaySql} onChange={setEditorSql} />
          </div>
        </div>
      </SidebarLayout>

      <ConnectionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConnect={handleConnect}
      />
    </>
  )
}
