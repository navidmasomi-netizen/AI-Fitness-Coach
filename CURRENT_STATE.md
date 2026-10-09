# CURRENT STATE — AI-Fitness-Coach

## Current Development Stage

The project has completed its clean repository migration and documentation setup.

The new canonical repository is:

https://github.com/navidmasomi-netizen/AI-Fitness-Coach

This repository is now the source of truth for all future development.

---

## Current Product Status

The product has completed the MVP workout foundation.

Completed core areas:

- authentication
- backend API
- Prisma/PostgreSQL schema
- exercise database
- program templates
- user program activation
- workout session lifecycle
- set logging
- workout completion
- workout history
- resume active session
- rest timer
- progression recommendation engine
- progression summary
- micro history
- lightweight habit cues
- guided workout start UX
- first-time clarity intro screen

## Phase 8 — Release Infrastructure Closure

### Formal Status

- **Phase 8 Release Infrastructure:** COMPLETE
- **Phase 8 Mobile Release:** PAUSED / NOT RELEASE-READY

The production infrastructure and mobile build delivery path are complete and
verified. This does not make the mobile product release-ready: application-level
physical-device QA has not passed, and the current mobile experience requires
product and UX remediation before any store release.

### Completed Infrastructure and Build Delivery

- **Backend production deployment:** COMPLETE
  - Backend: `https://runpuy-api.onrender.com`
  - Production API: `https://runpuy-api.onrender.com/api`
  - Health endpoint: VERIFIED
  - Exercises endpoint: VERIFIED
- **EAS project linkage:** COMPLETE
  - Expo account: `runpuy`
  - EAS project: `@runpuy-app/runpuy`
  - EAS project ID: `024efd93-a0e8-48aa-9395-2816c866d7cf`
- **Production mobile API environment:** CONFIGURED
  - `EXPO_PUBLIC_API_BASE_URL=https://runpuy-api.onrender.com/api`
- **Android signing:** EAS-MANAGED KEYSTORE CONFIGURED
  - Android package: `com.runpuy.app`
- **Android QA profile:** CONFIGURED
  - `qa` distribution: `internal`
  - `qa` environment: `production`
- **Android QA build:** SUCCESS
  - Build ID: `395b3fdb-f447-49c3-8e7b-73d6f020c736`
  - Artifact: APK
  - Physical Android installation: PASS
  - Physical Android launch: PASS

### Android Release Gate

- **Android application-level physical-device QA:** NOT PASSED
  - The APK installation and launch pipeline succeeded, but physical-device
    testing exposed numerous product and UX issues. The current mobile
    experience is not considered release-ready.
  - This is not a build-system failure.
- **Android production AAB:** NOT BUILT
  - Intentionally blocked until a fresh QA build passes full physical-device QA
    after remediation and onboarding replacement.
- **Google Play registration/payment:** DEFERRED
- **Google Play submission:** DEFERRED

### iOS Deferred Gates

- iOS bundle identifier: `com.runpuy.app`
- Intended Runpuy Apple Account: `hello@runpuy.com`
- **Apple Developer Program:** NOT ENROLLED / PAYMENT DEFERRED BY USER
- **Apple credentials:** NOT CREATED
- **Apple bundle ID registration:** NOT VERIFIED
- **Distribution Certificate:** NOT CREATED / NOT VERIFIED
- **Provisioning Profile:** NOT CREATED / NOT VERIFIED
- **iOS production/QA build:** NOT BUILT
- **iOS physical-device QA:** NOT PERFORMED
- **App Store submission:** DEFERRED

Resume iOS work only in this order:

1. Enroll the intended Runpuy Apple Account in the Apple Developer Program.
2. Complete Apple Developer login through EAS.
3. Inspect or register `com.runpuy.app`.
4. Create or validate the Apple Distribution Certificate.
5. Create or validate the Provisioning Profile.
6. Build the required iOS QA/release artifact.
7. Perform physical-device iOS QA.
8. Only after QA passes, prepare App Store submission.

### Next Active Work

**Mobile Onboarding Redesign + Mobile QA Remediation**

The current onboarding is **NOT FINAL**. A redesign/rebuild is required before
release. The existing onboarding remains in the codebase until a replacement is
designed, approved, and implemented; it must not be treated as approved final
UX.

Scope of the next work:

- redesign and implement approved onboarding
- remediate the mobile product and UX defects found during physical QA
- validate behavior on Android and iOS
- generate fresh QA builds and perform fresh physical-device QA
- resolve all critical and major release blockers before store release

### Store Release Authorization Gate

No production store build or submission is authorized until all of the
following are true:

- the new onboarding is approved and implemented
- mobile remediation is complete
- a fresh Android QA APK is built and passes physical-device QA
- the Apple Developer Program and required iOS signing credentials are configured
- an iOS QA/release build is completed and passes physical-device QA
- no critical release blockers remain
- no major release blockers remain

Only after those conditions are met may the Android production AAB be finalized,
Google Play submission proceed, the iOS production/store build be finalized, and
App Store submission proceed.

## Explainable Progression — Current State

Explainable Progression is now available end to end for fresh workout completion. When a workout is completed, each fresh persisted progression recommendation may include a public explanation DTO with:

- `messageKey`
- `userSummary`

Explanation text is derived on demand from the authoritative normalized progression decision and is not persisted. The public API excludes developer-only fields such as `developerSummary`, `primaryReason`, and `secondaryReasons`.

Current scope and limitations:

- Explanations are available on fresh workout completion responses.
- History and session-detail endpoints do not currently reconstruct explanations.
- Persisted historical recommendation records do not retain enough data to faithfully rebuild every explanation, because complete `secondaryReasonCodes` are not stored.
- Mobile displays fresh explanations on the workout summary screen after completion.
- The mobile explanation is transient client state and may be unavailable after app restart.
- No mobile screen-level test framework is currently configured in the repository.
- Current mobile validation is TypeScript type-checking plus backend and route coverage.

Release note:

Explainable Progression now surfaces `messageKey` and `userSummary` on fresh progression recommendations after workout completion, and the mobile workout summary screen displays `userSummary` without moving any decision logic to the client. Explanation wording is not persisted, historical explanations are not yet reconstructed, and developer-only diagnostic fields do not cross the public API boundary.

## Applied Deload History — Current State

Applied Deload History is now available as passive internal context during fresh workout completion.

- The signal is populated at `trainingStateSignals.adaptation.deloadHistory`.
- Current fields are:
  - `recentDeloadCount`
  - `mostRecentDeloadAt`
  - `hasRecentDeload`
- These fields represent **applied** deload history only. Recommendation-only rows do not count.
- The derivation boundary is the current `UserProgram`.
- The current source session is excluded from history.
- The word `recent` is a legacy field name only:
  - no calendar window is applied
  - no session-distance window is applied
  - no exposure-distance window is applied
- No Decision Engine rule currently consumes Deload History.
- Any future activation requires a product-approved definition of sufficient distance since an applied deload. Valid future distance candidates include completed sessions, exposures, and elapsed time, but none is currently approved.

---

## Current Repository Structure

```text
AI-Fitness-Coach/
├── backend/
├── mobile/
├── docs/
├── README.md
├── VISION.md
├── PROJECT_KNOWLEDGE.md
├── PRODUCT_PRINCIPLES.md
├── ROADMAP.md
├── CLAUDE.md
├── CURRENT_STATE.md
└── .gitignore
```

## First-Time Clarity Layer — Complete

- New users are auto-routed to Intro after registration.
- Intro-seen state persists correctly across app restart and logout/login. Current implementation uses SecureStore.
- Manual re-entry via Home "How this works" link works independently of first-run state.
- Verified end-to-end on physical device via Expo Go.

Resolved issue: root navigation guard (`app/index.tsx`) had a stale-state race condition causing Intro to incorrectly reappear after restart; resolved.

## Sprint 2 — User Fitness Profile Wizard — Complete

Sprint 2 is complete and fully verified on physical device via Expo Go.

- **Backend:** Dedicated `UserProfile` model (separate from `User`), source of truth for profile completion. Profile API implemented: `GET /api/profile`, `PATCH /api/profile` (partial updates), `POST /api/profile/complete` (server-side required-field validation).
- **Root decision flow:** Extended to Auth → Intro → Profile completion → Home. Backend-sourced (`wizardCompleted`), not device-local — Intro's Continue and app launch both resolve through the same chain.
- **Fitness Profile Wizard:** Full 18-step wizard (Goal, Training Level, Training Days, Session Duration, Equipment, Age, Sex, Height, Weight, Occupation, Recovery Quality, Nutrition Habits, Meal Frequency, Cardio Preference, Supplement Use, Injury Flags, conditional Injury Notes, "Your AI Profile" summary), with conditional branching for Supplement-Other and Injury Notes.
- **UX polish:** Friendly display labels for all enum fields (raw values unchanged in storage), grouped AI Profile summary (Training / Body / Lifestyle / Health), "What happens next?" card, final CTA "Build My AI Program."
- **Progressive save:** Every step calls `PATCH /api/profile` before navigating (no optimistic navigation) — failures show an inline error and allow retry without losing position.
- **Resume after restart:** Wizard resumes at the correct step via `lastCompletedStep`, correctly handling the conditional branches, after app kill/reopen or logout/login.
- **Completion flow:** "Build My AI Program" calls `POST /api/profile/complete`; on success redirects to Home; on failure shows an error and allows retry.
- **Verification:** All phases (1 through 4C) verified end-to-end on a physical iPhone via Expo Go, including forced network failure, resume across conditional branches, and full regression of Sprint 1's onboarding flow.

## Sprint 3 — AI Program Generator (Core Engine) — Complete

Core deterministic program generation engine is complete and fully verified against real data (39-exercise dataset, real Prisma transactions).

- **Exercise database:** Expanded from 12 to 39 exercises across three incremental seed phases (0A/0B/0C), closing coverage gaps for horizontal_pull, lunge, single_leg, horizontal_press, vertical_press, vertical_pull, elbow patterns, trunk/anti-extension, and advanced-tier options, verified for bodyweight/dumbbell/barbell/machine/cable users and knee/shoulder/wrist/lower_back limitations.
- **Split Resolver:** Deterministic split selection (`full_body`, `upper_lower`, `ppl`, `strength_split`) based on training days/goal/level/recovery, including recovery-based downgrades. Pure, unit-tested (17 tests).
- **Exercise Selector:** Deterministic candidate scoring and ranked selection with strict equipment/injury safety (never relaxed) and a 4-level fallback policy (exact → adjacent difficulty → relaxed goal → explicit no-candidate). Pure, unit-tested (13 tests) against the real dataset.
- **Volume/Rep/Rest Resolver:** Deterministic sets/reps/rest prescription based on goal, training level, recovery, session duration, and slot type (primary/accessory, independent of exercise complexity). Pure, unit-tested (24 tests).
- **Program Generator Orchestrator:** Combines all three resolvers plus a deterministic explanation builder into `generateProgramForUser(userId)`. Full planning happens before any database write; persistence of Program, ProgramDay, ProgramDayExercise, and UserProgram happens inside a single Prisma transaction with automatic rollback on any failure — verified with a real forced-failure rollback test (zero orphaned rows).
- **Generated program properties:** `isStatic: false`; deterministic `Program.description` includes goal, training level, recovery, equipment adaptation, injury adaptation, accessory-slot omission diagnostics, and `Generator v1.0`.
- **Duplicate generation:** Blocked cleanly if the user already has an active `UserProgram` — no new Program created, existing program untouched, including race-condition handling via unique-constraint catch.
- **No-candidate policy:** Accessory slots are omitted with diagnostics if no safe candidate exists; a day with no valid primary exercise (or left with zero exercises) aborts generation entirely before any write — equipment and injury safety are never relaxed to force a result.
- **Verification:** All resolver-level and orchestrator-level tests passed (18 orchestrator tests, including equipment/injury safety checks against real exercises, prescription cross-verification, determinism across users, and transaction rollback).

**Pending:** API route (`POST /api/programs/generate`) and mobile integration (wiring the wizard's "Build My AI Program" button and Home program display) are not yet implemented.
