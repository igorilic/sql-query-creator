'use client'

import React, { useState } from 'react'
import { SidebarSection, SidebarHeading, SidebarItem, SidebarLabel } from '@ui/sidebar'
import type { DatabaseSchema } from '@repo/shared/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SchemaBrowserProps {
  schema: DatabaseSchema | null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SchemaBrowser({ schema }: SchemaBrowserProps) {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())

  if (schema === null) {
    return (
      <div className="px-4 py-6 text-sm text-zinc-500">
        Connect a database to browse schema
      </div>
    )
  }

  if (schema.tables.length === 0) {
    return (
      <div className="px-4 py-6 text-sm text-zinc-500">
        No tables found
      </div>
    )
  }

  function toggleTable(tableName: string) {
    setExpandedTables((prev) => {
      const next = new Set(prev)
      if (next.has(tableName)) {
        next.delete(tableName)
      } else {
        next.add(tableName)
      }
      return next
    })
  }

  return (
    <SidebarSection>
      <SidebarHeading>Schema</SidebarHeading>

      {schema.tables.map((table) => {
        const isExpanded = expandedTables.has(table.name)

        return (
          <div key={table.name}>
            <SidebarItem onClick={() => toggleTable(table.name)}>
              <SidebarLabel>{table.name}</SidebarLabel>
            </SidebarItem>

            {isExpanded && (
              <div className="ml-4 mt-1 mb-2 space-y-1">
                {table.columns.map((col) => (
                  <div
                    key={col.name}
                    className="flex items-center gap-2 text-xs text-zinc-600 py-0.5"
                  >
                    <span className="font-medium">{col.name}</span>
                    <span className="text-zinc-400">{col.dataType}</span>
                    {col.foreignKey && (
                      <span
                        className="rounded bg-amber-100 px-1 py-0.5 text-xs font-semibold text-amber-700"
                        title={`FK → ${col.foreignKey.table}.${col.foreignKey.column}`}
                      >
                        FK
                      </span>
                    )}
                    {col.foreignKey && (
                      <span className="text-zinc-400">
                        → {col.foreignKey.table}.{col.foreignKey.column}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </SidebarSection>
  )
}
