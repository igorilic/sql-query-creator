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
  const { messages, loading, currentSql, sendMessage } = useChat()
  const [dialogOpen, setDialogOpen] = useState(false)

  async function handleConnect(config: ConnectionConfig) {
    await connect(config)
    setDialogOpen(false)
  }

  return (
    <>
      <SidebarLayout
        navbar={<AppHeader status={status} onConnectClick={() => setDialogOpen(true)} />}
        sidebar={<SchemaBrowser schema={schema} />}
      >
        <ChatPanel messages={messages} loading={loading} onSend={sendMessage} />
        <QueryEditor value={currentSql ?? ''} onChange={() => {}} />
      </SidebarLayout>

      <ConnectionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConnect={handleConnect}
      />
    </>
  )
}
