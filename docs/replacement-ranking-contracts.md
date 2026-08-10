# Replacement Ranking Contracts V1

This document freezes the backend-internal contract boundary and the first
production ranking semantics for Replacement Ranking V1.

## Responsibility

Replacement Ranking orders already-eligible replacement candidates for a
specific source exercise.

It consumes:
- the source exercise
- eligible candidate outputs from Candidate Engine V1
- a versioned ranking policy

It produces:
- a deterministic ordered candidate list
- ranking scores in the `0.0` to `1.0` domain
- machine-readable ranking reasons
- preserved eligibility evidence
- preserved similarity evidence

## Non-Goals

Replacement Ranking V1 does not:
- discover candidates
- recompute candidate eligibility
- override eligibility
- persist scores
- query the database
- use user context
- use workout context
- use top-N cutoffs
- expose API responses
- use difficulty

## Directional Semantics

Ranking is directional:

- `rank(sourceA, candidateB)` is not required to equal
  `rank(sourceB, candidateA)`

Directionality exists because ranking preserves the role of the source
exercise. V1 remains independent from user context and workout context.

## Input Contract

Ranking accepts:
- `sourceExercise`
- `eligibleCandidates`
- `policy`
- `evaluateCandidateRanking`

`eligibleCandidates` is an array of entries with:
- `candidateExercise`
- `candidateResult`

`candidateResult` must already show:
- `eligibility === true`
- no blocked rules
- preserved similarity evidence

Blocked candidates are invalid ranking input and must fail loudly.

## Output Contract

Ranking returns:
- `version`
- `policyVersion`
- `sourceExerciseId`
- `totalRanked`
- `rankedCandidates`

Each ranked candidate returns:
- `exerciseId`
- `rankingStatus`
- `rankingScore`
- `rank`
- `rankingBreakdown`
- `rankingReasons`
- `eligibilityEvidence`
- `similarityEvidence`

`eligibilityEvidence` and `rankingReasons` are intentionally separate.

## Ranking Dimensions V1

Replacement Ranking V1 implements exactly three ranking dimensions:
- `musclePreservation`
- `equipmentPreservation`
- `demandPreservation`

Movement pattern and exercise class are not separate ranking dimensions in
V1 because Candidate Engine already hard-gates exact movement-pattern
equality and exact exercise-class equality.

Similarity remains preserved as upstream evidence through
`similarityEvidence`, but it is not part of the weighted Ranking V1
aggregate. This prevents double-counting because Similarity already
captures movement, exercise class, muscle, equipment, and demand semantics,
while Ranking V1 scores directional source preservation only.

### musclePreservation

`musclePreservation` is directional from source exercise to candidate.

Source role weights:
- source primary muscle = `1.0`
- source secondary muscle = `0.5`

Candidate preservation credit:
- source primary -> candidate primary = `1.0`
- source primary -> candidate secondary = `0.5`
- source secondary -> candidate primary = `1.0`
- source secondary -> candidate secondary = `1.0`

Formula:

```text
musclePreservation =
preserved weighted source muscle value
/
total weighted source muscle value
```

Normalization rules:
- duplicate muscles are ignored
- if a source muscle appears in both source roles, primary wins
- if source has no muscle metadata, the dimension is `UNAVAILABLE`
- if candidate has no muscle metadata, the dimension is `UNAVAILABLE`

### equipmentPreservation

`equipmentPreservation` is directional recall-style preservation:

```text
equipmentPreservation =
|sourceRequired ∩ candidateRequired|
/
|sourceRequired|
```

Candidate extra equipment does not reduce this V1 score.

If source or candidate has empty `requiredEquipment`, the dimension is
`UNAVAILABLE`.

### demandPreservation

`demandPreservation` uses source-owned preservation semantics over:
- `stabilityDemand`
- `axialLoading`

Ordinal orders:
- stability: `LOW < MODERATE < HIGH`
- axial loading: `NONE < LOW < HIGH`

Per available component:

```text
componentScore = 1 - distance / maxDistance
```

Demand score:

```text
demandPreservation =
average(available component scores)
```

If one component is missing, the available component is used alone.

If both are missing, the dimension is `UNAVAILABLE`.

### difficulty

`difficulty` is intentionally excluded from Ranking V1 because the current
repository semantics mix technical difficulty, loading potential, and user
suitability too broadly to serve as a precise ranking dimension.

## Policy Contract

Ranking policy is versioned and independent from Similarity Policy V1.

Production Ranking Policy V1:

```js
{
  version: "replacement-ranking-v1",
  enabledDimensions: [
    "musclePreservation",
    "equipmentPreservation",
    "demandPreservation"
  ],
  weights: {
    musclePreservation: 0.50,
    equipmentPreservation: 0.25,
    demandPreservation: 0.25
  }
}
```

Validation rejects:
- missing version
- unknown dimensions
- disabled-dimension weights
- missing enabled-dimension weights
- negative weights
- `NaN`
- `Infinity`
- all-zero weights

These are ranking-policy weights only and do not alter Similarity Policy V1.

## Missing Data Semantics

Replacement Ranking V1 follows the same renormalization principle as
Similarity Rule 24.

Unavailable ranking dimensions:
- are excluded from the numerator
- are excluded from the denominator
- remain visible in the breakdown
- never become hidden neutral scores

Aggregate formula:

```text
rankingScore =
sum(availableDimensionScore * configuredWeight)
/
sum(configuredWeight for AVAILABLE dimensions)
```

If no dimension is available:
- `rankingStatus = UNAVAILABLE`
- `rankingScore = null`

## Ordering And Tie-Breaking

Ranking ordering is deterministic:
- `AVAILABLE` before `UNAVAILABLE`
- higher `rankingScore` first
- exact ties break by ascending `exerciseId`

Tie-breaking must not depend on input array order.

## Precision

Returned dimension scores and final `rankingScore` are rounded to 4 decimal
places. Internal calculations may use full JavaScript precision.

## Explainability Separation

Ranking reasons use the `RANKING_*` namespace and explain ranking output
only.

Eligibility evidence remains preserved from Candidate Engine output and is
not merged into ranking reasons.

Similarity evidence remains preserved from Similarity Engine output and is
not recomputed by Ranking.

Similarity evidence includes:
- `similarityScore`
- `similarityStatus`
- `similarityBreakdown`

Similarity evidence is not:
- a weighted ranking dimension
- a hidden multiplier
- an eligibility override
- a ranking tie-break input

Structured evidence examples:
- `musclePreservation`
  - source primary muscles
  - source secondary muscles
  - candidate primary muscles
  - candidate secondary muscles
  - preserved and missing source muscles
  - preserved weighted value / total weighted value
- `equipmentPreservation`
  - source required equipment
  - candidate required equipment
  - shared source setup
  - source setup missing from candidate
- `demandPreservation`
  - source and candidate stability values
  - source and candidate axial-loading values
  - per-component preservation scores

## Golden Ranking Cases

V1 golden ranking coverage includes:
- Back Squat source:
  - stronger same-pattern preservation outranks weaker same-pattern preservation
- Bench Press source:
  - equipment differences affect rank but do not block eligibility
- Directional muscle preservation:
  - better preservation of source primary muscles ranks higher
- Directional equipment preservation:
  - `rank(sourceA -> candidateB)` can differ from `rank(sourceB -> candidateA)`
- Missing ranking metadata:
  - unavailable dimensions renormalize instead of penalizing

## Boundaries

Replacement Ranking V1:
- may consume Candidate Engine output
- may consume Similarity evidence already attached to eligible candidates
- must not call Candidate Engine internally
- must not call Similarity internals directly
- must not act as Workout Integrity

Boundary summary:
- Candidate Engine decides whether a candidate may enter ranking
- Ranking orders eligible candidates only
- Workout Integrity will later decide whether an otherwise ranked candidate
  fits a concrete workout context
