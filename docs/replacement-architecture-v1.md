# Replacement Architecture V1

## Overview

Replacement V1 is a layered system with a strict separation between:

- intrinsic recommendation generation
- runtime context filtering
- recommendation discovery
- transactional mutation
- post-Apply workout synchronization

The implemented flow is:

1. Discovery
2. Candidate Engine
3. Ranking
4. Workout Integrity
5. Core Decision
6. Context-aware Decision
7. Recommendation API
8. Mobile Discovery
9. Apply API
10. Transactional Apply
11. Workout Synchronization

## End-to-End Flow

### 1. Discovery

Mobile opens replacement discovery for one exact target occurrence:

- `sessionId = WorkoutSession.id`
- `targetId = WorkoutSessionExerciseTarget.id`

Discovery is read-only.

### 2. Candidate Engine

The backend loads the active exercise catalog and evaluates intrinsic
candidate eligibility for the source exercise.

This stage remains:

- deterministic
- catalog-driven
- context-independent

### 3. Ranking

Only intrinsically eligible candidates are ranked. Ranking remains an internal
ordering signal. It is not probability or confidence.

### 4. Workout Integrity

Ranked candidates are evaluated against the current workout structure. This
can downgrade or block candidates without changing Candidate or Ranking
evidence.

### 5. Core Decision

Core Replacement Decision chooses the ordered non-blocked recommendation set
without runtime context.

### 6. Context-aware Decision

Context-aware policy applies runtime equipment feasibility and explicit
Replacement Intent after Core Decision:

- it can contextually reject a candidate
- it can preserve a candidate under unknown context
- it does not rerank
- it does not recompute upstream engines

### 7. Recommendation API

The Recommendation API validates request context, loads required data, runs
the locked backend pipeline, and returns a controlled public projection.

### 8. Mobile Discovery

Mobile:

- collects minimal replacement reason/context
- requests recommendations
- renders recommended replacement, alternatives, warnings, and no-replacement
  outcomes
- keeps selection ephemeral until Apply

### 9. Apply API

Apply is a separate mutation endpoint. It consumes only:

- authenticated user identity
- `sessionId`
- `targetId`
- explicitly selected `replacementExerciseId`

It does not rerun discovery or recommendation.

### 10. Transactional Apply

Apply:

- locks the owned session row
- validates active status and target state
- atomically transitions one target occurrence
- rewrites matching set-log exercise ids
- persists audit provenance
- returns the authoritative updated workout snapshot

### 11. Workout Synchronization

Mobile synchronizes from the backend Apply response by updating:

- `["sessionExerciseTargets", sessionId]`
- `["activeSession"]`

No optimistic replacement is synthesized client-side.

## Responsibility Boundaries

### Intrinsic Recommendation Layers

- Similarity
- Candidate Engine
- Ranking
- Workout Integrity
- Core Decision

These layers are locked and must not depend on mobile UI state or Apply
mutation state.

### Context Layer

- Replacement Context
- Replacement Intent
- Equipment Availability
- Context-aware Decision

These layers consume explicit contextual facts only.

### Orchestration Layers

- Recommendation API
- Mobile Discovery
- Apply API
- Mobile synchronization

These layers wire existing engines together without redefining their policy.

## Audit And Traceability

Replacement V1 has two separate trace mechanisms:

- mutation audit provenance
  - persisted on Apply through the target occurrence provenance fields
- operational observability
  - request-level `requestId`
  - end-to-end `replacementFlowId`
  - structured lifecycle logs

## Glossary

`Exercise`

- canonical catalog exercise identity and authored fact set

`Target`

- a `WorkoutSessionExerciseTarget` row representing one workout occurrence

`Target Occurrence`

- one exact mutable exercise slot in one workout session, identified by
  `targetId`

`Candidate`

- a catalog exercise evaluated as a possible replacement for the source
  exercise

`Replacement Context`

- explicit runtime context container carrying `equipmentContext` and
  `replacementIntent`

`Replacement Intent`

- explicit machine-readable reason for requesting a replacement

`Contextual Decision`

- the post-Core recommendation result after runtime feasibility policy is
  applied

`Apply`

- the transactional mutation that commits the user-selected replacement onto
  the target occurrence

`Audit`

- durable Apply provenance describing who changed what target, when, and from
  which prior state

`Correlation ID`

- structured trace identifier used to reconstruct one replacement workflow
  across mobile and backend logs

## Document Map

- `docs/replacement-context-contracts.md`
- `docs/replacement-intent-contracts.md`
- `docs/context-aware-replacement-decision.md`
- `docs/replacement-api-v1.md`
- `docs/replacement-apply-v1.md`
- `docs/mobile-replacement-discovery-v1.md`
- `docs/replacement-performance-v1.md`
- `docs/replacement-observability-v1.md`
