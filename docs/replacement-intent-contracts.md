# Replacement Intent Contracts

## Responsibility

Replacement Intent V1 answers one contextual question:

- Why did the user request an exercise replacement?

It is explicit contextual input only. It does not change Candidate, Ranking,
Workout Integrity, Replacement Decision, or Equipment Availability behavior in
this sprint.

## V1 Intent Values

- `UNKNOWN`
- `NO_EQUIPMENT`
- `EQUIPMENT_BUSY`
- `EXERCISE_UNAVAILABLE`
- `PREFER_VARIATION`
- `DISCOMFORT`

The set is finite, machine-readable, and versioned.

## V1 Shape

```js
{
  version: "replacement-intent-v1",
  type: "PREFER_VARIATION"
}
```

No free-text field, prose field, or diagnosis field exists in V1.

## Exact Semantics

`UNKNOWN`

- an intent object exists, but no explicit replacement reason is known

`NO_EQUIPMENT`

- one or more required equipment items are not available in the current context

`EQUIPMENT_BUSY`

- required equipment may exist, but is temporarily unavailable for use

`EXERCISE_UNAVAILABLE`

- the source exercise cannot be performed in the current session for a
  non-equipment reason
- V1 does not infer why

`PREFER_VARIATION`

- the user explicitly wants a different exercise or variation

`DISCOMFORT`

- the user reports that performing the source exercise feels uncomfortable
- V1 stores the reported reason only

## Null vs UNKNOWN

These remain distinct:

- `replacementIntent: null`
  - no intent object was provided

- `{ version: "replacement-intent-v1", type: "UNKNOWN" }`
  - an explicit intent object exists and the known reason is `UNKNOWN`

V1 does not silently collapse these states.

## Validation

Replacement Intent V1 is strict.

It rejects:

- unsupported versions
- unsupported intent values
- unknown top-level fields
- arbitrary free-text strings

## DISCOMFORT Medical Boundary

`DISCOMFORT` is not:

- injury diagnosis
- medical classification
- medical recommendation
- contraindication logic

This contract stores validated context only. No automatic safety or medical
policy is introduced here.

## No Automatic Inference

Replacement Intent is explicit contextual input.

V1 does not infer `NO_EQUIPMENT` from `equipmentContext`, and it does not infer
any other intent from Exercise facts, availability results, or downstream
engines.

## Future Policy Boundary

Future context-aware policy may consume Replacement Intent to influence:

- candidate filtering
- ranking
- integrity interpretation
- final recommendation policy

That policy integration is deferred beyond this sprint.
