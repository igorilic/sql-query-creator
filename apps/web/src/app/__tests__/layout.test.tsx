import { describe, it, expect, vi } from 'vitest'
import React from 'react'

// Mock the providers to avoid context setup
vi.mock('../providers', () => ({
  Providers: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import RootLayout from '../layout'

describe('RootLayout', () => {
  it('renders <html> with dark mode foundation classes', () => {
    // RootLayout returns JSX — we can inspect the element tree directly
    const element = RootLayout({ children: <div>child</div> }) as React.ReactElement

    expect(element.type).toBe('html')
    const className: string = element.props.className
    expect(className).toContain('text-zinc-950')
    expect(className).toContain('antialiased')
    expect(className).toContain('lg:bg-zinc-100')
    expect(className).toContain('dark:bg-zinc-900')
    expect(className).toContain('dark:text-white')
    expect(className).toContain('dark:lg:bg-zinc-950')
  })

  it('renders <body> inside <html>', () => {
    const element = RootLayout({ children: <div>child</div> }) as React.ReactElement

    expect(element.type).toBe('html')
    // body is a direct child of html
    const body = element.props.children
    expect(body.type).toBe('body')
  })
})
