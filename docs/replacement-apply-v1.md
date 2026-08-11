# Replacement Apply API V1

## Responsibility

Replacement Apply API V1 is the authenticated mutation boundary for committing
an explicitly selected replacement onto one exact workout target occurrence.

It is responsible for:

- validating authenticated ownership
- validating session and target occurrence identity
- validating the selected replacement exercise
- performing one transactional mutation
- preserving target prescription metadata
- rewriting matching session `SetLog.exerciseId` values atomically
- persisting replacement audit provenance
- returning the authoritative updated workout state

It is not responsible for:

- recomputing recommendations
- rerunning Candidate, Similarity, Ranking, Integrity, or Decision engines
- selecting a replacement on the user's behalf
- mutating any target occurrence other than the specified one

## Endpoint

```http
POST /api/sessions/:sessionId/exercise-targets/:targetId/replacements/apply
```

Identity rules:

- workout container identity is `WorkoutSession.id`
- exact workout exercise occurrence identity is
  `WorkoutSessionExerciseTarget.id`
- the selected replacement identity is `Exercise.id`

`Exercise.id` alone is never sufficient to identify the source occurrence.

## Authentication And Ownership

- route uses the existing `requireAuth` middleware
- authenticated identity comes from `req.userId`
- session ownership follows current workout-session convention
- if the session does not exist or does not belong to the authenticated user,
  the API returns `404`

The endpoint never trusts any client-supplied user identifier.

## Request Body

```json
{
  "replacementExerciseId": 51
}
```

Rules:

- body must be a plain object
- only top-level field allowed is `replacementExerciseId`
- `replacementExerciseId` must be a positive integer
- the selected replacement exercise must exist, be `ACTIVE`, and differ from
  the target's current `exerciseId`

The client does not send:

- recommendation evidence
- ranking score
- integrity score
- candidate eligibility evidence
- similarity evidence
- replacement context

Apply consumes explicit user selection only.

## Transaction Semantics

Apply runs inside one Prisma transaction.

Within that transaction the service:

1. locks the owned `WorkoutSession` row
2. validates session ownership and `active` status
3. loads session targets and set logs
4. validates target existence
5. validates that Apply has not already happened
6. validates selected replacement exercise
7. performs an atomic compare-and-set target transition
8. rewrites matching session set-log `exerciseId` values
9. persists structured Apply audit provenance
10. reloads and returns the authoritative updated workout

Exactly one target row must transition. If another concurrent mutation changes
that target first, Apply fails with deterministic `409` conflict.

## Preservation Contract

Successful Apply mutates only the exact target occurrence.

Preserved target prescription fields:

- `targetSets`
- `targetRepRangeLow`
- `targetRepRangeHigh`
- `exactRepTarget`
- `targetLoadKg`
- `targetDurationSeconds`
- `progressionType`

Preserved set-log fields:

- `setNumber`
- `reps`
- `weightKg`
- `loggedAt`

Only `exerciseId` is rewritten for matching session set logs.

## Audit Provenance

Successful Apply returns:

```json
{
  "targetId": 456,
  "previousExerciseId": 13,
  "replacementExerciseId": 51,
  "sourceDecisionType": "REPLACEMENT_APPLY_V1",
  "audit": {
    "version": "replacement-apply-audit-v1",
    "sessionId": 123,
    "targetId": 456,
    "appliedByUserId": 9,
    "appliedAt": "2026-08-11T09:34:10.421Z",
    "previousExerciseId": 13,
    "replacementExerciseId": 51,
    "previousSourceDecisionType": "MAINTAIN",
    "previousSourceRulesVersion": "progression_decision_rules_v5"
  }
}
```

V1 audit persistence uses temporary structured transport in
`WorkoutSessionExerciseTarget.sourceRulesVersion`.

This is temporary only. A dedicated replacement-audit persistence model is
planned later. No schema migration was introduced in V1.

## Successful Response

```json
{
  "version": "replacement-apply-v1",
  "session": {
    "id": 123,
    "status": "active",
    "exerciseTargets": [],
    "setLogs": []
  },
  "program": {
    "id": 7,
    "name": "Upper / Lower",
    "splitFamily": "upper_lower",
    "goal": "strength",
    "isStatic": false
  },
  "programDay": {
    "id": 11,
    "dayIndex": 1,
    "name": "Lower A",
    "exercises": []
  },
  "exercises": [],
  "appliedReplacement": {
    "targetId": 456,
    "previousExerciseId": 13,
    "replacementExerciseId": 51,
    "sourceDecisionType": "REPLACEMENT_APPLY_V1",
    "audit": {
      "version": "replacement-apply-audit-v1",
      "sessionId": 123,
      "targetId": 456,
      "appliedByUserId": 9,
      "appliedAt": "2026-08-11T09:34:10.421Z",
      "previousExerciseId": 13,
      "replacementExerciseId": 51,
      "previousSourceDecisionType": "MAINTAIN",
      "previousSourceRulesVersion": "progression_decision_rules_v5"
    }
  }
}
```

The response is authoritative. Mobile uses this payload to synchronize:

- updated workout target occurrences
- updated grouped set logs
- active-session cache state

## HTTP Status Mapping

- `200`
  - Apply succeeded
- `401`
  - missing or invalid authentication
- `404`
  - session not found
  - target not found
  - session ownership mismatch under the existing session convention
- `409`
  - repeated Apply on the same target
  - target state changed before Apply completed
  - ambiguous duplicate-source set-log attribution
- `422`
  - malformed body
  - invalid replacement exercise
  - session is not active
- `500`
  - unexpected application failure only

## Concurrency And Idempotency

Apply is a one-time mutation on a given target occurrence.

Repeated requests:

- produce no additional state change
- are rejected with `409`

Concurrency protections:

- owned session row lock
- atomic compare-and-set target transition
- single transaction covering target change, audit provenance, and set-log
  rewrite

## Mobile Integration Boundary

Mobile calls Apply only after the user explicitly selects one recommended or
alternative replacement.

Mobile does not recompute discovery after success. It uses the authoritative
Apply response to update:

- `["sessionExerciseTargets", sessionId]`
- `["activeSession"]`

## Observability

Apply logs structured replacement events:

- `replacement.apply.started`
- `replacement.apply.completed`
- `replacement.apply.failed`

Those events include:

- `requestId`
- optional mobile `replacementFlowId`
- target identity
- selected `replacementExerciseId`
- timing and mutation counts
