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
