# Mobile Replacement Discovery V1

## Responsibility

Mobile Replacement Discovery V1 exposes the existing backend Replacement API inside the active workout session UI. It is a read-only recommendation flow:

- start discovery from a specific workout exercise target
- collect minimal replacement context
- request backend recommendations
- render recommended replacement, alternatives, warnings, and no-replacement outcomes

It does not apply the replacement.

## Entry Point

The flow starts from the active workout session screen on each exercise card:

- `Replace`

The request uses:

- `sessionId`
- exact `targetId` (`WorkoutSessionExerciseTarget.id`)

If a target id is not available in the current mobile session view, discovery is disabled for that exercise and the workout remains unchanged.

## Discovery State Model

The mobile state model is explicit:

- `IDLE`
- `COLLECTING_CONTEXT`
- `LOADING_RECOMMENDATIONS`
- `RESULTS`
- `NO_REPLACEMENT`
- `ERROR`

`NO_REPLACEMENT` is a successful product outcome, not a transport error.

## Request Mapping

Mobile sends the canonical backend context contract:

```json
{
  "context": {
    "version": "replacement-context-v1",
    "equipmentContext": {
      "availableEquipment": ["dumbbell", "bench"]
    },
    "replacementIntent": {
      "version": "replacement-intent-v1",
      "type": "NO_EQUIPMENT"
    }
  }
}
```

## Intent UX Mapping

The V1 reason picker maps directly to backend intent values:

- `I want a different exercise` -> `PREFER_VARIATION`
- `I don't have the equipment` -> `NO_EQUIPMENT`
- `Equipment is busy` -> `EQUIPMENT_BUSY`
- `I can't do this exercise right now` -> `EXERCISE_UNAVAILABLE`
- `This exercise feels uncomfortable` -> `DISCOMFORT`
- `Skip reason` -> explicit `UNKNOWN`

`DISCOMFORT` is rendered as a non-medical user reason only.

## Equipment Context Decision

Mobile does not invent persistent user equipment preferences in V1.

Current decision:

- only `NO_EQUIPMENT` collects explicit session-local canonical equipment input
- all other reasons send `equipmentContext: null`
- `EQUIPMENT_BUSY` remains policy-neutral because the current context contract cannot express temporary per-item busy state

`bodyweight` is not collected because backend equipment availability already treats it implicitly.

## Result States

The public API response is rendered as:

- recommended replacement
- alternatives
- contextual rejection summary when useful
- warning state for `RECOMMENDED_WITH_WARNING`
- empty state for `NO_CONTEXTUAL_REPLACEMENT`

Mobile consumes only the public Replacement API projection. It does not depend on hidden backend comparator or breakdown fields.

## Warning, No-Replacement, And Error Behavior

- `RECOMMENDED_WITH_WARNING` shows a non-alarmist training-structure warning
- `NO_CONTEXTUAL_REPLACEMENT` shows a first-class empty state
- transport/auth/server failures stay in the `ERROR` state and are not rewritten as replacement outcomes

## Ranking Score

Mobile does not render `rankingScore` numerically in V1.

Reason:

- users could misread it as confidence or percentage
- ranking order is sufficient for V1 discovery

## No-Mutation Guarantee

Discovery V1 is read-only:

- no workout exercise is replaced
- no session state is mutated
- no program state is changed
- no recommendation is persisted

Selecting a recommendation or alternative is local ephemeral UI state only.

## Internal/External Boundary

Mobile calls:

- `POST /api/sessions/:sessionId/exercise-targets/:targetId/replacements`

Backend remains authoritative for:

- Candidate eligibility
- Ranking
- Workout Integrity
- Core Decision
- Context-aware Decision

## Known V1 Limitation

Replacement discovery requires exact workout exercise target ids. Newly started sessions provide those ids to mobile, but resumed session views can only support discovery if those target ids are still available in local session cache. Mobile does not guess from canonical `Exercise.id`.

## Future Boundary

Applying a selected replacement is a future operation. Discovery V1 intentionally stops at recommendation display and ephemeral candidate selection.
