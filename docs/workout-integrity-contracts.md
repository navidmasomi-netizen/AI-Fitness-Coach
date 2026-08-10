# Workout Integrity Contracts V1

This document freezes the backend-internal contract boundary and the first
production semantics for Workout Integrity V1.

## Responsibility

Workout Integrity evaluates the hypothetical resulting workout after
replacing one source exercise with one already-ranked candidate.

It consumes:
- `sourceExerciseId`
- `currentWorkoutExercises`
- ranked candidate outputs with attached exercise facts

It produces:
- per-candidate integrity evaluation
- deterministic `PASS`, `WARN`, or `BLOCK` status
- machine-readable integrity reasons
- preserved ranking evidence
- hypothetical workout summaries

## Non-Goals

Workout Integrity V1 does not:
- discover candidates
- recompute Candidate eligibility
- recompute Similarity
- rerank candidates
- choose the final replacement
- query the database
- use user context
- use workout intent
- use injuries, goals, recovery, or weekly volume
- persist integrity outcomes

## Input Contract

Workout Integrity accepts:
- `sourceExerciseId`
- `currentWorkoutExercises`
- `rankedCandidates`
- optional policy override

`rankedCandidates` is an array of entries with:
- `candidateExercise`
- `rankedCandidateResult`

`rankedCandidateResult` must already contain:
- `exerciseId`
- `rankingStatus`
- `rankingScore`
- `rank`
- `rankingBreakdown`
- `rankingReasons`
- `eligibilityEvidence`
- `similarityEvidence`

The engine fails loudly if:
- `sourceExerciseId` is malformed
- the source exercise is missing from the workout
- the source exercise appears multiple times in the workout
- ranked candidate evidence is malformed

## Output Contract

Workout Integrity returns:
- `version`
- `policyVersion`
- `sourceExerciseId`
- `totalEvaluated`
- `evaluations`

Each evaluation returns:
- `exerciseId`
- `integrityStatus`
- `integrityScore`
- `integrityBreakdown`
- `integrityReasons`
- `rankingEvidence`
- `resultingWorkoutSummary`

`rankingEvidence` is preserved verbatim from Ranking output and remains
separate from integrity reasons.

## Status Semantics

Top-level integrity statuses:
- `PASS`
- `WARN`
- `BLOCK`

Rules:
- `BLOCK` cannot be represented by score alone
- blocked candidates remain in output
- incoming ranking order is preserved
- the engine does not reorder candidates

## V1 Integrity Rules

### exactDuplicate

If replacing the source exercise would create another occurrence of the same
`Exercise.id` elsewhere in the workout:
- `BLOCK`

Reason code:
- `WORKOUT_INTEGRITY_EXACT_DUPLICATE`

This rule is not part of the weighted integrity score.

### movementPatternRedundancy

Uses resulting-workout `dnaMovementPattern` counts.

Semantics:
- resulting count `<= 2`: `PASS`
- resulting count `>= 3`: `WARN`

V1 does not block on pattern concentration alone.

Reason codes:
- `WORKOUT_INTEGRITY_MOVEMENT_PATTERN_BALANCED`
- `WORKOUT_INTEGRITY_MOVEMENT_PATTERN_CONCENTRATED`

### exerciseClassConcentration

Uses resulting-workout `complexity` counts.

Semantics:
- if workout size `< 4`: `PASS`
- if workout size `>= 4` and resulting workout is `100% compound`: `WARN`
- if workout size `>= 4` and resulting workout is `100% isolation`: `WARN`
- otherwise: `PASS`

V1 does not block on class concentration alone.

Reason codes:
- `WORKOUT_INTEGRITY_EXERCISE_CLASS_BALANCED`
- `WORKOUT_INTEGRITY_EXERCISE_CLASS_CONCENTRATION`

### primaryMuscleRedundancy

Uses resulting-workout canonical primary-muscle occurrence counts.

Semantics:
- every primary muscle count `<= 2`: `PASS`
- any primary muscle count `>= 3`: `WARN`

V1 does not block on primary-muscle concentration alone.

Reason codes:
- `WORKOUT_INTEGRITY_PRIMARY_MUSCLE_BALANCED`
- `WORKOUT_INTEGRITY_PRIMARY_MUSCLE_CONCENTRATION`

## Scoring Policy V1

Policy version:
- `workout-integrity-v1`

Exact duplicate:
- blocks separately
- does not use weighted scoring

Non-blocked dimension scores:
- movement pattern:
  - `PASS = 1.0`
  - `WARN = 0.75`
- exercise class:
  - `PASS = 1.0`
  - `WARN = 0.85`
- primary muscle:
  - `PASS = 1.0`
  - `WARN = 0.75`

Aggregate weights:
- movement pattern: `0.40`
- primary muscle: `0.40`
- exercise class: `0.20`

Aggregate formula:

```text
integrityScore =
sum(availableDimensionScore * configuredWeight)
/
sum(configuredWeight for AVAILABLE dimensions)
```

If exact duplicate is triggered:
- `integrityStatus = BLOCK`
- `integrityScore = null`

## Missing-Data Semantics

If a required fact for one integrity dimension is missing:
- that dimension is `UNAVAILABLE`
- no value is fabricated

Unavailable dimensions:
- are excluded from numerator
- are excluded from denominator
- remain visible in `integrityBreakdown`

If all non-duplicate scoring dimensions are unavailable:
- `integrityStatus = WARN`
- `integrityScore = null`

Reason code:
- `WORKOUT_INTEGRITY_INSUFFICIENT_METADATA`

## Explainability

Integrity reasons are machine-readable only.

Structured evidence includes examples such as:
- duplicate exercise ids and indexes
- movement-pattern counts
- exercise-class counts
- concentrated primary muscles
- unavailable dimensions

No user-facing prose is generated here.

## Resulting Workout Semantics

Workout Integrity evaluates:

```text
current workout
- source exercise
+ candidate exercise
```

The replacement is logical and in-place.

If `sourceExerciseId` appears multiple times in the current workout:
- the engine fails loudly
- it does not guess which occurrence to replace

## Boundary With Ranking And Future Decision Logic

Workout Integrity V1:
- consumes ranked candidates
- preserves ranking evidence unchanged
- may block or warn candidates
- must not modify ranking scores
- must not modify Candidate eligibility
- must not modify Similarity

Future Replacement Decision logic will later combine:
- Candidate eligibility
- Ranking
- Workout Integrity

That combination is out of scope for V1.
