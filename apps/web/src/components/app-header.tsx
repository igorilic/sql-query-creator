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
  if (status.error) return 'Connection error'
  if (!status.connected) return 'Not connected'
  if (status.type === 'postgresql') return 'Connected — PostgreSQL'
  if (status.type === 'sqlite') return 'Connected — SQLite'
  return 'Connected'
}

function statusColor(status: ConnectionStatus): 'green' | 'red' | 'zinc' {
  if (status.error) return 'red'
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
        <div className="flex items-center">
          <Badge color={statusColor(status)}>{statusLabel(status)}</Badge>
        </div>
        <div className="flex items-center">
          <Button onClick={onConnectClick} color="dark/zinc" className="px-5 py-2">Connect</Button>
        </div>
      </NavbarSection>
    </Navbar>
  )
}
