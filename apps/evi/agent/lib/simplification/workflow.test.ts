import { describe, expect, it } from 'vitest'
import { reviewMessage, simplificationInputSchema, verificationMessage } from './workflow'

describe('simplification workflow', () => {
  it('requires separate scopes and a source revision', () => {
    expect(simplificationInputSchema.safeParse({
      revision: 'abcdef0',
      codeScope: 'packages/evlog/src/runtime',
      testScope: 'packages/evlog/test/core and packages/evlog/src/runtime',
      architectureScope: 'packages/evlog/src/adapters and packages/evlog/src/shared',
      communicationScope: 'agent/instructions.md and PR #1',
      priorDecisions: [],
    }).success).toBe(true)

    expect(simplificationInputSchema.safeParse({
      revision: 'abcdef0',
      codeScope: '',
      testScope: '',
      architectureScope: '',
      communicationScope: '',
      priorDecisions: [],
    }).success).toBe(false)
  })

  it('keeps each reviewer inside its assigned scope', () => {
    const message = reviewMessage(
      'abcdef0',
      { agent: 'code_simplifier', category: 'code', scope: 'packages/evlog/src/runtime' },
      ['Keep the request lifecycle wrapper.'],
    )

    expect(message).toContain('packages/evlog/src/runtime')
    expect(message).toContain('revision abcdef0')
    expect(message).toContain('must not be raised again')
    expect(message).toContain('Taste is not a finding')
  })

  it('sets a higher evidence bar for removing tests', () => {
    const message = reviewMessage(
      'abcdef0',
      { agent: 'test_reviewer', category: 'tests', scope: 'packages/evlog/test/core' },
      [],
    )

    expect(message).toContain('existing test that covers the same behavior')
    expect(message).toContain('distinct failure mode')
    expect(message).toContain('runtime boundary')
  })

  it('gives the verifier candidates and prior decisions', () => {
    const message = verificationMessage(
      'abcdef0',
      [{ scope: 'runtime', findings: [], cleanAreas: ['logger'] }],
      ['Do not combine framework entrypoints.'],
    )

    expect(message).toContain('Try to disprove every candidate')
    expect(message).toContain('Do not combine framework entrypoints.')
    expect(message).toContain('pull_request only for a mechanical')
    expect(message).toContain('Reject a test removal unless another cited test covers the same behavior')
  })
})
