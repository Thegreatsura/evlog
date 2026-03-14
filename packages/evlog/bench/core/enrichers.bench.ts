import { bench, describe } from 'vitest'
import type { EnrichContext } from '../../src/types'
import {
  createGeoEnricher,
  createRequestSizeEnricher,
  createTraceContextEnricher,
  createUserAgentEnricher,
} from '../../src/enrichers'
import { makeEnrichCtx, USER_AGENTS } from './_fixtures'

describe('createUserAgentEnricher', () => {
  const enrich = createUserAgentEnricher()

  bench('Chrome desktop', () => {
    enrich(makeEnrichCtx({ 'user-agent': USER_AGENTS.chrome }))
  })

  bench('Firefox Linux', () => {
    enrich(makeEnrichCtx({ 'user-agent': USER_AGENTS.firefox }))
  })

  bench('Googlebot', () => {
    enrich(makeEnrichCtx({ 'user-agent': USER_AGENTS.bot }))
  })

  bench('no user-agent header', () => {
    enrich(makeEnrichCtx({}))
  })
})

describe('createGeoEnricher', () => {
  const enrich = createGeoEnricher()

  bench('Vercel headers (full)', () => {
    enrich(makeEnrichCtx({
      'x-vercel-ip-country': 'US',
      'x-vercel-ip-country-region': 'California',
      'x-vercel-ip-country-region-code': 'CA',
      'x-vercel-ip-city': 'San Francisco',
      'x-vercel-ip-latitude': '37.7749',
      'x-vercel-ip-longitude': '-122.4194',
    }))
  })

  bench('Cloudflare headers (country only)', () => {
    enrich(makeEnrichCtx({ 'cf-ipcountry': 'DE' }))
  })

  bench('no geo headers', () => {
    enrich(makeEnrichCtx({}))
  })
})

describe('createRequestSizeEnricher', () => {
  const enrich = createRequestSizeEnricher()

  bench('with content-length', () => {
    const ctx = makeEnrichCtx({ 'content-length': '1024' })
    ctx.response = { headers: { 'content-length': '2048' } }
    enrich(ctx)
  })

  bench('no content-length', () => {
    enrich(makeEnrichCtx({}))
  })
})

describe('createTraceContextEnricher', () => {
  const enrich = createTraceContextEnricher()

  bench('with traceparent', () => {
    enrich(makeEnrichCtx({
      traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
    }))
  })

  bench('with traceparent + tracestate', () => {
    enrich(makeEnrichCtx({
      traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      tracestate: 'congo=t61rcWkgMzE',
    }))
  })

  bench('no trace headers', () => {
    enrich(makeEnrichCtx({}))
  })
})

describe('full enricher pipeline', () => {
  const enrichers = [
    createUserAgentEnricher(),
    createGeoEnricher(),
    createRequestSizeEnricher(),
    createTraceContextEnricher(),
  ]

  const fullHeaders = {
    'user-agent': USER_AGENTS.chrome,
    'x-vercel-ip-country': 'US',
    'x-vercel-ip-city': 'San Francisco',
    'x-vercel-ip-latitude': '37.7749',
    'x-vercel-ip-longitude': '-122.4194',
    'content-length': '1024',
    'traceparent': '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
  }

  bench('all enrichers (all headers present)', () => {
    const ctx: EnrichContext = {
      event: {} as Record<string, unknown>,
      headers: fullHeaders,
      request: { method: 'POST', path: '/api/checkout', requestId: 'req_123' },
      response: { headers: { 'content-length': '512' } },
    }
    for (const enricher of enrichers) enricher(ctx)
  })

  bench('all enrichers (no headers)', () => {
    const ctx: EnrichContext = {
      event: {} as Record<string, unknown>,
      headers: {},
      request: { method: 'GET', path: '/api/health', requestId: 'req_456' },
    }
    for (const enricher of enrichers) enricher(ctx)
  })
})
