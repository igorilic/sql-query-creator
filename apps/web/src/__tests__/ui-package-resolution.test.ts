/**
 * Step 1 — RED: Verify packages/ui is resolvable from apps/web via @ui/* paths.
 * These tests FAIL before the monorepo scaffold exists (no pnpm install, no tsconfig paths).
 */
import { describe, it, expect } from 'vitest'

describe('UI package resolution (@ui/* path aliases)', () => {
  it('resolves @ui/button and exports a Button component', async () => {
    const mod = await import('@ui/button')
    expect(mod.Button).toBeDefined()
    // forwardRef components have typeof === 'object'; function components have typeof === 'function'
    expect(['function', 'object']).toContain(typeof mod.Button)
  })

  it('resolves @ui/input and exports an Input component', async () => {
    const mod = await import('@ui/input')
    expect(mod.Input).toBeDefined()
  })

  it('resolves @ui/select and exports a Select component', async () => {
    const mod = await import('@ui/select')
    expect(mod.Select).toBeDefined()
  })

  it('resolves @ui/badge and exports a Badge component', async () => {
    const mod = await import('@ui/badge')
    expect(mod.Badge).toBeDefined()
  })

  it('resolves @ui/dialog and exports a Dialog component', async () => {
    const mod = await import('@ui/dialog')
    expect(mod.Dialog).toBeDefined()
  })
})
