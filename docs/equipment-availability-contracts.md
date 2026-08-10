# Equipment Availability Contracts

## Responsibility

Equipment Availability V1 answers one contextual question:

- Is this exercise executable under the explicitly supplied equipment context?

It is a pure backend-internal contract. It does not rank replacements, decide
replacement eligibility, or mutate any upstream engine outputs.

## Non-Goals

Equipment Availability V1 does not:

- change Exercise Similarity semantics
- change Candidate eligibility semantics
- change Ranking formulas or policy
- change Workout Integrity semantics
- change Replacement Decision behavior
- infer equipment families or substitutions
- interpret ownership, goals, injuries, or workout context

## Canonical Vocabulary

The contract validates against canonical `CatalogEquipment` values owned by the
Exercise Catalog:

- `bodyweight`
- `dumbbell`
- `barbell`
- `bench`
- `rack`
- `cable`
- `selectorized_machine`
- `leg_press_machine`
- `pull_up_bar`
- `step_platform`

Unknown equipment values fail loudly.

## Input Contract

Exercise input requires:

- `exerciseId`
- `requiredEquipment`

Context input requires:

```js
{
  availableEquipment: ["barbell", "rack"]
}
```

If context is omitted or `availableEquipment` is not supplied, the result is
`CONTEXT_UNKNOWN`.

## Availability Semantics

Equipment availability uses exact subset semantics:

- exercise is `AVAILABLE` only when `requiredEquipment ⊆ availableEquipment`
- every required item must be present
- extra available equipment does not matter
- order does not matter
- duplicates are ignored

No equipment-family substitution exists in V1.

## Bodyweight Semantics

`bodyweight` is the only implicitly available equipment value in V1.

If the context is explicit, the evaluator normalizes the effective available
equipment set by adding `bodyweight` when it is not already present.

This implicit rule applies only to `bodyweight`. No other equipment receives
implicit substitution or default availability.

## Statuses

- `AVAILABLE`
- `UNAVAILABLE`
- `CONTEXT_UNKNOWN`
- `METADATA_UNAVAILABLE`

`UNAVAILABLE` means the context is known and at least one required item is
missing.

`CONTEXT_UNKNOWN` means the evaluator was not given an explicit equipment
context and therefore cannot determine availability.

`METADATA_UNAVAILABLE` means the exercise has unresolved `requiredEquipment`
metadata, including `[]`.

## Output Contract

```js
{
  exerciseId,
  status,
  requiredEquipment,
  availableEquipment,
  matchedEquipment,
  missingEquipment,
  reasons
}
```

`availableEquipment` is the effective evaluated set. When context is unknown or
metadata is unavailable, it is `null`.

## Reason Codes

- `EQUIPMENT_AVAILABILITY_ALL_REQUIREMENTS_MET`
- `EQUIPMENT_AVAILABILITY_REQUIRED_ITEM_MISSING`
- `EQUIPMENT_AVAILABILITY_CONTEXT_UNKNOWN`
- `EQUIPMENT_AVAILABILITY_METADATA_UNAVAILABLE`
- `EQUIPMENT_AVAILABILITY_BODYWEIGHT_IMPLICIT`

Reasons are machine-readable and may include structured data such as:

- missing required equipment
- matched equipment
- implicit `bodyweight` normalization

## Boundary With Similarity And Ranking

Equipment Availability is not Equipment Similarity.

- Similarity asks whether two exercises require similar equipment facts.
- Ranking asks how well a candidate preserves source setup.
- Availability asks whether one exercise is executable under one explicit
  context.

This contract is intentionally separate and is not yet integrated into
Replacement Decision V1.

## Future Integration Boundary

Future replacement-context work may consume this contract to:

- filter non-executable candidates
- annotate downstream recommendation warnings
- combine execution feasibility with ranking and integrity

That integration is deferred beyond this sprint.
