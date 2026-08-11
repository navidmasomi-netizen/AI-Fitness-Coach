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

### Rule 44

- `id`: `RULE_044`
- `title`: `Workout Integrity Evaluates After Ranking`
- `statement`: Workout Integrity is evaluated after Ranking.
- `status`: `LOCKED`
- `owning domain`: `Replacement Engine`
- `rationale`: Integrity depends on hypothetical workout outcomes and must consume already-ranked candidate outputs rather than redefining upstream scoring.
- `affected future engines`: `Workout Integrity Engine`, `Replacement Decision Engine`

### Rule 45

- `id`: `RULE_045`
- `title`: `Workout Integrity Cannot Redefine Upstream Semantics`
- `statement`: Workout Integrity may reject or penalize a ranked candidate, but cannot redefine Candidate eligibility or Similarity semantics.
- `status`: `LOCKED`
- `owning domain`: `Replacement Engine`
- `rationale`: Candidate eligibility, Similarity, Ranking, and Workout Integrity are separate layers with separate responsibilities.
- `affected future engines`: `Workout Integrity Engine`, `Replacement Decision Engine`

### Rule 46

- `id`: `RULE_046`
- `title`: `Exact Workout Duplicates Block By Default`
- `statement`: Exact duplicate exercises inside one workout are blocked by default unless a future explicit policy allows them.
- `status`: `LOCKED`
- `owning domain`: `Workout Integrity`
- `rationale`: Duplicate exercise rows in a single workout are a deterministic structural conflict that should not pass silently.
- `affected future engines`: `Workout Integrity Engine`, `Replacement Decision Engine`

### Rule 47

- `id`: `RULE_047`
- `title`: `Workout Integrity Evaluates The Resulting Workout`
- `statement`: Workout Integrity evaluates the resulting workout after hypothetical replacement, not the source/candidate pair in isolation.
- `status`: `LOCKED`
- `owning domain`: `Workout Integrity`
- `rationale`: Workout-level constraints require seeing the candidate in the full workout context rather than only as a pairwise substitution.
- `affected future engines`: `Workout Integrity Engine`, `Replacement Decision Engine`

### Rule 48

- `id`: `RULE_048`
- `title`: `Decision Consumes Upstream Evidence`
- `statement`: Decision consumes upstream evidence; it does not recompute upstream engines.
- `status`: `LOCKED`
- `owning domain`: `Replacement Decision`
- `rationale`: The final decision layer must orchestrate upstream outputs, not become a second Similarity, Candidate, Ranking, or Integrity engine.
- `affected future engines`: `Replacement Decision Engine`

### Rule 49

- `id`: `RULE_049`
- `title`: `Integrity Block Prevents Recommendation`
- `statement`: Integrity BLOCK always prevents recommendation.
- `status`: `LOCKED`
- `owning domain`: `Replacement Decision`
- `rationale`: Structural workout conflicts must remain hard stops in the final recommendation layer.
- `affected future engines`: `Replacement Decision Engine`

### Rule 50

- `id`: `RULE_050`
- `title`: `Integrity Warn Remains Explicit`
- `statement`: Integrity WARN may still allow recommendation, but warning must remain explicit in the final decision.
- `status`: `LOCKED`
- `owning domain`: `Replacement Decision`
- `rationale`: Warning-level integrity issues should not be hidden or silently converted into a ranking penalty in V1.
- `affected future engines`: `Replacement Decision Engine`

### Rule 51

- `id`: `RULE_051`
- `title`: `Decision Selects Only Eligible Ranked Candidates`
- `statement`: Decision Engine selects only from candidates already eligible and ranked.
- `status`: `LOCKED`
- `owning domain`: `Replacement Decision`
- `rationale`: Final recommendation must stay downstream of Candidate and Ranking, preserving upstream authority and traceability.
- `affected future engines`: `Replacement Decision Engine`

### Rule 52

- `id`: `RULE_052`
- `title`: `Final Decision Preserves Traceability`
- `statement`: Final decision must preserve traceability to Candidate, Ranking, Similarity, and Integrity evidence.
- `status`: `LOCKED`
- `owning domain`: `Replacement Decision`
- `rationale`: Replacement recommendation quality must remain auditable end to end across all upstream evidence layers.
- `affected future engines`: `Replacement Decision Engine`

### Rule 53

- `id`: `RULE_053`
- `title`: `Equipment Similarity Is Not Equipment Availability`
- `statement`: Equipment similarity is not equipment availability.
- `status`: `LOCKED`
- `owning domain`: `Replacement Context`
- `rationale`: Similarity compares exercise facts, while availability depends on explicit runtime context.
- `affected future engines`: `Replacement Context`, `Replacement Decision Engine`

### Rule 54

- `id`: `RULE_054`
- `title`: `Required Equipment Is Fully Required`
- `statement`: All values in `Exercise.requiredEquipment` represent required physical requirements; every required item must be available for the exercise to be equipment-feasible.
- `status`: `LOCKED`
- `owning domain`: `Replacement Context`
- `rationale`: Equipment feasibility must respect authored physical setup requirements exactly rather than treating the list as advisory.
- `affected future engines`: `Replacement Context`, `Replacement Decision Engine`

### Rule 55

- `id`: `RULE_055`
- `title`: `Equipment Availability Is Contextual`
- `statement`: Equipment availability is contextual and must never be persisted as an intrinsic Exercise fact.
- `status`: `LOCKED`
- `owning domain`: `Replacement Context`
- `rationale`: Exercise metadata and runtime equipment context are separate sources of truth with different ownership.
- `affected future engines`: `Replacement Context`, `Replacement Decision Engine`

### Rule 56

- `id`: `RULE_056`
- `title`: `Missing Equipment Context Is Not Unavailability`
- `statement`: Missing equipment-context information must not be interpreted as equipment being unavailable.
- `status`: `LOCKED`
- `owning domain`: `Replacement Context`
- `rationale`: Unknown context must remain explicit instead of being converted into a hidden negative feasibility decision.
- `affected future engines`: `Replacement Context`, `Replacement Decision Engine`

### Rule 57

- `id`: `RULE_057`
- `title`: `Replacement Context Is Contextual`
- `statement`: Replacement Context is contextual input, not intrinsic Exercise data.
- `status`: `LOCKED`
- `owning domain`: `Replacement Context`
- `rationale`: Runtime decision context must remain separate from canonical Exercise facts and similarity inputs.
- `affected future engines`: `Replacement Context`, `Replacement Decision Engine`

### Rule 58

- `id`: `RULE_058`
- `title`: `Replacement Context Is Explicit Versioned And Immutable`
- `statement`: Replacement Context must be explicit, versioned, and immutable.
- `status`: `LOCKED`
- `owning domain`: `Replacement Context`
- `rationale`: Contextual decision inputs need a stable contract boundary that downstream layers can trust without hidden mutation.
- `affected future engines`: `Replacement Context`, `Replacement Decision Engine`

### Rule 59

- `id`: `RULE_059`
- `title`: `Unknown Context Remains Unknown`
- `statement`: Unknown context must remain unknown and must never be silently converted into a negative constraint.
- `status`: `LOCKED`
- `owning domain`: `Replacement Context`
- `rationale`: Missing context is not the same as negative context and must not create hidden blocking behavior.
- `affected future engines`: `Replacement Context`, `Replacement Decision Engine`

### Rule 60

- `id`: `RULE_060`
- `title`: `Decision Core Does Not Read Context Yet`
- `statement`: Replacement Decision Core must not read contextual data until an explicit context-aware policy layer is introduced.
- `status`: `LOCKED`
- `owning domain`: `Replacement Decision`
- `rationale`: Decision orchestration must stay aligned with current upstream engine semantics until context-aware policy is explicitly added.
- `affected future engines`: `Replacement Context`, `Replacement Decision Engine`

### Rule 61

- `id`: `RULE_061`
- `title`: `Replacement Intent Is Explicit`
- `statement`: Replacement Intent is explicit contextual input and must not be inferred from Exercise facts.
- `status`: `LOCKED`
- `owning domain`: `Replacement Context`
- `rationale`: Replacement reason is a user or runtime context fact, not an intrinsic exercise property.
- `affected future engines`: `Replacement Context`, `Replacement Decision Engine`

### Rule 62

- `id`: `RULE_062`
- `title`: `Replacement Intent Is Finite Versioned And Validated`
- `statement`: Replacement Intent values must be finite, versioned, machine-readable, and validated.
- `status`: `LOCKED`
- `owning domain`: `Replacement Context`
- `rationale`: Contextual policy inputs need a bounded stable contract rather than free-form text or hidden enums.
- `affected future engines`: `Replacement Context`, `Replacement Decision Engine`

### Rule 63

- `id`: `RULE_063`
- `title`: `Discomfort Is Not Medical Logic`
- `statement`: `DISCOMFORT` represents a user-reported replacement reason only. It is not injury diagnosis, medical classification, medical recommendation, or a contraindication engine.
- `status`: `LOCKED`
- `owning domain`: `Replacement Context`
- `rationale`: User discomfort reporting must remain separate from medical or safety inference until an explicit product policy exists.
- `affected future engines`: `Replacement Context`, `Replacement Decision Engine`

### Rule 64

- `id`: `RULE_064`
- `title`: `Unknown Intent Remains Unknown`
- `statement`: Unknown intent remains unknown and must not trigger hidden decision policy.
- `status`: `LOCKED`
- `owning domain`: `Replacement Context`
- `rationale`: Missing or explicitly unknown replacement reason must not silently become an implicit policy override.
- `affected future engines`: `Replacement Context`, `Replacement Decision Engine`

### Rule 65

- `id`: `RULE_065`
- `title`: `Context Policy Consumes Core Decision Evidence`
- `statement`: Context-aware policy consumes Core Decision output. It does not recompute Similarity, Candidate, Ranking, Workout Integrity, or Core Replacement Decision.
- `status`: `LOCKED`
- `owning domain`: `Replacement Context`
- `rationale`: Contextual policy must stay downstream of the intrinsic engine stack and preserve ownership boundaries.
- `affected future engines`: `Replacement Context`, `Replacement Decision Engine`

### Rule 66

- `id`: `RULE_066`
- `title`: `Equipment Unavailability Is Contextual`
- `statement`: Equipment unavailability may contextually disqualify a recommendation without changing intrinsic Candidate eligibility.
- `status`: `LOCKED`
- `owning domain`: `Replacement Context`
- `rationale`: Runtime equipment feasibility is a contextual execution constraint, not an intrinsic exercise similarity or eligibility fact.
- `affected future engines`: `Replacement Context`, `Replacement Decision Engine`

### Rule 67

- `id`: `RULE_067`
- `title`: `Intent Requires Explicit Policy Rules`
- `statement`: Replacement Intent may affect contextual decision behavior only through explicit intent-specific rules.
- `status`: `LOCKED`
- `owning domain`: `Replacement Context`
- `rationale`: Intent should never create hidden policy effects without a declared rule contract.
- `affected future engines`: `Replacement Context`, `Replacement Decision Engine`

### Rule 68

- `id`: `RULE_068`
- `title`: `Discomfort Remains Non-Medical In Context Policy`
- `statement`: `DISCOMFORT` remains non-medical in Context-Aware Policy V1. It must not create injury diagnosis, contraindication logic, or medical recommendations.
- `status`: `LOCKED`
- `owning domain`: `Replacement Context`
- `rationale`: Contextual discomfort reporting is still not a medical inference engine.
- `affected future engines`: `Replacement Context`, `Replacement Decision Engine`

### Rule 69

- `id`: `RULE_069`
- `title`: `Unknown Context Preserves Core Behavior`
- `statement`: Unknown context preserves Core behavior and must not introduce hidden constraints.
- `status`: `LOCKED`
- `owning domain`: `Replacement Context`
- `rationale`: Missing context is not negative context and must not silently filter otherwise valid recommendations.
- `affected future engines`: `Replacement Context`, `Replacement Decision Engine`

### Rule 70

- `id`: `RULE_070`
- `title`: `Context Rejection Is Separate From Intrinsic Eligibility`
- `statement`: Contextual rejection and intrinsic Candidate eligibility are separate evidence domains.
- `status`: `LOCKED`
- `owning domain`: `Replacement Context`
- `rationale`: Downstream contextual feasibility must not rewrite upstream eligibility evidence.
- `affected future engines`: `Replacement Context`, `Replacement Decision Engine`

### Rule 71

- `id`: `RULE_071`
- `title`: `Replacement API Is Thin Orchestration`
- `statement`: Replacement API is a thin orchestration boundary, not a decision engine.
- `status`: `LOCKED`
- `owning domain`: `Replacement API`
- `rationale`: HTTP exposure must reuse domain engines rather than introducing parallel policy in controllers or serializers.
- `affected future engines`: `Replacement API`, `Replacement Apply`

### Rule 72

- `id`: `RULE_072`
- `title`: `API Serialization Preserves Domain Decisions`
- `statement`: API serialization must not modify, rescore, rerank, reinterpret, or discard domain decisions or evidence except where an intentionally documented public response projection is required.
- `status`: `LOCKED`
- `owning domain`: `Replacement API`
- `rationale`: Public transport concerns may project internal evidence, but they must not mutate domain outcomes.
- `affected future engines`: `Replacement API`, `Mobile`

### Rule 73

- `id`: `RULE_073`
- `title`: `Replacement Request Identifies Exact Workout Occurrence`
- `statement`: The request must identify the exact workout exercise occurrence being replaced. If the source exercise occurs more than once and the API cannot determine which occurrence is intended, it must fail loudly and must not guess.
- `status`: `LOCKED`
- `owning domain`: `Replacement API`
- `rationale`: Replacement evaluation is occurrence-scoped inside a workout and cannot safely infer intent from canonical Exercise identity alone.
- `affected future engines`: `Replacement API`, `Replacement Apply`

### Rule 74

- `id`: `RULE_074`
- `title`: `API Maps Errors Without Reinterpreting Policy`
- `statement`: The API may translate domain and application errors into HTTP semantics but must not reinterpret domain policy.
- `status`: `LOCKED`
- `owning domain`: `Replacement API`
- `rationale`: HTTP status mapping is transport behavior, not product policy.
- `affected future engines`: `Replacement API`

### Rule 75

- `id`: `RULE_075`
- `title`: `API Preserves Final Traceability`
- `statement`: Replacement API V1 must preserve deterministic end-to-end traceability for the final recommendation.
- `status`: `LOCKED`
- `owning domain`: `Replacement API`
- `rationale`: Mobile and future apply flows need stable machine-readable recommendation evidence without rerunning hidden backend logic.
- `affected future engines`: `Replacement API`, `Mobile`, `Replacement Apply`

### Rule 76

- `id`: `RULE_076`
- `title`: `Recommendation And Mutation Remain Separate`
- `statement`: Recommendation and mutation are separate operations. A recommendation flow must never implicitly modify workout state.
- `status`: `LOCKED`
- `owning domain`: `Mobile Replacement Discovery`
- `rationale`: Discovery is read-only product behavior and must not silently replace exercises or persist workout edits.
- `affected future engines`: `Mobile`, `Replacement Apply`

### Rule 77

- `id`: `RULE_077`
- `title`: `Mobile Consumes Replacement API As Authoritative`
- `statement`: Mobile consumes Replacement API output as authoritative and must not duplicate Similarity, Candidate eligibility, Ranking, Workout Integrity, or replacement-selection logic.
- `status`: `LOCKED`
- `owning domain`: `Mobile Replacement Discovery`
- `rationale`: The replacement pipeline already exists in backend domain services; mobile should render outcomes, not fork policy.
- `affected future engines`: `Mobile`

### Rule 78

- `id`: `RULE_078`
- `title`: `Ranking Score Is Not User Confidence`
- `statement`: Ranking score is a ranking signal, not a probability, percentage, or confidence measure.
- `status`: `LOCKED`
- `owning domain`: `Mobile Replacement Discovery`
- `rationale`: Exposing ranking scores as confidence would misrepresent the domain contract and mislead users.
- `affected future engines`: `Mobile`

### Rule 79

- `id`: `RULE_079`
- `title`: `Warnings And No-Replacement Are First-Class States`
- `statement`: Warning and no-replacement states are first-class product states and must not be collapsed into generic API errors.
- `status`: `LOCKED`
- `owning domain`: `Mobile Replacement Discovery`
- `rationale`: A valid evaluation can legitimately return a warning or no replacement; the UI must preserve those distinctions.
- `affected future engines`: `Mobile`

### Rule 80

- `id`: `RULE_080`
- `title`: `Discovery Selection Does Not Mutate Workout`
- `statement`: Selecting a candidate in Discovery V1 does not mutate workout or session state.
- `status`: `LOCKED`
- `owning domain`: `Mobile Replacement Discovery`
- `rationale`: Candidate selection in discovery is only ephemeral preparation for a future apply flow.
- `affected future engines`: `Mobile`, `Replacement Apply`

### Rule 81

- `id`: `RULE_081`
- `title`: `Apply Never Recomputes Recommendations`
- `statement`: Apply Replacement must never recompute recommendations.
- `status`: `LOCKED`
- `owning domain`: `Replacement Apply`
- `rationale`: Recommendation generation is complete before Apply; mutation must consume explicit user selection only.
- `affected future engines`: `Replacement Apply`

### Rule 82

- `id`: `RULE_082`
- `title`: `Apply Uses Explicit User Selection`
- `statement`: Apply operates only on the candidate selected by the user.
- `status`: `LOCKED`
- `owning domain`: `Replacement Apply`
- `rationale`: Mutation authority comes from explicit user choice, not hidden backend re-selection.
- `affected future engines`: `Replacement Apply`, `Mobile`

### Rule 83

- `id`: `RULE_083`
- `title`: `Apply Is Fully Transactional`
- `statement`: Replacement must be fully transactional.
- `status`: `LOCKED`
- `owning domain`: `Replacement Apply`
- `rationale`: Workout mutation cannot leave target, logs, and audit evidence in a partial state.
- `affected future engines`: `Replacement Apply`

### Rule 84

- `id`: `RULE_084`
- `title`: `Apply Permanently Mutates Workout Session State`
- `statement`: Successful Apply permanently mutates workout session state.
- `status`: `LOCKED`
- `owning domain`: `Replacement Apply`
- `rationale`: Apply is the first replacement write boundary and must persist the selected change.
- `affected future engines`: `Replacement Apply`, `Mobile`

### Rule 85

- `id`: `RULE_085`
- `title`: `Every Replacement Is Auditable`
- `statement`: Every replacement must be fully auditable.
- `status`: `LOCKED`
- `owning domain`: `Replacement Apply`
- `rationale`: Replacement mutation requires durable traceability for support, debugging, and future workflow evolution.
- `affected future engines`: `Replacement Apply`

### Rule 86

- `id`: `RULE_086`
- `title`: `No Optimization Without Measurement`
- `statement`: No performance optimization may be introduced without explicit measurement first.
- `status`: `LOCKED`
- `owning domain`: `Replacement Performance`
- `rationale`: Performance work must be evidence-driven rather than speculative.
- `affected future engines`: `Replacement Recommendation`, `Replacement Apply`, `Mobile`

### Rule 87

- `id`: `RULE_087`
- `title`: `Performance Changes Preserve Replacement Semantics`
- `statement`: Performance changes must preserve replacement semantics exactly.
- `status`: `LOCKED`
- `owning domain`: `Replacement Performance`
- `rationale`: Performance hardening cannot change candidate, ranking, integrity, decision, or apply behavior.
- `affected future engines`: `Replacement Recommendation`, `Replacement Apply`, `Mobile`

### Rule 88

- `id`: `RULE_088`
- `title`: `Performance Optimization Cannot Weaken Safety Guarantees`
- `statement`: Query-count optimization must not weaken transaction, authorization, ownership, or concurrency guarantees.
- `status`: `LOCKED`
- `owning domain`: `Replacement Performance`
- `rationale`: Safety and correctness constraints take priority over saving queries.
- `affected future engines`: `Replacement Recommendation`, `Replacement Apply`

### Rule 89

- `id`: `RULE_089`
- `title`: `Network Optimization Cannot Create Stale Authority`
- `statement`: Cache and network optimization must not introduce stale authoritative replacement or workout state.
- `status`: `LOCKED`
- `owning domain`: `Replacement Performance`
- `rationale`: Fewer requests are only acceptable when the client already holds the authoritative backend state it needs.
- `affected future engines`: `Mobile`, `Replacement Apply`

### Rule 90

- `id`: `RULE_090`
- `title`: `Performance Budgets Must Be Explicit`
- `statement`: Performance budgets and measurements must be explicit and reproducible.
- `status`: `LOCKED`
- `owning domain`: `Replacement Performance`
- `rationale`: Regression detection requires stable, documented budgets rather than informal expectations.
- `affected future engines`: `Replacement Recommendation`, `Replacement Apply`, `Mobile`
