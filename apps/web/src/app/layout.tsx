import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'SQL Query Creator',
  description: 'AI-powered SQL query builder',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="text-zinc-950 antialiased lg:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:lg:bg-zinc-950">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
