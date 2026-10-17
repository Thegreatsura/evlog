---
"evlog": minor
---

Add `evlog/effect` for Effect 4, in beta: its exports and the fields it writes may change in a minor release. Provide `routerLayer(options)` to an `HttpRouter` or `HttpApi` and every request emits one wide event, with the failure read from the `Cause` and the status the client received. Handlers read the event with `yield* EvlogLogger` (or `yield* useLogger<Fields>()` for typed fields), and `withLogger('action')` turns a job, queue message or Durable Object alarm into its own event. Events carry the unit's `traceId` and `spanId` and continue an incoming `traceparent`. `loggerLayer()` folds `Effect.log*` calls into the current event, and `initLoggerLayer(config)` initializes evlog and flushes a pipeline drain on shutdown. The entry point uses no `AsyncLocalStorage`, so it runs on Cloudflare Workers without `nodejs_compat`.
