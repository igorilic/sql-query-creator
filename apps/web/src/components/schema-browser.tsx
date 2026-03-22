'use client'

import React, { useCallback } from 'react'
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react'
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
  // Stable no-op — Disclosure manages its own open state internally.
  const stopPropagation = useCallback((e: React.MouseEvent) => e.stopPropagation(), [])

  if (schema === null) {
    return (
      <div className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400">
        Connect a database to browse schema
      </div>
    )
  }

  if (schema.tables.length === 0) {
    return (
      <div className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400">
        No tables found
      </div>
    )
  }

  return (
    <SidebarSection>
      <SidebarHeading>Schema</SidebarHeading>

      {schema.tables.map((table) => {
        const panelId = `schema-table-${table.name}`

        return (
          <Disclosure key={table.name}>
            {({ open }) => (
              <div>
                <DisclosureButton
                  as={SidebarItem}
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={stopPropagation}
                >
                  <SidebarLabel>{table.name}</SidebarLabel>
                </DisclosureButton>

                <DisclosurePanel
                  id={panelId}
                  className="ml-4 mt-1 mb-2 space-y-1"
                >
                  {table.columns.map((col) => (
                    <div
                      key={col.name}
                      className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 py-0.5"
                    >
                      <span className="font-medium">{col.name}</span>
                      <span className="text-zinc-400 dark:text-zinc-500">{col.dataType}</span>
                      {col.foreignKey && (
                        <>
                          <span
                            className="rounded bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400"
                            title={`FK → ${col.foreignKey.table}.${col.foreignKey.column}`}
                          >
                            FK
                          </span>
                          <span className="text-zinc-400 dark:text-zinc-500">
                            → {col.foreignKey.table}.{col.foreignKey.column}
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                </DisclosurePanel>
              </div>
            )}
          </Disclosure>
        )
      })}
    </SidebarSection>
  )
}
