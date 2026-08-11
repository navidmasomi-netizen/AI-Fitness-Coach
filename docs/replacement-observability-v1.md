# Replacement Observability V1

## Scope

Replacement Observability V1 adds structured tracing around the existing workflow without changing replacement behavior:

1. discovery request
2. recommendation generation
3. recommendation response
4. apply request
5. apply transaction
6. workout synchronization
7. apply response

## Correlation Flow

Two correlation identifiers are used together:

- `requestId`
  - generated once per inbound backend request by `attachRequestContext`
  - present on all backend replacement log events
- `replacementFlowId`
  - generated once on mobile when replacement discovery opens for a specific `sessionId + targetId`
  - sent to backend in `X-Replacement-Flow-Id`
  - present on both mobile and backend replacement log events

This provides:

- per-request backend traceability through `requestId`
- end-to-end mobile-to-backend workflow traceability through `replacementFlowId`

## Event Catalog

### Backend

- `replacement.discovery.started`
- `replacement.discovery.completed`
- `replacement.discovery.failed`
- `replacement.apply.started`
- `replacement.apply.completed`
- `replacement.apply.failed`

### Mobile

- `replacement.discovery.started`
- `replacement.discovery.completed`
- `replacement.discovery.failed`
- `replacement.apply.started`
- `replacement.apply.completed`
- `replacement.apply.failed`

Mobile success recovery after a lost Apply response is represented by:

- `replacement.apply.completed`
- `recovered: true`

## Timing Fields

Logged timing fields are observational only:

- `serviceDurationMs`
  - replacement service execution duration
- `transactionDurationMs`
  - apply transaction duration when available
- `apiDurationMs`
  - total controller duration from inbound request to JSON response

## Failure Taxonomy

Replacement failure events classify:

- `validation`
  - malformed ids, invalid context, invalid replacement exercise, not-active session, not-found inputs
- `authorization`
  - authenticated ownership/auth failures
- `conflict`
  - repeated apply, target-state conflict, ambiguous source logs
- `transaction`
  - unexpected Apply failure after transaction timing has begun
- `unexpected`
  - uncaught runtime failures

No replacement observability path logs:

- auth tokens
- passwords
- raw request bodies
- stack traces on successful paths

## Structured Fields

Common fields:

- `timestamp`
- `level`
- `event`
- `requestId` on backend
- `replacementFlowId`
- `userId`
- `sessionId`
- `targetId`

Discovery completion fields:

- `contextualDecisionStatus`
- `recommendedExerciseId`
- `alternativeCount`
- `contextRejectedCount`
- `activeCatalogCount`
- `candidateCount`
- `eligibleCandidateCount`
- `rankedCandidateCount`
- `responseSizeBytes`

Apply completion fields:

- `appliedTargetId`
- `previousExerciseId`
- `appliedReplacementExerciseId`
- `targetRowsChanged`
- `setLogRowsChanged`
- `responseSizeBytes`

Failure fields:

- `failureCategory`
- `statusCode`
- `errorCode`

## Example Backend Log

```json
{
  "timestamp": "2026-08-11T09:34:10.421Z",
  "level": "info",
  "event": "replacement.apply.completed",
  "requestId": "d2a5d605-9c0f-4ca0-89c8-9f3f57e97f38",
  "replacementFlowId": "replacement-flow-181-942-1754904850152-k1x9n3r2",
  "userId": 44,
  "sessionId": 181,
  "targetId": 942,
  "replacementExerciseId": 77,
  "appliedTargetId": 942,
  "previousExerciseId": 13,
  "appliedReplacementExerciseId": 77,
  "targetRowsChanged": 1,
  "setLogRowsChanged": 2,
  "transactionDurationMs": 18.224,
  "serviceDurationMs": 22.771,
  "apiDurationMs": 24.018,
  "responseSizeBytes": 22536
}
```

## Production Debugging Workflow

1. Start with the mobile `replacementFlowId`.
2. Locate `replacement.discovery.started`.
3. Verify the matching backend `replacement.discovery.completed` or `.failed`.
4. Trace the same `replacementFlowId` into `replacement.apply.started`.
5. Inspect `replacement.apply.completed` or `.failed`.
6. If mobile recovered after a lost response, check for:
   - backend `replacement.apply.completed`
   - mobile `replacement.apply.completed` with `recovered: true`

## Intentionally Not Added In V1

- analytics
- persistent log storage
- distributed tracing vendor SDKs
- schema changes for observability
- public API response changes

V1 is limited to structured logs and correlation-safe timing around the locked replacement workflow.
