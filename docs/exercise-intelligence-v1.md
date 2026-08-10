# Exercise Intelligence Foundation V1

This document freezes the authoritative Exercise Intelligence Foundation V1
architecture before Candidate Engine development.

## Scope

This freeze covers:

- Exercise Catalog Foundation
- Exercise DNA V1
- Exercise Similarity Contract
- Exercise Similarity Policy V1
- Gold Standard `v1.1`
- Calibration and Governance

This freeze does not implement:

- Candidate Engine
- Replacement Engine
- Workout Integrity Engine
- catalog expansion
- optimization or persistence layers

## Asset Registry

### Exercise Catalog Foundation

- canonical repository path:
  - `backend/prisma/schema.prisma`
  - `backend/prisma/seed.js`
  - `backend/src/services/exerciseCatalogCuration.js`
  - `backend/scripts/backfillExerciseCatalogFoundation.js`
- current version: `V1 passive catalog foundation`
- owner: `Exercise Catalog`
- source-of-truth status: `authoritative for passive catalog and DNA fields on Exercise`
- consumers:
  - `seed.js`
  - existing-database catalog backfill
  - Exercise Similarity profile building
  - catalog validation
- prohibited duplication:
  - no second Exercise DNA truth source
  - no parallel Exercise catalog table for the same canonical facts

### Exercise DNA V1

- canonical repository path:
  - `backend/prisma/schema.prisma`
  - `backend/src/services/exerciseCatalogCuration.js`
- current version: `Exercise DNA V1`
- owner: `Exercise Catalog`
- source-of-truth status: `authoritative passive semantic facts on Exercise`
- consumers:
  - Exercise Similarity
  - calibration fixtures
  - future Candidate Engine
- prohibited duplication:
  - do not re-author DNA semantics in generator, API, or mobile-specific mirrors

### Exercise Similarity Contract

- canonical repository path:
  - `backend/src/services/exerciseSimilarity/index.js`
  - `docs/exercise-similarity-contracts.md`
- current version: `Similarity Contract V1`
- owner: `Exercise Similarity`
- source-of-truth status: `authoritative pairwise similarity engine contract`
- consumers:
  - calibration runner
  - future Candidate Engine
  - future Replacement Engine
- prohibited duplication:
  - no second scoring contract
  - no hidden comparator semantics outside the module

### Exercise Similarity Policy V1

- canonical repository path:
  - `backend/src/services/exerciseSimilarity/index.js`
  - `docs/exercise-similarity-contracts.md`
- current version: `exercise-similarity-v1`
- owner: `Exercise Similarity`
- source-of-truth status: `authoritative default weighting policy`
- consumers:
  - pairwise similarity aggregation
  - calibration runner
  - future Candidate Engine
- prohibited duplication:
  - no separate policy copy inside comparators
  - no downstream hard-coded weight forks

### Gold Standard v1.1

- canonical repository path:
  - `backend/data/similarity/gold-standard-v1.json`
- current version: `gold-standard-v1.1`
- owner: `Calibration / Governance`
- source-of-truth status: `authoritative semantic calibration dataset`
- consumers:
  - calibration validator
  - calibration runner
  - calibration report generation
- prohibited duplication:
  - no alternate gold dataset in tests
  - no shadow label lists in docs or code

### Calibration / Governance Layer

- canonical repository path:
  - `backend/src/services/exerciseSimilarity/calibration.js`
  - `backend/src/services/exerciseSimilarity/calibrationFixtures.js`
  - `backend/src/services/exerciseSimilarity/calibration.test.js`
  - `docs/exercise-similarity-contracts.md`
- current version: `Calibration / Governance V1`
- owner: `Calibration / Governance`
- source-of-truth status: `authoritative validation and reporting layer for similarity quality`
- consumers:
  - Gold Dataset validation
  - baseline reporting
  - future policy tuning workflow
- prohibited duplication:
  - no second calibration runner
  - no separate threshold map hidden in tests

## Frozen Engine Boundaries

### Exercise Catalog

Owns canonical Exercise facts, passive DNA semantics, lifecycle metadata, and
required equipment semantics.

### Exercise Similarity

Owns intrinsic pairwise semantic similarity between exercises only.

### Workout Generator

Remains unchanged and does not consume Similarity V1.

### Progression

Remains unchanged and independent from Similarity V1.

### Future Candidate Engine

Will consume Similarity V1 and active catalog exercises, but must not change
Similarity semantics.

### Future Replacement Ranking

Will be directional and policy-aware. It is not the same system as Similarity.

### Future Workout Integrity

Will evaluate workout context only after candidate generation and ranking.

### Frozen non-equivalences

- Similarity != Candidate Eligibility
- Similarity != Replacement Ranking
- Similarity != Workout Integrity

## Similarity V1 Frozen Contract

### Dimensions and Weights

- `movement`: `0.35`
- `exerciseClass`: `0.10`
- `muscle`: `0.25`
- `equipment`: `0.15`
- `demand`: `0.15`

Deferred:

- `execution`

### Comparator semantics

#### Movement

- input: `dnaMovementPattern`
- same pattern => `1.0`
- different pattern => `0.0`
- missing pattern on either side => `UNAVAILABLE`

#### Exercise Class

- input: `complexity`
- same class => `1.0`
- different class => `0.0`
- missing class on either side => `UNAVAILABLE`

#### Muscle

- inputs:
  - `primaryMuscles`
  - `secondaryMuscles`
- semantic constants:
  - primary weight = `1.0`
  - secondary weight = `0.5`
- normalization:
  - duplicate muscle strings do not change score
  - primary membership dominates secondary if both appear
- formula:
  - weighted Jaccard
  - `sum(min(weightA, weightB)) / sum(max(weightA, weightB))`
- missing rules:
  - if either side lacks all muscle metadata => `UNAVAILABLE`
  - valid metadata with no overlap => `AVAILABLE` score `0.0`

#### Equipment

- input: `requiredEquipment`
- formula:
  - Jaccard set similarity
  - `|A ∩ B| / |A ∪ B|`
- missing rule:
  - empty `requiredEquipment` on either side => `UNAVAILABLE`

#### Demand

- inputs:
  - `stabilityDemand`
  - `axialLoading`
- stability order:
  - `LOW`
  - `MODERATE`
  - `HIGH`
- axial loading order:
  - `NONE`
  - `LOW`
  - `HIGH`
- subcomponent formula:
  - `1 - (distance / maxDistance)`
- demand combination:
  - average available subcomponents only
  - if one subcomponent is unavailable, the other stands alone
  - if both are unavailable, demand is `UNAVAILABLE`

### Missing-data aggregation

Rule 24 is frozen:

- unavailable dimensions are excluded from the numerator
- unavailable dimensions are excluded from the denominator
- unavailable dimensions remain visible in the breakdown
- missing metadata never becomes a hidden `0`, `0.5`, or other neutral default
- if all enabled dimensions are unavailable:
  - `status = UNAVAILABLE`
  - `score = null`

### Precision

- comparator scores are rounded to `4` decimal places
- aggregate score is rounded to `4` decimal places

### Persistence and I/O

- no similarity persistence
- no similarity table
- no cached DB scores
- zero database queries inside Similarity V1

## Gold Standard v1.1 Frozen Baseline

### ALL

- total pairs: `102`
- exact match: `0.7549`
- within-one-category: `0.9902`
- critical inversions: `1`

### ACTIVE_ONLY

- total pairs: `96`
- exact match: `0.7604`
- within-one-category: `1.0000`
- critical inversions: `0`

### HIGH_CONFIDENCE_ONLY

- total pairs: `50`
- exact match: `0.9800`
- within-one-category: `1.0000`
- critical inversions: `0`

### Known engine-side open issue

- `Back Squat <> Goblet Squat (Synthetic)`

This remains a known engine-side issue in the frozen baseline and is not
resolved by this architecture freeze.

## Known Deferred Items

- canonical Muscle Taxonomy refinement
- execution similarity dimension
- ambiguous canonical definitions:
  - `Bodyweight Inverted Row`
  - `Dumbbell Row`
  - `Weighted Pull-Up`
- equipment entity / table evolution
- 1000+ catalog expansion
- similarity optimization and caching
- embeddings
- confidence scoring

These items are deferred and are not blockers for Candidate Engine
development unless later evidence proves otherwise.

## Candidate Engine Entry Criteria

Sprint `13.1` Candidate Engine MAY:

- consume `ACTIVE` catalog exercises
- consume `compareExercisesV1()`
- apply deterministic eligibility rules

Sprint `13.1` Candidate Engine MUST NOT:

- modify similarity formulas
- modify similarity weights
- introduce workout context
- introduce user intent
- rank replacements
- mutate catalog data
- persist similarity scores

## Canonical References

- product rules:
  - `docs/product-rules.md`
- similarity technical contract:
  - `docs/exercise-similarity-contracts.md`
- governed gold dataset:
  - `backend/data/similarity/gold-standard-v1.json`
