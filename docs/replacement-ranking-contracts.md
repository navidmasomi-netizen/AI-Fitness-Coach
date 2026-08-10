# Replacement Ranking Contracts V1

This document freezes the backend-internal contract boundary for
Replacement Ranking V1.

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
- define final product ranking formulas

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

## Policy Contract

Ranking policy is versioned and independent from Similarity Policy V1.

Expected shape:

```js
{
  version: "test-policy-v1",
  enabledDimensions: [
    "semantic_similarity",
    "muscle_preservation",
    "equipment_delta",
    "demand_delta"
  ],
  weights: {
    semantic_similarity: 1,
    muscle_preservation: 1,
    equipment_delta: 1,
    demand_delta: 1
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

V1 test policies are contract fixtures only, not product ranking policy.

## Ordering And Tie-Breaking

Ranking ordering is deterministic:
- `AVAILABLE` before `UNAVAILABLE`
- higher `rankingScore` first
- exact ties break by ascending `exerciseId`

Tie-breaking must not depend on input array order.

## Explainability Separation

Ranking reasons use the `RANKING_*` namespace and explain ranking output
only.

Eligibility evidence remains preserved from Candidate Engine output and is
not merged into ranking reasons.

Similarity evidence remains preserved from Similarity Engine output and is
not recomputed by Ranking.

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
