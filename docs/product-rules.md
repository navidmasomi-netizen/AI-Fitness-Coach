# Product Rule Registry

This document is the canonical registry for locked product rules governing
Exercise Intelligence Foundation V1.

## Rules

### Rule 1

- `id`: `RULE_001`
- `title`: `Ranked Replacement Score`
- `statement`: Replacement selection will eventually use a ranked score rather than an unordered substitute list.
- `status`: `LOCKED`
- `owning domain`: `Replacement Engine`
- `rationale`: Replacement decisions need deterministic ordering once candidate eligibility and ranking exist.
- `affected future engines`: `Candidate Engine`, `Replacement Engine`

### Rule 2

- `id`: `RULE_002`
- `title`: `Intent-Based Replacement`
- `statement`: Replacement behavior must eventually account for explicit replacement intent rather than treating all swaps as equivalent.
- `status`: `LOCKED`
- `owning domain`: `Replacement Engine`
- `rationale`: User- or system-driven replacement scenarios are directional and policy-aware.
- `affected future engines`: `Replacement Engine`, `Workout Integrity`

### Rule 3

- `id`: `RULE_003`
- `title`: `Exercise DNA`
- `statement`: Exercise Intelligence must extend canonical Exercise facts through passive Exercise DNA rather than a parallel truth source.
- `status`: `LOCKED`
- `owning domain`: `Exercise Catalog`
- `rationale`: Canonical exercise semantics must live on the Exercise domain root.
- `affected future engines`: `Candidate Engine`, `Replacement Engine`, `Workout Integrity`

### Rule 4

- `id`: `RULE_004`
- `title`: `Workout Role Preservation`
- `statement`: Future replacement flows must preserve the intended workout role of the original exercise.
- `status`: `LOCKED`
- `owning domain`: `Workout Integrity`
- `rationale`: Semantic similarity alone is insufficient to keep a workout structurally coherent.
- `affected future engines`: `Replacement Engine`, `Workout Integrity`

### Rule 5

- `id`: `RULE_005`
- `title`: `Exercise Class First`
- `statement`: Exercise class semantics matter independently and must influence intelligence decisions before simple muscle-overlap heuristics.
- `status`: `LOCKED`
- `owning domain`: `Exercise Similarity`
- `rationale`: `compound` vs `isolation` is a first-class semantic fact, not a side effect of muscles or movement.
- `affected future engines`: `Candidate Engine`, `Replacement Engine`

### Rule 6

- `id`: `RULE_006`
- `title`: `Workout Integrity Protection`
- `statement`: Workout-context validation happens after similarity-driven candidate and ranking stages and may veto otherwise similar exercises.
- `status`: `LOCKED`
- `owning domain`: `Workout Integrity`
- `rationale`: Pairwise similarity is not enough to protect program structure or session balance.
- `affected future engines`: `Workout Integrity`

### Rule 7

- `id`: `RULE_007`
- `title`: `Canonical Exercise Definition`
- `statement`: Every Exercise must have one canonical authored definition; materially different variants require distinct exercise identities.
- `status`: `LOCKED`
- `owning domain`: `Exercise Catalog`
- `rationale`: Ambiguous generic definitions corrupt Exercise DNA, similarity, and future replacement logic.
- `affected future engines`: `Candidate Engine`, `Replacement Engine`, `Calibration / Governance`

### Rule 8

- `id`: `RULE_008`
- `title`: `Multi-Equipment Requirement`
- `statement`: Required equipment is a physical requirement set where every listed item is required.
- `status`: `LOCKED`
- `owning domain`: `Exercise Catalog`
- `rationale`: Similarity and future eligibility logic must work from truthful physical requirements, not simplified legacy equipment labels.
- `affected future engines`: `Candidate Engine`, `Replacement Engine`, `Workout Integrity`

### Rule 9

- `id`: `RULE_009`
- `title`: `Movement Pattern Independence`
- `statement`: Movement pattern must remain independent from characteristics such as unilateral or bilateral execution.
- `status`: `LOCKED`
- `owning domain`: `Exercise Catalog`
- `rationale`: Movement taxonomy should represent the primary action, not orthogonal variation traits.
- `affected future engines`: `Exercise Similarity`, `Candidate Engine`

### Rule 10

- `id`: `RULE_010`
- `title`: `Similarity Compares Facts`
- `statement`: Similarity compares Exercise facts, not user policy, workout policy, or contextual constraints.
- `status`: `LOCKED`
- `owning domain`: `Exercise Similarity`
- `rationale`: Similarity must remain a pure intrinsic signal that other systems can consume consistently.
- `affected future engines`: `Candidate Engine`, `Replacement Engine`

### Rule 11

- `id`: `RULE_011`
- `title`: `Similarity Is Not Replaceability`
- `statement`: Similarity output must not be treated as direct replacement eligibility or ranking.
- `status`: `LOCKED`
- `owning domain`: `Exercise Similarity`
- `rationale`: Replaceability is directional and policy-aware; similarity is not.
- `affected future engines`: `Candidate Engine`, `Replacement Engine`, `Workout Integrity`

### Rule 12

- `id`: `RULE_012`
- `title`: `Similarity Is Symmetric`
- `statement`: `compare(A, B)` must equal `compare(B, A)` for the same inputs and policy.
- `status`: `LOCKED`
- `owning domain`: `Exercise Similarity`
- `rationale`: Similarity is an undirected semantic relation.
- `affected future engines`: `Calibration / Governance`, `Candidate Engine`

### Rule 13

- `id`: `RULE_013`
- `title`: `Similarity Is Deterministic`
- `statement`: The same inputs and policy must always return the same similarity output.
- `status`: `LOCKED`
- `owning domain`: `Exercise Similarity`
- `rationale`: Downstream engines require reproducible deterministic signals.
- `affected future engines`: `Calibration / Governance`, `Candidate Engine`, `Replacement Engine`

### Rule 14

- `id`: `RULE_014`
- `title`: `Similarity Is User-Independent`
- `statement`: Similarity must not depend on user inventory, goals, fatigue, history, or session context.
- `status`: `LOCKED`
- `owning domain`: `Exercise Similarity`
- `rationale`: User policy belongs downstream.
- `affected future engines`: `Candidate Engine`, `Replacement Engine`

### Rule 15

- `id`: `RULE_015`
- `title`: `Similarity Operates On Exercises Only`
- `statement`: Similarity compares Exercise profiles only, not whole workouts or workout slots.
- `status`: `LOCKED`
- `owning domain`: `Exercise Similarity`
- `rationale`: Workout context belongs to later orchestration layers.
- `affected future engines`: `Candidate Engine`, `Workout Integrity`

### Rule 16

- `id`: `RULE_016`
- `title`: `Comparators Do Not Know Global Weights`
- `statement`: Individual comparators must never read global policy weights.
- `status`: `LOCKED`
- `owning domain`: `Exercise Similarity`
- `rationale`: Comparator semantics must remain isolated and replaceable.
- `affected future engines`: `Calibration / Governance`

### Rule 17

- `id`: `RULE_017`
- `title`: `Aggregator Owns Global Weighting`
- `statement`: Only the similarity aggregator applies global dimension weighting.
- `status`: `LOCKED`
- `owning domain`: `Exercise Similarity`
- `rationale`: Weighting is policy, not comparator semantics.
- `affected future engines`: `Calibration / Governance`, `Candidate Engine`

### Rule 18

- `id`: `RULE_018`
- `title`: `Comparators Are Independent`
- `statement`: Each comparator evaluates only its own factual dimension and must not inspect other dimensions.
- `status`: `LOCKED`
- `owning domain`: `Exercise Similarity`
- `rationale`: Independent dimensions support composability, testability, and future swaps.
- `affected future engines`: `Calibration / Governance`

### Rule 19

- `id`: `RULE_019`
- `title`: `Comparator Behavior Is Independently Tested`
- `statement`: Every comparator contract and behavior must have isolated unit coverage.
- `status`: `LOCKED`
- `owning domain`: `Exercise Similarity`
- `rationale`: Comparator regressions must be attributable and measurable without whole-engine noise.
- `affected future engines`: `Calibration / Governance`

### Rule 20

- `id`: `RULE_020`
- `title`: `Similarity Must Be Explainable`
- `statement`: Similarity output must preserve machine-readable reasons and evidence sufficient for later explanation.
- `status`: `LOCKED`
- `owning domain`: `Exercise Similarity`
- `rationale`: Downstream consumers must not rerun hidden logic to explain a score.
- `affected future engines`: `Replacement Engine`, `Workout Integrity`

### Rule 21

- `id`: `RULE_021`
- `title`: `Similarity Performs Zero DB Queries`
- `statement`: The Similarity Engine performs no database queries.
- `status`: `LOCKED`
- `owning domain`: `Exercise Similarity`
- `rationale`: Similarity must remain a pure stateless computation over supplied data.
- `affected future engines`: `Candidate Engine`

### Rule 22

- `id`: `RULE_022`
- `title`: `Similarity Is Stateless`
- `statement`: Similarity holds no mutable runtime state across calls.
- `status`: `LOCKED`
- `owning domain`: `Exercise Similarity`
- `rationale`: Stateless execution preserves determinism and testability.
- `affected future engines`: `Calibration / Governance`, `Candidate Engine`

### Rule 23

- `id`: `RULE_023`
- `title`: `Comparators Are Replaceable`
- `statement`: Comparator implementations may be replaced without redesigning the engine contract.
- `status`: `LOCKED`
- `owning domain`: `Exercise Similarity`
- `rationale`: Comparator semantics will evolve through validated evidence rather than architecture rewrites.
- `affected future engines`: `Calibration / Governance`

### Rule 24

- `id`: `RULE_024`
- `title`: `Unavailable Dimensions Have No Hidden Penalty`
- `statement`: Unavailable similarity dimensions are excluded from both numerator and denominator, remain visible in the breakdown, and never become hidden neutral scores.
- `status`: `LOCKED`
- `owning domain`: `Exercise Similarity`
- `rationale`: Missing metadata must be explicit and must not distort final similarity.
- `affected future engines`: `Calibration / Governance`, `Candidate Engine`

### Rule 25

- `id`: `RULE_025`
- `title`: `Similarity Scores Are Semantic Signals`
- `statement`: Similarity scores are semantic similarity signals, not probabilities, confidence scores, replacement eligibility, or recommendation quality.
- `status`: `LOCKED`
- `owning domain`: `Exercise Similarity`
- `rationale`: Downstream policy must not reinterpret raw similarity as product readiness.
- `affected future engines`: `Candidate Engine`, `Replacement Engine`

### Rule 26

- `id`: `RULE_026`
- `title`: `Policy Changes Require Gold Validation`
- `statement`: Similarity Policy changes only when justified by Gold Standard validation.
- `status`: `LOCKED`
- `owning domain`: `Calibration / Governance`
- `rationale`: Weight changes require evidence, not intuition.
- `affected future engines`: `Calibration / Governance`

### Rule 27

- `id`: `RULE_027`
- `title`: `Gold Dataset Is A Versioned Product Asset`
- `statement`: The Gold Dataset is a versioned product asset with explicit governance, not a disposable test fixture.
- `status`: `LOCKED`
- `owning domain`: `Calibration / Governance`
- `rationale`: Calibration data must be auditable, maintainable, and intentionally evolved.
- `affected future engines`: `Calibration / Governance`

### Rule 28

- `id`: `RULE_028`
- `title`: `Unresolved Catalog Exercises Cannot Be Calibration Anchors`
- `statement`: Exercises with unresolved canonical definitions must not act as active calibration anchors.
- `status`: `LOCKED`
- `owning domain`: `Calibration / Governance`
- `rationale`: Ambiguous catalog rows contaminate calibration signals and hide root-cause ownership.
- `affected future engines`: `Calibration / Governance`, `Candidate Engine`

### Rule 29

- `id`: `RULE_029`
- `title`: `Deterministic Candidate Eligibility`
- `statement`: Candidate eligibility is determined by deterministic product rules before ranking.
- `status`: `LOCKED`
- `owning domain`: `Candidate Engine`
- `rationale`: Ranking must not be responsible for discovering whether a candidate is even allowed into consideration.
- `affected future engines`: `Candidate Engine`, `Replacement Engine`

### Rule 30

- `id`: `RULE_030`
- `title`: `Similarity Alone Never Qualifies A Candidate`
- `statement`: Similarity score alone can never qualify an exercise as a replacement candidate.
- `status`: `LOCKED`
- `owning domain`: `Candidate Engine`
- `rationale`: An exercise may be similar in some dimensions while still violating deterministic product eligibility rules.
- `affected future engines`: `Candidate Engine`, `Replacement Engine`

### Rule 31

- `id`: `RULE_031`
- `title`: `Ranking Cannot Override Eligibility`
- `statement`: Ranking can only order eligible candidates and cannot override eligibility.
- `status`: `LOCKED`
- `owning domain`: `Replacement Engine`
- `rationale`: Ranking is downstream ordering logic, not a permission system.
- `affected future engines`: `Replacement Engine`

### Rule 32

- `id`: `RULE_032`
- `title`: `Eligibility Must Be Explainable`
- `statement`: Eligibility decisions must be explainable with explicit machine-readable rule outcomes.
- `status`: `LOCKED`
- `owning domain`: `Candidate Engine`
- `rationale`: Downstream systems and audits must understand why a candidate passed or failed without reverse-engineering hidden logic.
- `affected future engines`: `Candidate Engine`, `Replacement Engine`

### Rule 33

- `id`: `RULE_033`
- `title`: `Candidate V1 Preserves Exercise Class`
- `statement`: Candidate V1 preserves intrinsic exercise class, so `source.complexity` must equal `candidate.complexity`.
- `status`: `LOCKED`
- `owning domain`: `Candidate Engine`
- `rationale`: `compound` vs `isolation` is a first-class gate and must be preserved before ranking.
- `affected future engines`: `Candidate Engine`, `Replacement Engine`

### Rule 34

- `id`: `RULE_034`
- `title`: `Candidate V1 Preserves Exact Movement Pattern`
- `statement`: Candidate V1 requires exact `dnaMovementPattern` equality until an approved movement relationship policy exists.
- `status`: `LOCKED`
- `owning domain`: `Candidate Engine`
- `rationale`: Conservative exact-pattern gating prevents speculative movement-family substitutions before that policy is explicitly designed.
- `affected future engines`: `Candidate Engine`, `Replacement Engine`

### Rule 35

- `id`: `RULE_035`
- `title`: `Ranking Operates Only On Eligible Candidates`
- `statement`: Ranking operates only on candidates that have already been marked eligible by the Candidate Engine.
- `status`: `LOCKED`
- `owning domain`: `Replacement Engine`
- `rationale`: Ranking is downstream ordering logic and must not accept blocked or unresolved candidates.
- `affected future engines`: `Replacement Engine`

### Rule 36

- `id`: `RULE_036`
- `title`: `Ranking Is Directional And Context-Independent In V1`
- `statement`: Ranking V1 is directional from source exercise to eligible candidate, while remaining independent from user context and workout context.
- `status`: `LOCKED`
- `owning domain`: `Replacement Engine`
- `rationale`: Replacement ranking preserves the role of a specific source exercise without yet introducing user- or workout-specific policy.
- `affected future engines`: `Replacement Engine`, `Workout Integrity`

### Rule 37

- `id`: `RULE_037`
- `title`: `Ranking Explanations Are Separate From Eligibility Explanations`
- `statement`: Ranking explanations are independent from eligibility explanations and must be preserved separately in ranking output.
- `status`: `LOCKED`
- `owning domain`: `Replacement Engine`
- `rationale`: Downstream consumers need to distinguish why a candidate was allowed from why it was ordered.
- `affected future engines`: `Replacement Engine`

### Rule 38

- `id`: `RULE_038`
- `title`: `Ranking Cannot Override Eligibility`
- `statement`: Ranking cannot override candidate eligibility.
- `status`: `LOCKED`
- `owning domain`: `Replacement Engine`
- `rationale`: A high ranking score cannot promote a blocked candidate into consideration.
- `affected future engines`: `Replacement Engine`

### Rule 39

- `id`: `RULE_039`
- `title`: `Ranking Scores Preservation Not Eligibility`
- `statement`: Ranking V1 scores semantic preservation among already-eligible candidates and does not decide eligibility.
- `status`: `LOCKED`
- `owning domain`: `Replacement Engine`
- `rationale`: Eligibility is a deterministic gate owned by Candidate Engine; ranking is downstream ordering only.
- `affected future engines`: `Replacement Engine`

### Rule 40

- `id`: `RULE_040`
- `title`: `Ranking Must Not Duplicate Candidate Hard Gates`
- `statement`: Ranking dimensions must not duplicate Candidate hard gates such as exact movement-pattern preservation and exercise-class preservation.
- `status`: `LOCKED`
- `owning domain`: `Replacement Engine`
- `rationale`: Candidate and ranking layers must not double-count the same product fact.
- `affected future engines`: `Replacement Engine`

### Rule 41

- `id`: `RULE_041`
- `title`: `Ranking Missing Dimensions Are Renormalized`
- `statement`: Unavailable ranking dimensions are excluded from both numerator and denominator and remain visible in the ranking breakdown.
- `status`: `LOCKED`
- `owning domain`: `Replacement Engine`
- `rationale`: Missing ranking metadata must not create hidden penalty or reward.
- `affected future engines`: `Replacement Engine`

### Rule 42

- `id`: `RULE_042`
- `title`: `Ranking Scores Are Directional Preservation Signals`
- `statement`: Ranking scores are directional semantic-preservation signals, not probabilities.
- `status`: `LOCKED`
- `owning domain`: `Replacement Engine`
- `rationale`: Ranking preserves the role of a specific source exercise and must not be interpreted as statistical confidence.
- `affected future engines`: `Replacement Engine`

### Rule 43

- `id`: `RULE_043`
- `title`: `No Ranking Signal Double-Counting`
- `statement`: Replacement Ranking must not double-count factual signals already represented by other ranking dimensions. Similarity may be preserved as evidence without automatically contributing to ranking score.
- `status`: `LOCKED`
- `owning domain`: `Replacement Engine`
- `rationale`: Ranking should score directional preservation directly instead of re-weighting upstream semantic aggregates that already encode overlapping facts.
- `affected future engines`: `Replacement Engine`
