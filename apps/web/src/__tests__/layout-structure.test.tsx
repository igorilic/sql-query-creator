/**
 * Layout structure tests — verify the SidebarLayout renders the correct
 * 3-zone layout: full-width navbar, sidebar left, content right.
 *
 * These test the REAL SidebarLayout component (not a mock) to catch
 * CSS/DOM structure issues like overlapping zones.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// Mock headlessui Dialog to avoid browser API issues in jsdom
vi.mock('@headlessui/react', () => ({
  Dialog: () => null,
  DialogBackdrop: () => null,
  DialogPanel: () => null,
  CloseButton: () => null,
}))

vi.mock('@ui/navbar', () => ({
  NavbarItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}))

// Import the REAL SidebarLayout (not mocked)
import { SidebarLayout } from '@ui/sidebar-layout'

function renderLayout() {
  return render(
    <SidebarLayout
      navbar={<div data-testid="navbar-content">Navbar</div>}
      sidebar={<div data-testid="sidebar-content">Sidebar</div>}
    >
      <div data-testid="main-content">Main</div>
    </SidebarLayout>,
  )
}

describe('SidebarLayout structure', () => {
  // ---------------------------------------------------------------------------
  // All three zones render
  // ---------------------------------------------------------------------------
  it('renders navbar, sidebar, and main content', () => {
    renderLayout()
    expect(screen.getByTestId('navbar-content')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-content')).toBeInTheDocument()
    expect(screen.getByTestId('main-content')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Navbar is full-width at top, NOT inside sidebar
  // ---------------------------------------------------------------------------
  it('navbar is inside a <header>, not inside the sidebar <aside>', () => {
    renderLayout()
    const navbar = screen.getByTestId('navbar-content')
    const sidebar = screen.getByTestId('sidebar-content')

    // navbar must be in a <header>
    const header = navbar.closest('header')
    expect(header).not.toBeNull()

    // sidebar must be in an <aside>
    const aside = sidebar.closest('aside')
    expect(aside).not.toBeNull()

    // navbar must NOT be inside the aside
    expect(aside!.contains(navbar)).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // Sidebar and main are siblings in the same flex row
  // ---------------------------------------------------------------------------
  it('sidebar <aside> and <main> share the same parent', () => {
    renderLayout()
    const sidebar = screen.getByTestId('sidebar-content')
    const main = screen.getByTestId('main-content')

    const aside = sidebar.closest('aside')!
    const mainEl = main.closest('main')!

    expect(aside.parentElement).toBe(mainEl.parentElement)
  })

  // ---------------------------------------------------------------------------
  // Root fills viewport
  // ---------------------------------------------------------------------------
  it('root container has h-screen and flex flex-col', () => {
    renderLayout()
    const navbar = screen.getByTestId('navbar-content')
    const root = navbar.closest('header')!.parentElement!
    expect(root.className).toContain('h-screen')
    expect(root.className).toContain('flex')
    expect(root.className).toContain('flex-col')
  })

  // ---------------------------------------------------------------------------
  // Sidebar scrolls independently
  // ---------------------------------------------------------------------------
  it('sidebar <aside> has overflow-y-auto', () => {
    renderLayout()
    const aside = screen.getByTestId('sidebar-content').closest('aside')!
    expect(aside.className).toContain('overflow-y-auto')
  })

  // ---------------------------------------------------------------------------
  // Sidebar has fixed width
  // ---------------------------------------------------------------------------
  it('sidebar <aside> has w-64', () => {
    renderLayout()
    const aside = screen.getByTestId('sidebar-content').closest('aside')!
    expect(aside.className).toContain('w-64')
  })

  // ---------------------------------------------------------------------------
  // Content fills remaining space
  // ---------------------------------------------------------------------------
  it('<main> has flex-1 to fill remaining width', () => {
    renderLayout()
    const mainEl = screen.getByTestId('main-content').closest('main')!
    expect(mainEl.className).toContain('flex-1')
  })

  // ---------------------------------------------------------------------------
  // Flex row allows independent scrolling
  // ---------------------------------------------------------------------------
  it('sidebar/main flex container has min-h-0', () => {
    renderLayout()
    const aside = screen.getByTestId('sidebar-content').closest('aside')!
    const flexRow = aside.parentElement!
    expect(flexRow.className).toContain('min-h-0')
  })

  // ---------------------------------------------------------------------------
  // Navbar header is a direct child of root (first child)
  // ---------------------------------------------------------------------------
  it('navbar header is the first child of the root container', () => {
    renderLayout()
    const navbar = screen.getByTestId('navbar-content')
    const header = navbar.closest('header')!
    const root = header.parentElement!

    expect(root.firstElementChild).toBe(header)
  })

  // ---------------------------------------------------------------------------
  // Sidebar has a right border for visual separation
  // ---------------------------------------------------------------------------
  it('sidebar <aside> has a right border', () => {
    renderLayout()
    const aside = screen.getByTestId('sidebar-content').closest('aside')!
    expect(aside.className).toContain('border-r')
  })
})
