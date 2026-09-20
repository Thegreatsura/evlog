import type { WorkflowToolContext } from 'eve/tools'
import { z } from 'zod'

export const simplificationInputSchema = z.object({
  revision: z.string().min(7).describe('Commit SHA reviewed by every specialist'),
  codeScope: z.string().min(1).describe('Exact files or directories assigned to the code simplifier'),
  testScope: z.string().min(1).describe('Exact test files and corresponding source assigned to the test reviewer'),
  architectureScope: z.string().min(1).describe('Exact boundaries and relationships assigned to the architecture reviewer'),
  communicationScope: z.string().min(1).describe('Exact authored files and recent Evi artifacts assigned to the communication reviewer'),
  priorDecisions: z.array(z.string()).describe('Previously rejected findings and maintainer decisions that must not be raised again'),
})

export type SimplificationSweepInput = z.infer<typeof simplificationInputSchema>

const findingProperties = {
  id: { type: 'string' },
  category: { type: 'string', enum: ['code', 'tests', 'architecture', 'communication'] },
  path: { type: 'string' },
  lines: { type: 'string' },
  problem: { type: 'string' },
  evidence: { type: 'string' },
  simplification: { type: 'string' },
  preservedBehavior: { type: 'string' },
  risk: { type: 'string' },
  confidence: { type: 'number' },
} as const

const findingSchema = {
  type: 'object',
  properties: findingProperties,
  required: Object.keys(findingProperties),
  additionalProperties: false,
} as const

const reviewOutputSchema = {
  type: 'object',
  properties: {
    scope: { type: 'string' },
    findings: { type: 'array', items: findingSchema },
    cleanAreas: { type: 'array', items: { type: 'string' } },
  },
  required: ['scope', 'findings', 'cleanAreas'],
  additionalProperties: false,
} as const

const verifiedFindingSchema = {
  type: 'object',
  properties: {
    ...findingProperties,
    verdict: { type: 'string', enum: ['confirmed', 'rejected', 'question'] },
    delivery: { type: 'string', enum: ['pull_request', 'proposal', 'question'] },
    verification: { type: 'string' },
  },
  required: [...Object.keys(findingProperties), 'verdict', 'delivery', 'verification'],
  additionalProperties: false,
} as const

const verificationOutputSchema = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: verifiedFindingSchema },
    summary: { type: 'string' },
  },
  required: ['findings', 'summary'],
  additionalProperties: false,
} as const

interface ReviewAssignment {
  agent: 'code_simplifier' | 'test_reviewer' | 'architecture_reviewer' | 'communication_reviewer'
  category: 'code' | 'tests' | 'architecture' | 'communication'
  scope: string
}

export function reviewMessage(
  revision: string,
  assignment: ReviewAssignment,
  priorDecisions: readonly string[],
): string {
  return [
    `Review only the assigned ${assignment.category} scope at revision ${revision}.`,
    'The checkout is shared with the parent. Read source directly and do not write files or change Git state.',
    `Assigned scope:\n${assignment.scope}`,
    assignment.category === 'tests'
      ? 'A proposed removal must name the existing test that covers the same behavior and prove the candidate has no distinct failure mode, runtime boundary, regression history, or public contract.'
      : '',
    `Prior decisions that must not be raised again:\n${priorDecisions.length === 0 ? '_None._' : priorDecisions.join('\n')}`,
    'Return only findings that reduce code, tests, or prose while preserving intended behavior. Every finding needs an exact path, line range, evidence, the smaller shape, preserved behavior, risk, and confidence from 0 to 1. Taste is not a finding.',
  ].filter(Boolean).join('\n\n')
}

export function verificationMessage(
  revision: string,
  reviews: readonly unknown[],
  priorDecisions: readonly string[],
): string {
  return [
    `Try to disprove every candidate finding against revision ${revision}.`,
    'Read the cited files and search for callers, tests, constraints, and counterexamples. Reject taste, behavior changes disguised as cleanup, duplicates, and anything covered by a prior maintainer decision. Reject a test removal unless another cited test covers the same behavior and the candidate adds no distinct failure mode, runtime boundary, regression history, or public contract.',
    `Prior decisions:\n${priorDecisions.length === 0 ? '_None._' : priorDecisions.join('\n')}`,
    `Candidate reviews:\n${JSON.stringify(reviews)}`,
    'Use pull_request only for a mechanical, behavior-preserving change with enough evidence to implement and test without judgement. Use proposal for architectural decisions. Use question when evidence is incomplete.',
  ].join('\n\n')
}

export async function runSimplificationSweep(
  input: SimplificationSweepInput,
  ctx: WorkflowToolContext,
) {
  'use workflow'

  const assignments: ReviewAssignment[] = [
    { agent: 'code_simplifier', category: 'code', scope: input.codeScope },
    { agent: 'test_reviewer', category: 'tests', scope: input.testScope },
    { agent: 'architecture_reviewer', category: 'architecture', scope: input.architectureScope },
    { agent: 'communication_reviewer', category: 'communication', scope: input.communicationScope },
  ]

  const reviews = await Promise.all(
    assignments.map(assignment =>
      ctx.agent(assignment.agent, {
        message: reviewMessage(input.revision, assignment, input.priorDecisions),
        outputSchema: reviewOutputSchema,
      }),
    ),
  )

  const verification = await ctx.agent('finding_verifier', {
    message: verificationMessage(input.revision, reviews, input.priorDecisions),
    outputSchema: verificationOutputSchema,
  })

  return { revision: input.revision, reviews, verification }
}
