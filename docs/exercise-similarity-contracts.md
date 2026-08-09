# Exercise Similarity Contracts

## Responsibility

The Exercise Similarity module defines a pure backend-internal contract for
pairwise comparison of intrinsic Exercise facts.

## Non-goals

- no similarity formulas
- no ranking
- no replacement logic
- no workout integrity
- no database queries
- no generator or progression behavior changes

## Inputs

The canonical similarity profile contains only intrinsic Exercise facts:

- `exerciseId`
- `slug`
- `dnaMovementPattern`
- `complexity`
- `primaryMuscles`
- `secondaryMuscles`
- `requiredEquipment`
- `difficulty`
- `stabilityDemand`
- `axialLoading`

Excluded from the similarity profile:

- user context
- workout context
- program context
- legacy generator metadata
- timestamps
- relations
- `progressionType`

## Outputs

`compareExerciseProfiles(profileA, profileB, policy, comparators)` returns:

- aggregate `score`
- aggregate `status`
- `policyVersion`
- per-dimension breakdown
- machine-readable reasons

## Purity rules

- no database access
- no time access
- no randomness
- no global mutable state
- no input mutation

## Symmetry

Similarity is symmetric by contract:

- `compare(A, B) == compare(B, A)` for score and dimension breakdown

## Determinism

Given the same profiles, comparators, and policy, the output must be
identical.

## Missing-data semantics

Incomplete Exercise DNA does not receive fabricated defaults.

Comparators must mark a dimension `UNAVAILABLE` with machine-readable reasons
instead of returning a fake neutral score.

## Boundary with Replacement

Similarity compares Exercise facts only.

Replacement remains a future policy layer that may use similarity together
with:

- user intent
- workout role
- equipment inventory
- workout integrity
