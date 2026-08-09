# Exercise Similarity Contracts

## Responsibility

The Exercise Similarity module defines a pure backend-internal contract for
pairwise comparison of intrinsic Exercise facts.

## Non-goals

- no replacement logic
- no replacement ranking
- no candidate search
- no workout integrity
- no workout or user context
- no database queries
- no generator or progression behavior changes
- no score persistence

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
- inventory
- legacy generator metadata
- timestamps
- relations
- `progressionType`

`difficulty` stays in the normalized profile for forward compatibility, but it
is not used by Similarity V1 because its repository semantics are mixed across
training-level suitability and programming.

## V1 Dimensions

Enabled in Similarity V1:

- `movement`
- `exerciseClass`
- `muscle`
- `equipment`
- `demand`

Deferred:

- `execution`

`exerciseClass` is modeled as its own dimension because `complexity`
(`compound` / `isolation`) is independent from movement pattern and should not
be buried inside movement or muscle semantics.

## Comparator Semantics

### Movement

Input:

- `dnaMovementPattern`

V1 semantics:

- same pattern => `1.0`
- different pattern => `0.0`
- missing pattern on either side => `UNAVAILABLE`

No movement-relationship matrix exists in V1.

### Exercise Class

Input:

- `complexity`

V1 semantics:

- same class => `1.0`
- different class => `0.0`
- missing class on either side => `UNAVAILABLE`

### Muscle

Inputs:

- `primaryMuscles`
- `secondaryMuscles`

Comparator-local semantic constants:

- primary weight = `1.0`
- secondary weight = `0.5`

These are similarity semantics only. They are not weekly-volume or
physiological set-credit weights.

Formula:

1. Normalize to unique muscle sets.
2. Build a weighted muscle map per exercise where primary membership dominates
   secondary membership and duplicate strings do not change the result.
3. Compute weighted Jaccard similarity:

`sum(min(weightA, weightB)) / sum(max(weightA, weightB))`

Missing rules:

- both exercises missing all muscle metadata => `UNAVAILABLE`
- one side missing all muscle metadata => `UNAVAILABLE`
- valid metadata with no overlap => `AVAILABLE` score `0.0`

### Equipment

Input:

- `requiredEquipment`

Formula:

- Jaccard set similarity

`|A ∩ B| / |A ∪ B|`

Missing rules:

- empty `requiredEquipment` on either side => `UNAVAILABLE`

Equipment similarity compares requirement sets only. It is not equipment
availability or inventory matching.

### Demand

Inputs:

- `stabilityDemand`
- `axialLoading`

Ordinal similarity formula:

`1 - (distance / maxDistance)`

Stability order:

- `LOW`
- `MODERATE`
- `HIGH`

Axial loading order:

- `NONE`
- `LOW`
- `HIGH`

Demand score:

- average of available subcomponent scores only
- if one subcomponent is unavailable, the other one stands alone
- if both are unavailable, demand is `UNAVAILABLE`

## Policy V1

Default product policy version:

- `exercise-similarity-v1`

Weights:

- `movement`: `0.35`
- `exerciseClass`: `0.10`
- `muscle`: `0.25`
- `equipment`: `0.15`
- `demand`: `0.15`

These are policy weights, not Exercise facts.

## Aggregation

Similarity follows Rule 24:

`finalScore = sum(availableDimensionScore * configuredWeight) / sum(configuredWeight for AVAILABLE dimensions)`

Rules:

- unavailable dimensions are excluded from the numerator
- unavailable dimensions are excluded from the denominator
- unavailable dimensions remain visible in the breakdown
- missing metadata never becomes a hidden score
- if all enabled dimensions are unavailable:
  - `status = UNAVAILABLE`
  - `score = null`
  - reason code `SIMILARITY_ENGINE_NO_AVAILABLE_DIMENSIONS`

## Output

`compareExercisesV1(rawExerciseA, rawExerciseB)` returns:

- aggregate `score`
- aggregate `status`
- `policyVersion`
- per-dimension breakdown
- machine-readable `reasons`

Comparator results always include:

- `dimension`
- `status`
- `score`
- `reasons`
- optional machine-readable `evidence`

When evidence would otherwise be directional, the engine normalizes profile
ordering by stable exercise identity so `compare(A, B)` and `compare(B, A)`
produce the same breakdown.

## Precision

Returned comparator and aggregate scores are rounded to 4 decimal places.
Internal calculations may use normal JavaScript precision.

## Purity Rules

- no database access
- no time access
- no randomness
- no global mutable state
- no input mutation

## Symmetry and Determinism

Similarity is symmetric and deterministic by contract:

- `compare(A, B) == compare(B, A)` for score and per-dimension breakdown
- same inputs + same policy => same output

## Missing-data Semantics

Incomplete Exercise DNA does not receive fabricated defaults.

Comparators must mark a dimension `UNAVAILABLE` with machine-readable reasons
instead of returning:

- `0`
- `0.5`
- any hidden neutral/default score

## Boundary with Replacement

Similarity compares Exercise facts only.

Replacement remains a future policy layer that may use similarity together
with:

- user intent
- workout role
- equipment inventory
- workout integrity
