/**
 * Integration test — dark mode coverage verification.
 *
 * Renders the full HomePage and checks that:
 * 1. Key dark mode classes are present in the rendered tree.
 * 2. Known light-only color classes have `dark:` counterparts nearby.
 *
 * This catches regressions where someone adds a light-only Tailwind color
 * class without a corresponding `dark:` variant.
 */

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Mocks — same pattern as chat-flow integration test
// ---------------------------------------------------------------------------

vi.mock('@uiw/react-codemirror', () => ({
  default: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string
    onChange?: (val: string) => void
    placeholder?: string
  }) => (
    <textarea
      data-testid="codemirror-editor"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}))

vi.mock('@codemirror/lang-sql', () => ({
  sql: vi.fn(() => ({})),
}))

vi.mock('@ui/sidebar-layout', () => ({
  SidebarLayout: ({
    navbar,
    sidebar,
    children,
  }: {
    navbar: React.ReactNode
    sidebar: React.ReactNode
    children: React.ReactNode
  }) => (
    <div data-testid="sidebar-layout">
      <div data-testid="layout-navbar">{navbar}</div>
      <div data-testid="layout-sidebar">{sidebar}</div>
      <div data-testid="layout-main">{children}</div>
    </div>
  ),
}))

vi.mock('@ui/navbar', () => ({
  Navbar: ({ children }: { children: React.ReactNode }) => <nav>{children}</nav>,
  NavbarSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  NavbarItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  NavbarLabel: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  NavbarSpacer: () => <div aria-hidden="true" />,
}))

vi.mock('@ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="status-badge">{children}</span>
  ),
}))

vi.mock('@ui/button', () => ({
  Button: ({
    children,
    onClick,
    type,
    disabled,
    'aria-label': ariaLabel,
  }: {
    children: React.ReactNode
    onClick?: () => void
    type?: string
    disabled?: boolean
    outline?: boolean
    'aria-label'?: string
  }) => (
    <button
      type={(type as 'button' | 'submit') ?? 'button'}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  ),
}))

vi.mock('@ui/sidebar', () => ({
  SidebarSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarHeading: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  SidebarItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: () => void
    'aria-expanded'?: boolean
    'aria-controls'?: string
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  SidebarLabel: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@ui/dialog', () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode
    open: boolean
    onClose: () => void
  }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogActions: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@ui/fieldset', () => ({
  Fieldset: ({ children }: { children: React.ReactNode }) => <fieldset>{children}</fieldset>,
  FieldGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Field: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}))

vi.mock('@ui/select', () => ({
  Select: ({
    children,
    value,
    onChange,
    name,
  }: {
    children: React.ReactNode
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
    name?: string
  }) => (
    <select name={name} value={value} onChange={onChange}>
      {children}
    </select>
  ),
}))

vi.mock('@ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}))

vi.mock('@headlessui/react', () => {
  const Disclosure = ({ children }: { children: (bag: { open: boolean }) => React.ReactNode }) => (
    <div>{children({ open: false })}</div>
  )
  const DisclosureButton = ({
    as: As = 'button',
    children,
    ...rest
  }: {
    as?: React.ElementType
    children: React.ReactNode
    [key: string]: unknown
  }) => <As {...rest}>{children}</As>
  const DisclosurePanel = ({ children }: { children: React.ReactNode; id?: string; className?: string }) => null

  return { Disclosure, DisclosureButton, DisclosurePanel }
})

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { Providers } from '../../app/providers'
import HomePage from '../../app/page'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderApp() {
  return render(
    <Providers>
      <HomePage />
    </Providers>,
  )
}

/**
 * Light-only Tailwind color classes that MUST have a `dark:` counterpart
 * somewhere in the same element's className. Each entry is a regex that
 * matches a light-only class we've fixed in this PR.
 */
const LIGHT_CLASSES_REQUIRING_DARK: Array<{ light: RegExp; dark: string; label: string }> = [
  { light: /\btext-zinc-500\b/, dark: 'dark:text-zinc-400', label: 'text-zinc-500 → dark:text-zinc-400' },
  { light: /\btext-zinc-600\b/, dark: 'dark:text-zinc-400', label: 'text-zinc-600 → dark:text-zinc-400' },
  { light: /\bbg-amber-100\b/, dark: 'dark:bg-amber-900/50', label: 'bg-amber-100 → dark:bg-amber-900/50' },
  { light: /\btext-amber-700\b/, dark: 'dark:text-amber-400', label: 'text-amber-700 → dark:text-amber-400' },
  { light: /\btext-red-600\b/, dark: 'dark:text-red-400', label: 'text-red-600 → dark:text-red-400' },
  { light: /\bborder-zinc-200\b/, dark: 'dark:border-zinc-700', label: 'border-zinc-200 → dark:border-zinc-700' },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: dark mode coverage', () => {
  it('key dark mode classes are present in the rendered tree', () => {
    const { container } = renderApp()
    const html = container.innerHTML

    // These classes must appear somewhere in the rendered output
    const expectedClasses = [
      'dark:text-zinc-400',
      'dark:border-zinc-700',
      'dark:text-zinc-300',
    ]

    for (const cls of expectedClasses) {
      expect(html).toContain(cls)
    }
  })

  it('no light-only color classes exist without dark: counterparts', () => {
    const { container } = renderApp()

    // Collect all elements with a className attribute
    const allElements = container.querySelectorAll('[class]')
    const violations: string[] = []

    allElements.forEach((el) => {
      const className = el.className
      if (typeof className !== 'string') return

      for (const rule of LIGHT_CLASSES_REQUIRING_DARK) {
        if (rule.light.test(className) && !className.includes(rule.dark)) {
          violations.push(
            `Element <${el.tagName.toLowerCase()}> has "${className.match(rule.light)?.[0]}" without "${rule.dark}" — ${rule.label}`,
          )
        }
      }
    })

    expect(violations).toEqual([])
  })
})
