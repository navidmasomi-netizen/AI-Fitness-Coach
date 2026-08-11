# Replacement Recommendation API V1

## Responsibility

Replacement Recommendation API V1 is the authenticated backend boundary that
exposes the locked Replacement Intelligence pipeline without adding new
replacement logic.

It is responsible for:

- validating request shape
- resolving authenticated workout ownership
- loading the minimum session, target, catalog, and context facts required by
  the pipeline
- calling the existing production domain entry points in order
- projecting a controlled public response
- mapping known application and domain failures to HTTP semantics

It is not responsible for:

- changing Candidate, Ranking, Integrity, Decision, or Context policy
- applying the replacement
- mutating the workout or program
- persisting recommendations or scores

## Endpoint

```http
POST /api/sessions/:sessionId/exercise-targets/:targetId/replacements
```

This matches current repository identity conventions:

- workout container identity is `WorkoutSession.id`
- exact workout exercise occurrence identity is
  `WorkoutSessionExerciseTarget.id`

`Exercise.id` alone is not sufficient because one workout can contain more
than one target row.

## Authentication And Ownership

- route uses the existing `requireAuth` middleware
- authenticated identity comes from `req.userId`
- session ownership follows current workout-session convention
- if the session does not exist or does not belong to the authenticated user,
  the API returns `404`

The endpoint never trusts client-supplied user identity.

## Request Body

Only contextual replacement input is accepted.

```json
{
  "context": {
    "version": "replacement-context-v1",
    "equipmentContext": {
      "availableEquipment": ["dumbbell", "bench"]
    },
    "replacementIntent": {
      "version": "replacement-intent-v1",
      "type": "PREFER_VARIATION"
    }
  }
}
```

Rules:

- body must be a plain object
- only top-level field allowed is `context`
- server owns all exercise facts, candidate evidence, scores, and policies
- client may not provide:
  - candidate ids
  - ranking weights
  - similarity weights
  - eligibility
  - ranking scores
  - integrity scores
  - exercise DNA

## Internal Orchestration Pipeline

Replacement API V1 uses the locked production entry points in this order:

1. `buildReplacementContextV1(rawContext)`
2. load session + exact source target + current workout targets
3. load active exercise catalog
4. `buildReplacementCandidatesV1(sourceExercise, activeCatalog)`
5. `rankReplacementCandidatesV1(sourceExercise, eligibleCandidatesOnly)`
6. `evaluateWorkoutIntegrityV1(sourceExerciseId, currentWorkoutExercises, rankedCandidates)`
7. `decideReplacementV1(sourceExerciseId, integrityEvaluations)`
8. `applyReplacementContextV1(coreDecision, replacementContext, candidateExercises)`
9. project controlled public response

The API does not duplicate formulas or rules from those engines.

## Public Response

```json
{
  "version": "replacement-api-v1",
  "source": {
    "sessionId": 123,
    "sessionExerciseTargetId": 456,
    "exercise": {
      "exerciseId": 13,
      "nameEn": "Back Squat",
      "nameFa": "اسکوات"
    }
  },
  "contextualDecisionStatus": "RECOMMENDED",
  "recommendedReplacement": {
    "exerciseId": 51,
    "nameEn": "Front Squat",
    "nameFa": "فرانت اسکوات",
    "rank": 1,
    "rankingScore": 0.75,
    "integrityStatus": "PASS",
    "equipmentAvailabilityStatus": "CONTEXT_UNKNOWN",
    "reasonCodes": ["REPLACEMENT_EQUIPMENT_CONTEXT_UNKNOWN"],
    "traceability": {
      "eligibility": {
        "eligible": true,
        "passedRuleIds": [
          "CANDIDATE_RULE_NOT_SOURCE_EXERCISE",
          "CANDIDATE_RULE_ACTIVE_CATALOG_EXERCISE"
        ]
      },
      "similarity": {
        "status": "AVAILABLE"
      },
      "ranking": {
        "rank": 1,
        "rankingScore": 0.75
      },
      "integrity": {
        "status": "PASS"
      },
      "context": {
        "equipmentAvailabilityStatus": "CONTEXT_UNKNOWN",
        "replacementIntentType": null
      }
    }
  },
  "alternatives": [],
  "contextRejectedCandidates": [],
  "reasonCodes": ["REPLACEMENT_RECOMMENDED"],
  "context": {
    "version": "replacement-context-v1",
    "equipmentContext": null,
    "replacementIntent": null
  }
}
```

`NO_CONTEXTUAL_REPLACEMENT` is still a successful `200` response and returns:

- `recommendedReplacement: null`
- `alternatives: []`
- contextual rejection summaries when present

## Public Reason Codes

Top-level:

- `REPLACEMENT_RECOMMENDED`
- `REPLACEMENT_RECOMMENDED_WITH_WARNING`
- `REPLACEMENT_NO_CONTEXTUAL_REPLACEMENT`

Candidate-level:

- `REPLACEMENT_EQUIPMENT_AVAILABLE`
- `REPLACEMENT_EQUIPMENT_UNAVAILABLE`
- `REPLACEMENT_EQUIPMENT_CONTEXT_UNKNOWN`
- `REPLACEMENT_EQUIPMENT_METADATA_UNAVAILABLE`
- `REPLACEMENT_INTEGRITY_WARNING`
- `REPLACEMENT_CONTEXTUAL_FALLBACK`

These are API-level codes. They intentionally project and stabilize internal
engine evidence for public consumers.

## Intentionally Hidden Internal Evidence

The API does not expose full internal engine breakdowns in V1.

Hidden from the public response:

- full Similarity dimension breakdowns
- full Ranking breakdowns and internal reason payloads
- full Workout Integrity breakdowns and resulting-workout internals
- full Core Decision / Context-Aware Decision evidence trees

They remain available inside backend orchestration and tests.

This keeps the public contract small while preserving recommendation
traceability through summarized machine-readable evidence.

## HTTP Status Mapping

- `200`
  - request valid
  - evaluation completed
  - includes `NO_CONTEXTUAL_REPLACEMENT`
- `400`
  - malformed request body
  - invalid context contract
  - invalid intent contract
- `401`
  - missing or invalid authentication
- `404`
  - session not found
  - source target not found
  - session ownership mismatch under the existing session convention
- `422`
  - request is semantically valid but cannot be evaluated because Workout
    Integrity V1 cannot safely resolve a unique source occurrence
- `500`
  - unexpected application failure only

## No-Mutation Guarantee

Replacement API V1 is evaluation-only.

It does not:

- mutate the workout
- apply the replacement
- update the program
- persist scores
- persist recommendations
- create recommendation applications

## Companion Apply Boundary

This endpoint only evaluates and recommends.

The companion mutation endpoint is documented separately in
`docs/replacement-apply-v1.md`.

Recommendation and Apply remain separate operations:

- recommendation evaluates and returns choices
- Apply mutates only the explicitly selected replacement target occurrence
semantics rather than rerunning hidden policy from the client.
