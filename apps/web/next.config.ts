import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@repo/ui'],
  serverExternalPackages: ['pg', 'better-sqlite3', 'motion'],
}

export default nextConfig
