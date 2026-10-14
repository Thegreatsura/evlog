---
"evlog": minor
---

Add `issues` to the Sentry drain. With `createSentryDrain({ issues: true })`, `error` and `fatal` wide events are also sent as Sentry error events, so they open issues and trigger issue alerts. Events with a 4xx status (a thrown 404, 401 or validation 400) stay logs and open no issue. Each issue carries the wide event's trace context (`traceId`, `spanId`, `parentSpanId`), the same `trace_id` as its structured log, the error stack as frames, `service` and the configured `tags` as tags, `userId` or `user.id` as the user, and `METHOD /path` or `action` as the transaction. Events without a `traceId` get one generated, shared by the log and the issue. Issues are sent one at a time after the logs and are best-effort: a failed issue request does not fail the batch. The option defaults to `false`, so existing setups keep sending logs only.
