# Context-Aware Replacement Decision

## Responsibility

Context-Aware Decision Policy V1 is the backend-internal layer that applies
runtime replacement context after Core Replacement Decision has already
selected and ordered non-blocked candidates.

It consumes:

- Core Replacement Decision output
- normalized Replacement Context V1
- candidate exercise facts required for contextual evaluation

It does not recompute:

- Similarity
- Candidate eligibility
- Ranking
- Workout Integrity
- Core Replacement Decision

## Core Versus Context

Core Decision remains the intrinsic recommendation owner.

Context-Aware Decision applies runtime feasibility policy on top of Core
output without changing upstream evidence domains.

This means:

- intrinsic eligibility remains intrinsic
- contextual rejection remains contextual
- equipment feasibility does not rewrite Candidate blocked rules
- contextual fallback preserves Core ordering

## Input Contract

```js
applyReplacementContextV1(coreDecision, replacementContext, candidateExercises)
```

Required inputs:

- valid `replacement-decision-v1` output
- valid normalized `replacement-context-v1`
- candidate exercise facts matching every Core recommendable candidate

Malformed or inconsistent evidence fails loudly.

## Output Contract

```js
{
  version: "context-aware-replacement-decision-v1",
  sourceExerciseId,
  coreDecisionStatus,
  contextualDecisionStatus,
  recommendedCandidate,
  alternatives,
  contextRejectedCandidates,
  coreRejectedCandidates,
  contextReasons,
  replacementContextEvidence,
  coreDecisionEvidence
}
```

The output preserves Core Decision evidence unchanged and adds contextual
equipment-feasibility evidence only.

## Contextual Statuses

- `RECOMMENDED`
- `RECOMMENDED_WITH_WARNING`
- `NO_CONTEXTUAL_REPLACEMENT`

Semantics:

- `RECOMMENDED`: selected contextual candidate is feasible and its Core
  integrity status is `PASS`
- `RECOMMENDED_WITH_WARNING`: selected contextual candidate is feasible and
  its Core integrity status is `WARN`
- `NO_CONTEXTUAL_REPLACEMENT`: no Core recommendable candidate remains valid
  under the provided context, or Core already returned `NO_SAFE_REPLACEMENT`

## Equipment Policy

For each Core recommendable candidate:

```js
evaluateExerciseEquipmentAvailability(candidateExercise, equipmentContext)
```

Policy:

- `AVAILABLE`
  - candidate remains contextually eligible
- `UNAVAILABLE`
  - candidate is contextually rejected
- `METADATA_UNAVAILABLE`
  - candidate is not automatically rejected
  - unresolved metadata remains explicit uncertainty
- `CONTEXT_UNKNOWN`
  - candidate is not rejected
  - Core behavior is preserved

Unknown context never becomes a hidden negative constraint.

## Intent V1 Policy

Intent behavior in V1 is deliberately narrow.

- `UNKNOWN`
  - no behavior change
- `PREFER_VARIATION`
  - no additional filtering in V1
- `EXERCISE_UNAVAILABLE`
  - no additional filtering by itself
- `NO_EQUIPMENT`
  - equipment context is evaluated when provided
  - unavailable candidates are contextually rejected
  - unknown context remains unknown
- `EQUIPMENT_BUSY`
  - current context cannot represent temporary per-item busy state
  - no fabricated busy-state logic is added in V1
- `DISCOMFORT`
  - no medical filtering
  - no automatic blocking
  - no injury inference

Intent does not override deterministic equipment feasibility.

## Unknown And Metadata Semantics

- `equipmentContext: null`
  - preserves Core behavior
- `replacementIntent: null`
  - preserves Core behavior
- explicit `replacementIntent.type = "UNKNOWN"`
  - intent object exists, but still preserves Core behavior
- equipment metadata unavailable
  - remains explicit uncertainty
  - does not auto-reject

## Contextual Rejection Versus Intrinsic Eligibility

Contextual rejection is a separate evidence domain.

Context-rejected candidates preserve:

- intrinsic eligibility evidence
- similarity evidence
- ranking evidence
- integrity evidence
- equipment availability evidence

This keeps contextual feasibility from rewriting intrinsic engine results.

## Traceability

The contextual recommendation preserves:

- replacement intent
- equipment availability result
- Core Decision evidence
- Candidate eligibility evidence
- Similarity evidence
- Ranking evidence
- Workout Integrity evidence

No upstream evidence is dropped.

## Reason Codes

V1 uses machine-readable reason codes only:

- `CONTEXT_DECISION_CORE_PRESERVED`
- `CONTEXT_DECISION_EQUIPMENT_AVAILABLE`
- `CONTEXT_DECISION_EQUIPMENT_UNAVAILABLE`
- `CONTEXT_DECISION_EQUIPMENT_CONTEXT_UNKNOWN`
- `CONTEXT_DECISION_EQUIPMENT_METADATA_UNAVAILABLE`
- `CONTEXT_DECISION_INTENT_PRESERVED`
- `CONTEXT_DECISION_NO_CONTEXTUAL_REPLACEMENT`

## Deferred Capability

`EQUIPMENT_BUSY` is explicit intent in V1, but temporary busy-equipment logic
is deferred because current context contains only `availableEquipment`.

Future extension may add richer contextual capability, but V1 must not invent
facts that are not represented in the contract.
