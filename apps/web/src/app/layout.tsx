import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SQL Query Creator',
  description: 'AI-powered SQL query builder',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
