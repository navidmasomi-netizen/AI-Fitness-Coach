# Replacement Performance V1

## Responsibility

This document records the measured V1 performance characteristics of the existing Replacement workflow after Sprint 13.10.2 hardening.

No replacement semantics changed in this sprint.

## Measurement method

- Backend recommendation and Apply measurements use the real production service paths.
- Query counts are captured with test-local Prisma client wrappers around injected service clients.
- Durations are observational wall-clock measurements from `performance.now()` in local tests.
- Payload size is measured with `Buffer.byteLength(JSON.stringify(response), "utf8")`.
- Mobile request and cache counts are measured from the concrete screen orchestration path, not from synthetic mocks.

## Baseline before hardening

Measured on a deterministic local fixture using the real services before Sprint 13.10.2 production edits:

### Recommendation / Discovery

- service duration: `42.736 ms`
- Prisma query count: `2`
- queries:
  - `workoutSession.findUnique`
  - `exercise.findMany`
- active catalog rows loaded: `39`
- candidate count evaluated: `39`
- eligible candidate count: `3`
- ranked candidate count: `3`
- public response size: `2,703 bytes`

### Apply Replacement

- service duration: `49.296 ms`
- transaction duration: `48.999 ms`
- Prisma query count: `9`
- queries:
  - `$queryRaw`
  - `workoutSession.findUnique`
  - `exercise.findUnique`
  - `workoutSessionExerciseTarget.updateMany`
  - `workoutSessionExerciseTarget.findUnique`
  - `setLog.updateMany`
  - `workoutSession.findUnique`
  - `program.findUnique`
  - `programDay.findUnique`
- target rows changed: `1`
- SetLog rows changed: `1`
- public response size: `22,497 bytes`

### Mobile successful flow

Baseline successful flow before the mobile hardening change:

1. recommendation request
2. apply request
3. `activeSession` reconciliation refetch triggered by success-path invalidation when the query has an active observer

Baseline cache work on successful Apply:

- `setQueryData(["sessionExerciseTargets", sessionId])`
- `setQueryData(["activeSession"])`
- `invalidateQueries(["activeSession"])`

## Optimizations made

### 1. Apply query reduction

Removed the post-CAS `workoutSessionExerciseTarget.findUnique(...)` reread from Apply.

Reason:

- the service already knows the target id, replacement exercise id, and replacement audit metadata after the successful CAS transition
- the reread did not add authorization, transaction, or correctness guarantees

Effect:

- Apply query count reduced from `9` to `8`
- transaction semantics unchanged

### 2. Mobile success-path reconciliation request reduction

Removed the success-path `invalidateQueries(["activeSession"])` call after a successful Apply.

Reason:

- the Apply API already returns the same authoritative shape required by the `["activeSession"]` cache contract:
  - `session`
  - `program`
  - `programDay`
  - `exercises`
- the workout screen already synchronizes both:
  - `["sessionExerciseTargets", sessionId]`
  - `["activeSession"]`
  directly from the backend Apply response

Effect:

- successful Mobile replacement flow now requires `2` requests instead of an upper bound of `3`
- authoritative recovery on failure remains unchanged
- no optimistic state was introduced

## V1 budgets

These budgets are explicit and reproducible from the current local evidence.

- Recommendation DB query count: `<= 2`
- Apply DB query count: `<= 8`
- Recommendation public payload: `<= 4 KiB`
- Apply public payload: `<= 32 KiB`
- Successful mobile replacement flow requests: `<= 2`

Observed durations are informational only:

- Recommendation: approximately `43 ms` on the local fixture
- Apply: approximately `49 ms` before the query reduction; lower after removing one DB reread

## Scale assessment

### Current catalog size (~39 ACTIVE exercises)

- Candidate scan: `GREEN`
- Similarity / ranking compute: `GREEN`
- DB access: `GREEN`
- payload: `GREEN`

### ~1,000 ACTIVE exercises

- Candidate scan: `YELLOW`
- Similarity / ranking compute: `YELLOW`
- DB access: `YELLOW`
- payload: `GREEN`

Reason:

- recommendation still uses one full ACTIVE-catalog scan
- DB query count stays flat, but in-memory candidate and ranking work scale linearly with catalog size

### ~10,000 ACTIVE exercises

- Candidate scan: `RED`
- Similarity / ranking compute: `RED`
- DB access: `YELLOW`
- payload: `GREEN`

Reason:

- the query count remains low, but the current all-ACTIVE scan plus per-candidate in-memory evaluation will become the dominant cost
- this sprint intentionally does not add caches, vector search, or schema/index changes

## Optimizations intentionally not made

- no schema or index changes
- no Redis or persistent cache
- no candidate-threshold shortcuts
- no recommendation pagination
- no change to ranking, similarity, integrity, or decision semantics
- no recommendation response projection change
- no Apply response projection change

## Future triggers

Future performance work should be revisited when any of the following become true:

- ACTIVE catalog approaches `~1,000` exercises and recommendation latency becomes user-visible
- Apply payload materially grows beyond the current `~22 KB`
- Mobile starts mounting more active observers on `["activeSession"]`
- recommendation payload or alternative counts expand enough to pressure low-bandwidth mobile links
