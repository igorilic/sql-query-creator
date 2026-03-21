'use client'

import React from 'react'
import { ConnectionProvider } from '../contexts/connection-context'
import { ChatProvider } from '../contexts/chat-context'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConnectionProvider>
      <ChatProvider>{children}</ChatProvider>
    </ConnectionProvider>
  )
}
