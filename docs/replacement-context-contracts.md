# Replacement Context Contracts

## Responsibility

Replacement Context V1 is the canonical backend-internal container for
replacement-specific contextual input.

It owns context shape only. It does not evaluate equipment feasibility,
replacement ranking, workout integrity, or final recommendation decisions.

## V1 Shape

```js
{
  version: "replacement-context-v1",
  equipmentContext: {
    availableEquipment: ["barbell", "rack"]
  } | null,
  replacementIntent: {
    version: "replacement-intent-v1",
    type: "UNKNOWN"
  } | null
}
```

This is intentionally minimal.

## Unknown And Null Semantics

Optional context fields normalize to explicit `null` when unknown.

In V1:

- missing `equipmentContext` => `equipmentContext: null`
- explicit `equipmentContext: null` => still unknown, not unavailable
- missing `replacementIntent` => `replacementIntent: null`
- explicit `replacementIntent: null` => no intent object provided
- explicit `replacementIntent.type = "UNKNOWN"` => intent object exists, but
  the explicit reason is unknown

`null` does not mean:

- `false`
- disabled
- unavailable
- blocked

## Versioning

V1 requires explicit version:

- `replacement-context-v1`

Unsupported or missing versions fail loudly. Version is never inferred.

## Strictness

Replacement Context V1 is strict.

Unknown top-level fields fail loudly instead of being ignored. The same applies
to unknown nested `equipmentContext` fields.

This prevents silent hidden context semantics in the decision pipeline.

## Equipment Context Boundary

Replacement Context may carry:

```js
{
  equipmentContext: {
    availableEquipment: [...]
  }
}
```

Replacement Context owns only the normalized input container.

Equipment Availability continues to own:

- subset semantics
- bodyweight implicit handling
- contextual availability statuses
- availability reasons and evidence

V1 context normalization validates canonical `CatalogEquipment` values and
deduplicates them deterministically, but it does not evaluate feasibility.

## Replacement Intent Boundary

Replacement Context may now carry either:

- `replacementIntent: null`
- a validated `replacement-intent-v1` object

Replacement Context does not define intent semantics itself. Those are owned by
the dedicated Replacement Intent contract.

Replacement Context also does not infer intent from:

- equipment availability
- exercise facts
- similarity
- ranking
- integrity

## Locale Decision

`locale` is deferred.

Reason:

- locale is presentation and explainability context
- it is not a replacement decision fact in V1
- adding it now would blur decision input with UI concerns

## Feature Flags Decision

`featureFlags` is deferred.

Reason:

- feature flags are rollout and operational context
- no current consumer requires them
- they would create speculative contract surface area

## Future Extension Rules

Future additions to Replacement Context must:

- remain explicit and versioned
- preserve unknown vs negative semantics
- fail loudly on unsupported versions
- avoid silently redefining upstream decision engines
- keep intrinsic Exercise facts separate from runtime context
