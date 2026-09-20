import { describe, expect, it } from 'vitest'
import { workspaceBootstrapCommand } from './workspace-bootstrap'

describe('workspace bootstrap', () => {
  it('activates the pinned package manager without writing global shims', () => {
    expect(workspaceBootstrapCommand).toContain('corepack prepare --activate')
    expect(workspaceBootstrapCommand).toContain('pnpm install --frozen-lockfile')
    expect(workspaceBootstrapCommand).toContain('pnpm run dev:prepare')
    expect(workspaceBootstrapCommand).not.toContain('corepack enable')
  })
})
