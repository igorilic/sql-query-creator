'use client'

import React from 'react'
import { Navbar, NavbarSection, NavbarItem, NavbarLabel, NavbarSpacer } from '@ui/navbar'
import { Badge } from '@ui/badge'
import { Button } from '@ui/button'
import type { ConnectionStatus } from '@repo/shared/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AppHeaderProps {
  status: ConnectionStatus
  onConnectClick: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusLabel(status: ConnectionStatus): string {
  if (!status.connected) return 'Not connected'
  const db = status.type === 'postgresql' ? 'PostgreSQL' : 'SQLite'
  return `Connected — ${db}`
}

function statusColor(status: ConnectionStatus): 'green' | 'zinc' {
  return status.connected ? 'green' : 'zinc'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppHeader({ status, onConnectClick }: AppHeaderProps) {
  return (
    <Navbar>
      <NavbarSection>
        <NavbarItem>
          <NavbarLabel>SQL Query Creator</NavbarLabel>
        </NavbarItem>
      </NavbarSection>

      <NavbarSpacer />

      <NavbarSection>
        <NavbarItem>
          <Badge color={statusColor(status)}>{statusLabel(status)}</Badge>
        </NavbarItem>
        <NavbarItem>
          <Button onClick={onConnectClick}>Connect</Button>
        </NavbarItem>
      </NavbarSection>
    </Navbar>
  )
}
