import type { WorkflowToolContext } from 'eve/tools'
import { z } from 'zod'

export const simplificationInputSchema = z.object({
  revision: z.string().regex(/^[a-f0-9]{40}$/).describe('Full commit SHA reviewed by every specialist'),
  codeScope: z.string().min(1).describe('Exact files or directories assigned to the code simplifier'),
  testScope: z.string().min(1).describe('Exact test files and corresponding source assigned to the test reviewer'),
  architectureScope: z.string().min(1).describe('Exact boundaries and relationships assigned to the architecture reviewer'),
  communicationScope: z.string().min(1).describe('Exact authored files and complete recent Evi artifacts assigned to the communication reviewer'),
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
    status: { type: 'string', enum: ['complete', 'recovered', 'incomplete'] },
    limitations: { type: 'array', items: { type: 'string' } },
    findings: { type: 'array', items: findingSchema },
    cleanAreas: { type: 'array', items: { type: 'string' } },
  },
  required: ['scope', 'status', 'limitations', 'findings', 'cleanAreas'],
  additionalProperties: false,
} as const

const findingResultSchema = z.object({
  id: z.string(),
  category: z.enum(['code', 'tests', 'architecture', 'communication']),
  path: z.string(),
  lines: z.string(),
  problem: z.string(),
  evidence: z.string(),
  simplification: z.string(),
  preservedBehavior: z.string(),
  risk: z.string(),
  confidence: z.number(),
})

const reviewResultSchema = z.object({
  scope: z.string(),
  status: z.enum(['complete', 'recovered', 'incomplete']),
  limitations: z.array(z.string()),
  findings: z.array(findingResultSchema),
  cleanAreas: z.array(z.string()),
})

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

const revisionResultSchema = z.object({
  revision: z.string().regex(/^[a-f0-9]{40}$/),
})

const revisionOutputSchema = {
  type: 'object',
  properties: {
    revision: { type: 'string', pattern: '^[a-f0-9]{40}$' },
  },
  required: ['revision'],
  additionalProperties: false,
} as const

const verificationResultSchema = z.object({
  findings: z.array(findingResultSchema.extend({
    verdict: z.enum(['confirmed', 'rejected', 'question']),
    delivery: z.enum(['pull_request', 'proposal', 'question']),
    verification: z.string(),
  })),
  summary: z.string(),
})

interface ReviewAssignment {
  agent: 'code_simplifier' | 'test_reviewer' | 'architecture_reviewer' | 'communication_reviewer'
  category: 'code' | 'tests' | 'architecture' | 'communication'
  scope: string
}

type ReviewResult = z.infer<typeof reviewResultSchema> & Pick<ReviewAssignment, 'agent' | 'category'>
type VerificationResult = z.infer<typeof verificationResultSchema>

export function reviewMessage(
  revision: string,
  assignment: ReviewAssignment,
  priorDecisions: readonly string[],
): string {
  return [
    `Review only the assigned ${assignment.category} scope at revision ${revision}.`,
    'The checkout is shared with the parent at /workspace/repo. Resolve every repository-relative path under that directory. Use glob to locate files before reading or grepping an exact path. Do not invent a path, write files, or change Git state.',
    `Assigned scope:\n${assignment.scope}`,
    assignment.category === 'tests'
      ? 'A proposed removal must name the existing test that covers the same behavior and prove the candidate has no distinct failure mode, runtime boundary, regression history, or public contract.'
      : '',
    assignment.category === 'communication'
      ? 'Review external artifacts only from complete excerpts supplied in the scope. A URL identifies an artifact but is not evidence by itself. Do not infer missing or truncated text.'
      : '',
    `Prior decisions that must not be raised again:\n${priorDecisions.length === 0 ? '_None._' : priorDecisions.join('\n')}`,
    'Return status complete when every assigned artifact was reviewed, recovered when a failed lookup was replaced with equivalent complete evidence, or incomplete when any evidence remains missing or truncated. Record every failed or incomplete lookup in limitations. Do not create a finding from incomplete evidence.',
    'Return only findings that reduce code, tests, or prose while preserving intended behavior. Every finding needs an exact path, line range, evidence, the smaller shape, preserved behavior, risk, and confidence from 0 to 1. Taste is not a finding.',
  ].filter(Boolean).join('\n\n')
}

export function revisionMessage(revision: string): string {
  return [
    `Verify that the shared checkout is exactly commit ${revision} before any review starts.`,
    'Call revision_check with this commit. Do not inspect candidates or return from memory. Return only the tool-confirmed revision.',
  ].join('\n\n')
}

export function verificationMessage(
  revision: string,
  reviews: readonly unknown[],
  priorDecisions: readonly string[],
): string {
  return [
    `Try to disprove every candidate finding against revision ${revision}.`,
    'The checkout is shared with the parent at /workspace/repo. Resolve every repository-relative path under that directory and use glob before reading or grepping an exact path. Do not write files or change Git state.',
    'Read the cited files and search for callers, tests, constraints, and counterexamples. Reject taste, behavior changes disguised as cleanup, duplicates, and anything covered by a prior maintainer decision. Reject a test removal unless another cited test covers the same behavior and the candidate adds no distinct failure mode, runtime boundary, regression history, or public contract.',
    'Never confirm a finding based on an incomplete review or incomplete source artifact. Mark it as a question when the missing evidence could change the verdict.',
    `Prior decisions:\n${priorDecisions.length === 0 ? '_None._' : priorDecisions.join('\n')}`,
    `Candidate reviews:\n${JSON.stringify(reviews)}`,
    'Use pull_request only for a mechanical, behavior-preserving change with enough evidence to implement and test without judgement. Use proposal for architectural decisions. Use question when evidence is incomplete.',
  ].join('\n\n')
}

export function summarizeSimplificationSweep(
  reviews: readonly ReviewResult[],
  verification: VerificationResult,
) {
  const proposed = reviews.reduce((count, review) => count + review.findings.length, 0)
  const confirmed = verification.findings.filter(finding => finding.verdict === 'confirmed')
  const rejected = verification.findings.filter(finding => finding.verdict === 'rejected')
  const questions = verification.findings.filter(finding => finding.verdict === 'question')
  const incomplete = reviews.some(review => review.status === 'incomplete')
  const recovered = reviews.some(review => review.status === 'recovered')

  return {
    status: incomplete ? 'degraded' : recovered ? 'recovered' : 'complete',
    reviewers: reviews.map(review => ({
      agent: review.agent,
      category: review.category,
      status: review.status,
      limitations: review.limitations,
    })),
    counts: {
      reviewers: reviews.length,
      proposed,
      confirmed: confirmed.length,
      rejected: rejected.length,
      questions: questions.length,
      pullRequestCandidates: confirmed.filter(finding => finding.delivery === 'pull_request').length,
      proposals: confirmed.filter(finding => finding.delivery === 'proposal').length,
    },
  } as const
}

export async function runSimplificationSweep(
  input: SimplificationSweepInput,
  ctx: Pick<WorkflowToolContext, 'agent'>,
) {
  'use workflow'

  const checkout = revisionResultSchema.parse(await ctx.agent('finding_verifier', {
    message: revisionMessage(input.revision),
    outputSchema: revisionOutputSchema,
  }))
  if (checkout.revision !== input.revision) {
    throw new Error(`Shared checkout revision ${checkout.revision} does not match requested revision ${input.revision}.`)
  }

  const assignments: ReviewAssignment[] = [
    { agent: 'code_simplifier', category: 'code', scope: input.codeScope },
    { agent: 'test_reviewer', category: 'tests', scope: input.testScope },
    { agent: 'architecture_reviewer', category: 'architecture', scope: input.architectureScope },
    { agent: 'communication_reviewer', category: 'communication', scope: input.communicationScope },
  ]

  const reviews = await Promise.all(
    assignments.map(async (assignment): Promise<ReviewResult> => {
      try {
        const review = reviewResultSchema.parse(await ctx.agent(assignment.agent, {
          message: reviewMessage(checkout.revision, assignment, input.priorDecisions),
          outputSchema: reviewOutputSchema,
        }))

        return { agent: assignment.agent, category: assignment.category, ...review }
      }
      catch (error) {
        return {
          agent: assignment.agent,
          category: assignment.category,
          scope: assignment.scope,
          status: 'incomplete',
          limitations: [`Reviewer failed before returning a valid structured result: ${error instanceof Error ? error.message : String(error)}`],
          findings: [],
          cleanAreas: [],
        }
      }
    }),
  )

  const verification = verificationResultSchema.parse(await ctx.agent('finding_verifier', {
    message: verificationMessage(checkout.revision, reviews, input.priorDecisions),
    outputSchema: verificationOutputSchema,
  }))

  return {
    revision: checkout.revision,
    reviews,
    verification,
    ...summarizeSimplificationSweep(reviews, verification),
  }
}
