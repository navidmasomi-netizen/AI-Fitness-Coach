# Replacement Decision Contracts V1

This document freezes the backend-internal contract boundary and the first
production semantics for Replacement Decision V1.

## Responsibility

Replacement Decision consumes already-computed downstream evidence and
selects the final recommended replacement candidate.

It consumes:
- `sourceExerciseId`
- Workout Integrity evaluations that already preserve Ranking, Candidate,
  and Similarity evidence

It produces:
- a deterministic decision status
- one recommended candidate or `null`
- preserved alternatives
- preserved rejected candidates
- machine-readable decision reasons

## Non-Goals

Replacement Decision V1 does not:
- recompute Candidate eligibility
- recompute Similarity
- recompute Ranking
- recompute Workout Integrity
- introduce a new combined score
- query the database
- use user context
- use workout intent
- persist replacement decisions
- expose API responses

## Input Contract

Replacement Decision accepts:
- `sourceExerciseId`
- `integrityEvaluations`

Each integrity evaluation must already include:
- `exerciseId`
- `integrityStatus`
- `integrityScore`
- `integrityBreakdown`
- `integrityReasons`
- `rankingEvidence`
- `resultingWorkoutSummary`

`rankingEvidence` must already include:
- `rankingStatus`
- `rankingScore`
- `rank`
- `rankingBreakdown`
- `rankingReasons`
- `eligibilityEvidence`
- `similarityEvidence`

The engine fails loudly if:
- source identity is malformed
- candidate evidence is malformed
- eligibility evidence is missing or not eligible
- ranked order is not preserved exactly
- duplicate candidate identities appear

## Decision Statuses

Replacement Decision V1 uses exactly:
- `RECOMMENDED`
- `RECOMMENDED_WITH_WARNING`
- `NO_SAFE_REPLACEMENT`

Semantics:
- `RECOMMENDED`
  - selected candidate has integrity `PASS`
- `RECOMMENDED_WITH_WARNING`
  - selected candidate has integrity `WARN`
- `NO_SAFE_REPLACEMENT`
  - no non-`BLOCK` candidate remains

## Selection Policy V1

Decision V1 preserves Ranking authority.

Selection order:
1. exclude `BLOCK` candidates from recommendation eligibility
2. preserve incoming ranking order exactly
3. select the first remaining candidate

V1 does not:
- rerank candidates
- combine ranking and integrity into a new score
- penalize `WARN` with a hidden ranking adjustment

## PASS / WARN / BLOCK Interaction

`PASS`
- acceptable for recommendation
- produces `RECOMMENDED`

`WARN`
- acceptable for recommendation
- produces `RECOMMENDED_WITH_WARNING`
- does not lose to a lower-ranked `PASS` candidate automatically

`BLOCK`
- not recommendable
- remains visible in `rejectedCandidates`
- may trigger `NO_SAFE_REPLACEMENT` if all candidates block

## Output Contract

Replacement Decision returns:
- `version`
- `sourceExerciseId`
- `decisionStatus`
- `recommendedCandidate`
- `alternatives`
- `rejectedCandidates`
- `decisionReasons`

`recommendedCandidate` preserves:
- `exerciseId`
- `rankingScore`
- `rank`
- `integrityStatus`
- `integrityScore`
- `similarityEvidence`
- `eligibilityEvidence`
- `rankingEvidence`
- `integrityEvidence`

`alternatives`
- contains remaining non-blocked candidates after the recommendation
- preserves incoming ranking order
- is not truncated in V1

`rejectedCandidates`
- contains blocked candidates only
- preserves incoming ranking order
- preserves ranking, eligibility, similarity, and integrity evidence

## Decision Reasons

Decision reasons are machine-readable only.

V1 reason codes:
- `REPLACEMENT_DECISION_TOP_RANKED_PASS`
- `REPLACEMENT_DECISION_TOP_RANKED_WARN`
- `REPLACEMENT_DECISION_BLOCKED_BY_INTEGRITY`
- `REPLACEMENT_DECISION_NO_SAFE_REPLACEMENT`

No user-facing prose is generated here.

## Traceability

The final recommendation must preserve:
- Candidate eligibility evidence
- Similarity evidence
- Ranking evidence
- Workout Integrity evidence

No upstream evidence is discarded from the selected recommendation.

## Ordering

Replacement Decision must preserve upstream rank order exactly.

It does not:
- sort again
- create a combined score
- use similarity as a tie-break
- promote lower-ranked `PASS` over higher-ranked `WARN` in V1

If incoming evaluations are not already in valid rank order:
- the engine fails loudly
- it does not silently repair or reorder

## Future Extension Points

Future policy versions may later decide:
- whether `WARN` should be penalized relative to `PASS`
- whether alternatives should be truncated
- how to combine ranking and integrity under explicit policy

Those changes are out of scope for V1.
