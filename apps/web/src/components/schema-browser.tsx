'use client'

import React, { useCallback } from 'react'
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react'
import { SidebarSection, SidebarHeading, SidebarItem, SidebarLabel } from '@ui/sidebar'
import { Badge } from '@ui/badge'
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
      <SidebarHeading className="flex items-center justify-between">
        <span>Schema</span>
        <Badge color="zinc">{schema.tables.length}</Badge>
      </SidebarHeading>

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
                  <SidebarLabel className="flex items-center gap-2">
                    <svg
                      className={`h-3 w-3 shrink-0 text-zinc-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
                      viewBox="0 0 12 12"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M4.5 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{table.name}</span>
                    <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
                      {table.columns.length}
                    </span>
                  </SidebarLabel>
                </DisclosureButton>

                <DisclosurePanel
                  id={panelId}
                  className="ml-5 mr-2 mt-1 mb-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 divide-y divide-zinc-200 dark:divide-zinc-700"
                >
                  {table.columns.map((col) => (
                    <div
                      key={col.name}
                      className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 px-3 py-2"
                    >
                      <span className="font-medium shrink-0">{col.name}</span>
                      <span className="text-zinc-400 dark:text-zinc-500 truncate">{col.dataType}</span>
                      {col.isPrimaryKey && (
                        <span className="rounded bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-400 shrink-0">
                          PK
                        </span>
                      )}
                      {col.foreignKey && (
                        <>
                          <span
                            className="rounded bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400 shrink-0"
                            title={`FK → ${col.foreignKey.table}.${col.foreignKey.column}`}
                          >
                            FK
                          </span>
                          <span className="text-zinc-400 dark:text-zinc-500 truncate">
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
