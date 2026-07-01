# Current Project State

## Project
IronFa

## Workspace
- Main repo: `/Users/user/Desktop/Gym App`
- Main app file: `/Users/user/Desktop/Gym App/gym-app.jsx`
- Current state file: `/Users/user/Desktop/Gym App/docs/current-state.md`

## Date
Current working state after moving from specification into real implementation and checkpointing multiple implementation waves.

## Current Checkpoint
- Latest implementation commit: `3863fdc`
- Commit message: `Migrate persisted users to canonical shape`

---

## 1. Executive Status

IronFa is no longer in ideation or documentation-only mode.

The project now has:
- a completed phase 1 specification backbone
- a unified local git repo
- real implementation applied to the current app
- a functional MVP training loop with program selection, logging, completion, persistence, and progress
- early goal-specific programming behavior
- trust and disclaimer baseline in user-facing surfaces
- progression-aware workout guidance based on movement history
- polished workout-screen guidance around prescription and adherence
- completion guidance that changes based on adherence quality
- history-aware progression guidance based on multiple recent sessions
- stronger runtime stability around persisted state and restored sessions
- separation between active workout draft and persisted workout history
- a full explanation layer for why the current program was selected and what may change it
- deeper explainability inside workout progression and completion feedback
- history-aware prescription adjustments inside recommended and static programs
- adaptive plans now read only completed workout history, not the active workout draft
- switching programs now clears the active workout draft instead of mixing sessions across plans
- invalid weight entries are blocked in the progress tab
- switching programs or days now resets the active workout form so stale values do not leak into a new context
- progress tab stats now read only completed workout history, not the active workout draft
- invalid restored or stale exercise selections now reset the active workout form instead of carrying old values
- a local Vite runtime harness now exists for real browser verification
- finishing a workout now also stops the active rest timer
- the AI tab now visibly shows the active user/program/day context used for coaching prompts
- a real browser runtime pass has now validated the main user loop end-to-end
- active UI paths now rely less on legacy display aliases and more on normalized goal/level helpers
- core exercise objects no longer carry legacy `muscle` / `level` aliases
- adaptive prescriptions now adjust rep range and rest range, not only sets and effort
- progression now includes plateau reset and deload-aware rules
- browser spot-check confirmed new adaptive copy in the programs tab and progression labels in the workout tab
- progression test controls now provide deterministic UI triggers for increase-load, increase-reps, plateau-reset, and deload states
- progression logic now also reads a longer cycle state and can switch between accumulate, intensify, stabilize, and reset phases
- the progress tab now also summarizes trend direction for adherence, session volume, and weekly cadence instead of only showing raw stats
- the progress tab now also interprets those trends differently for hypertrophy, strength, fat loss, and recomposition
- the AI tab now switches into more conservative safety modes when the user profile or question suggests pain, injury, or limitations
- canonical user normalization now keeps persisted legacy reads at the boundary while returning a cleaner runtime user shape
- active runtime paths no longer rely on leftover `level` / `gender` / `workoutDays` / `sessionLength` / `program.level` style aliases
- prescription logic now also manages training volume across multiple weeks, not only short-horizon history
- a broader bug sweep across the latest adaptive, AI, progress, and persistence waves did not reveal a new blocking regression
- persisted auth data is now migrated into the canonical user shape, so legacy aliases no longer need to survive beyond the one-time migration helper
- release-style QA tightening confirmed clean runtime entry and fixed a runtime style warning in the logout button
- a final release regression checklist now exists for release-candidate gating
- the final release regression checklist is now closed and the current build is considered acceptable as a release candidate

The project is now in:
- implementation
- hardening
- checkpointed iteration
- release-candidate-ready baseline

---

## 2. Current Phase

Current phase:
- specification closed
- first implementation wave active
- core loop implemented
- programming baselines active
- trust/disclaimer baseline active
- next work should continue from the current app backbone, not from new abstract planning

---

## 3. What Was Completed Before Coding

### Product Foundation
Completed:
- product scope
- training engine foundation
- core user flow
- trust and safety baseline
- technical foundation
- roadmap
- decision extraction
- execution readiness review
- phase 1 build issue planning

### Training Logic Specification
Completed:
- split selection spec
- hypertrophy programming spec
- progression and deload spec
- beginner safety spec
- exercise metadata spec
- substitution engine spec
- strength programming spec
- fat loss programming spec
- recomposition programming spec

### Core Flow Specification
Completed:
- onboarding field spec
- onboarding order spec
- onboarding question design
- plan summary spec
- logging interaction spec
- workout screen spec
- disclaimer and trust copy spec
- workout completion and progress feedback spec

---

## 4. Current Implementation Issues

The main implementation issues created for phase 1 are:

- Implement final onboarding field set
- Implement onboarding question order
- Implement split selection baseline
- Implement hypertrophy logic baseline
- Implement beginner-safe filtering baseline
- Implement exercise metadata schema
- Implement substitution baseline
- Implement plan summary screen structure
- Implement workout screen structure
- Implement logging interaction baseline
- Implement workout completion and progress feedback baseline
- Implement disclaimer baseline
- Implement trust copy baseline

These are no longer just issue titles. Several of the backbone issues are now materially implemented in code.

---

## 5. What Has Already Been Implemented in Code

### A. Onboarding V1 Rewrite
The onboarding in `gym-app.jsx` has been rewritten toward the version 1 model.

Implemented:
- leaner onboarding field model
- 5-step onboarding structure
- version 1 summary screen
- cleaned onboarding output contract
- step-level validation
- normalized user persistence path
- trust/disclaimer copy on the final confirmation screen

Current onboarding model includes:
- goal
- training_level
- age
- sex
- weight
- height
- training_days_per_week
- equipment_access
- injury_or_limitation_flags
- session_duration
- recovery_quality

### B. Split Selection Baseline
A real split-selection baseline exists in code.

Implemented:
- normalized split families
- `chooseSplit(...)`
- goal-aware split defaults
- frequency-aware rules
- beginner restrictions
- recovery-based downgrade behavior
- disallowed-case handling
- stable split output contract

Supported split families:
- full_body
- upper_lower
- ppl
- strength_split

### C. Recommended Program Generation
Recommended programs are no longer static-only.

Implemented:
- `buildRecommendedProgram(...)`
- recommendation based on onboarding-derived inputs
- recommendation card in programs tab
- activation of recommended program into workout flow
- goal-specific programming style and cue
- exercise-level prescription data per day
- explanation layer for why the recommendation was chosen

### D. Static Program Alignment
Static programs are no longer raw legacy cards.

Implemented:
- `buildStaticProgram(...)`
- static programs are personalized against the current user
- static programs now carry:
  - filtered/substituted exercises
  - split metadata
  - programming style and cue
  - per-exercise prescriptions

### E. Exercise Metadata Schema
Exercise objects are now materially richer.

Implemented metadata includes:
- name_fa
- name_en
- primary_muscles
- secondary_muscles
- movement_pattern
- equipment
- difficulty
- complexity
- suitable_goals
- contraindications
- joint_stress_flags
- default_rep_range
- default_rest_range
- progression_type
- substitution_list

### F. Filtering and Substitution Baseline
Metadata is now connected to behavior.

Implemented:
- beginner-safe filtering
- equipment-aware filtering
- limitation-aware filtering
- substitution baseline

### G. Goal-Specific Programming Baselines
Recommended programs now carry goal-specific prescription behavior.

Implemented:
- hypertrophy baseline
- strength baseline
- fat loss baseline
- recomposition baseline

Prescription layer currently generates:
- sets
- rep range
- rest range
- effort target
- programming focus label

It now also supports:
- history-based progression hints for the active exercise
- simple next-session weight or rep suggestions
- trend-aware suggestions that can hold, consolidate, or progress based on recent sessions
- history-aware prescription adjustment notes inside the program itself
- plateau reset behavior when a lift stalls despite stable adherence
- short deload behavior when recent execution shows accumulated fatigue

### H. Workout Flow Backbone
The workout flow is now program-aware and day-aware.

Implemented:
- selected program
- selected program day
- day switching
- active day exercise quick-picks
- active program display
- active day context in workout flow
- active prescription display in workout
- active-day adherence and progress card
- progression suggestion block for the active exercise
- one-click autofill for the suggested next-session target
- one-click autofill from the active prescription
- one-click timer setup from the active prescription
- quick per-movement progress display against target sets
- visible progression strategy labels for the active movement
- recent adherence and rep averages inside the progression block
- explanation text for why progression is holding, consolidating, or increasing
- switching program or day now resets weight/reps/sets instead of carrying stale draft values

### I. Logging Interaction Baseline
Logging is no longer a raw form only.

Implemented:
- save confirmation
- disabled save until required inputs exist
- next-step clarity after save
- active program/day context inside logs
- suggested next exercise behavior
- prescription snapshot stored with each logged set

### J. Workout Completion and Feedback
Workout completion is now more product-like.

Implemented:
- completion popup with real session summary
- unique exercises count
- completed sets count
- approximate session volume
- active-day coverage
- next-step message
- automatic next-day preparation when a program is active
- prescription adherence summary in the popup
- completion guidance tone and copy now adapt to adherence quality
- completion guidance can tell the user to finish the current day before moving on
- completion popup now explains why that next-step guidance was chosen
- finishing the workout now also clears the active rest timer

### K. Persistence
Core workout loop data is now persisted.

Implemented:
- persisted session user
- persisted active program
- persisted active program day
- persisted workout history
- separately persisted active workout draft
- persisted progress data
- sanitization of persisted workout logs before runtime use
- sanitization of persisted progress entries before runtime use

### L. Runtime Hardening
The app is more resilient against stale or malformed local state.

Implemented:
- sanitize persisted workout log entries
- sanitize persisted progress entries
- clamp invalid selected program day back into a valid range
- auto-correct active exercise if the current selection is no longer valid
- reset the active workout form when selection fallback chooses a new valid exercise
- prevent invalid log entries with non-positive weight or reps
- prevent invalid weight progress entries with non-positive or non-numeric values
- protect progress chart calculations when progress data is empty
- separate current session draft from historical workout data
- prevent adaptive planning from reacting to unfinished session drafts
- clear the active workout draft before switching to another program

### M. Progress Tab Hardening
The progress tab now uses more real session-derived data.

Implemented:
- unique session count
- recent session count
- total logged volume
- unique logged exercise count
- last-session summary
- persisted weight progress
- average prescription adherence
- last-session prescription adherence
- progress metrics now ignore unfinished workout drafts

### S. Runtime Verification Tooling
The repo can now be run locally for real browser verification.

Implemented:
- local `package.json` with Vite scripts
- `index.html` mount file
- `main.jsx` React entry file
- successful local production build via Vite

### N. AI Prompt Sync
The AI prompt is now aligned with the newer user model.

Implemented:
- no dependency on removed onboarding fields like motivation, diet, supplements, timeline
- uses current user model
- uses active program/day context
- uses filtered exercises context
- trust boundary copy on the AI screen
- visible AI context summary inside the AI tab

### O. Trust / Disclaimer Baseline
Trust and disclaimer copy is now present in user-facing product surfaces.

Implemented:
- onboarding confirmation boundary copy
- program summary trust and safety reminder
- AI coach disclaimer block

### P. Plan Explanation Layer
The programs tab now explains why the current recommendation exists.

Implemented:
- explanation block in the plan summary area
- explanation block inside the recommendation card
- clear reasons tied to goal, frequency, recovery, equipment, and limitations
- explanation of what later changes may hold, consolidate, or progress the plan

### R. History-Aware Prescription Layer
The plan itself now adapts to recent session history.

Implemented:
- history-aware prescription adjustments for recommended programs
- history-aware prescription adjustments for static programs
- conservative volume reduction when adherence is low
- hold behavior when recent exercise performance stalls
- slight prescription progression when history is stable and recovery is good
- adjustment notes shown directly inside the relevant prescription cards
- rep range can now tighten or expand based on recent performance state
- rest range can now lengthen when consolidation or hold behavior is safer

### Q. Workout Explainability Layer
The workout loop now explains decision-making, not just outcomes.

Implemented:
- explanation text for progression strategy inside the workout screen
- explanation text for completion guidance inside the end-of-workout popup
- clear distinction between hold, consolidate, increase reps, and increase load reasoning

---

## 6. Recent Hardening and Cleanup Work

### Runtime Model Hardening
A normalized runtime user path is now active.

Implemented:
- `normalizePersistedUser(...)`
- normalized demo login path
- normalized runtime user usage inside `GymApp`

### Compatibility Debt Reduction
Compatibility cleanup has progressed.

Already reduced:
- runtime logic now relies more on normalized user structure
- onboarding output is normalized before persistence
- filtering and recommendation helpers self-normalize
- demo user and signup seed are leaner and closer to V1
- static programs now use cleaner goal and level vocabulary
- shared goal and level label maps exist
- active UI display paths now use normalized goal/level helpers more consistently
- write paths no longer store `goal_label` explicitly for new onboarding/signup flows
- active exercise metadata objects no longer store legacy `muscle` and `level` fields

Remaining compatibility debt is now mostly intentional and limited to:
- legacy aliases preserved in `normalizePersistedUser(...)`
- compatibility fields preserved where needed to avoid breaking older persisted state

### Runtime Verification Path
A real local verification path now exists.

Implemented:
- local installable runtime dependencies
- buildable runtime harness inside the repo
- browser-openable local app URL for manual checklist execution
- completed browser verification for:
  - authentication and session
  - onboarding
  - recommendation and static programs
  - workout logging and completion
  - persistence and restore behavior
  - progress tab
  - AI tab
- completed spot-check verification for:
  - adaptive prescription notes in the programs tab
  - progression labels and explanation copy in the workout tab

---

## 7. Current Engine Behavior Status

### Fully Active Enough
These are active enough to be considered real implemented baselines:
- onboarding V1 input model
- split selection baseline
- metadata filtering baseline
- substitution baseline
- recommended program activation
- static program alignment
- goal-specific programming prescriptions
- workout logging baseline
- workout completion baseline
- progress persistence baseline
- prescription adherence tracking
- trust/disclaimer baseline
- progression-aware workout guidance
- workout-screen prescription/adherence polish
- adherence-aware completion guidance
- history-aware progression guidance
- runtime state hardening for persisted data and restored flow
- separated active workout draft from persisted history
- deeper explainability inside workout feedback
- history-aware prescription adjustment inside the plan layer
- adaptive plans driven only by completed workout history
- safer program switching without cross-plan draft leakage
- safer progress weight entry validation
- safer program/day switching without stale form carry-over
- progress analytics now align with completed-history-only persistence
- safer restore fallback when the current exercise selection becomes stale

### Partially Implemented but Improving
These are active but still baseline-level:
- deeper volume auto-adjustment

---

## 8. Current Goal-Specific Programming Status

### Hypertrophy Baseline
Implemented:
- moderate-to-higher set prescriptions
- moderate rep targets
- controlled proximity to failure
- moderate rest structure

### Strength Baseline
Implemented:
- lower rep prescriptions
- longer rest prescriptions
- more technique-focused effort tone
- heavier emphasis on compound lifts

### Fat Loss Baseline
Implemented:
- denser prescriptions
- shorter rest structure
- controlled fatigue and session density

### Recomposition Baseline
Implemented:
- balanced prescription style
- moderate sets and moderate fatigue
- sustainable mixed direction

This means programs are no longer only split + exercise names. They now carry baseline training prescriptions.

The workout layer now also uses recent history to suggest the next session target for the active movement, and can hold or consolidate instead of always pushing progression.

The progression layer now also reads a longer cycle from accumulated history, so it can move between accumulation, intensification, stabilization, and reset instead of reacting only to the last few logs.

The program layer now also uses session history to slightly reduce, hold, or progress prescriptions before the user even enters the workout screen.

Adaptive plans now read only completed workout history, so unfinished session drafts do not distort the next recommendation.

The runtime layer now also cleans and stabilizes persisted data before using it inside the main loop, and no longer mixes the active session draft with workout history.

The program layer now also explains why the current recommendation was chosen and what future behavior may change it.

The workout layer now also explains why it suggests holding, consolidating, or progressing, and why the completion popup gives a particular next-step message.

---

## 9. Current Real Product Loop

The current MVP backbone now looks like this:

1. user signs up or logs in
2. user completes V1 onboarding
3. app normalizes user model
4. split selection baseline chooses a split
5. recommended program is generated
6. static programs are also adapted to the user
7. user activates a program
8. user selects a day
9. user logs sets with program/day context
10. app shows save feedback
11. app measures day coverage and prescription adherence
12. app suggests the next progression target for the active exercise
13. app checks recent movement history before deciding whether to push, hold, or consolidate
14. workout screen shows active-day adherence, remaining work, and prescription actions
15. user completes workout
16. app shows session summary and adherence-aware next-step guidance
17. progress and logs persist across sessions
18. app sanitizes persisted state and corrects invalid restored selections
19. progress tab reflects adherence and session-level progress
20. programs tab explains why the current recommendation was chosen and what may change it
21. workout loop explains why progression and completion guidance were chosen
22. the plan layer adjusts prescription details from accumulated session history
23. adaptive planning ignores unfinished session drafts and reads only completed history
24. progression can now switch into longer-cycle accumulation, intensification, stabilization, and reset behavior

This is the strongest implemented loop so far.

---

## 10. What Is Stable Enough Right Now

Stable enough:
- onboarding rewrite direction
- split selection baseline
- program activation flow
- day-aware workout flow
- recommendation and static-program prescription layer
- logging with context
- completion popup summary
- adherence tracking
- progression-aware workout guidance
- history-aware progression logic
- workout-screen prescription guidance
- adherence-aware completion feedback
- runtime stability around persisted data
- persistence for key loop data
- explainable recommendation layer
- explainable workout feedback layer
- history-aware prescription adaptation
- longer-cycle progression behavior beyond the short-horizon hint layer
- adaptive plans isolated from active workout drafts
- progress tab baseline
- richer trend analysis inside the progress tab
- goal-specific progress interpretation inside the progress tab
- limitation-aware AI safety shaping in both prompt construction and visible UI state
- tighter canonical normalization for persisted user data
- compatibility debt now mostly reduced to legacy read support at the persistence boundary only
- normalized runtime user approach
- trust/disclaimer baseline

Not yet fully hardened:
- richer explanation of why specific exercises were chosen inside exercise-level selection too
- perfect app-wide normalization
- full test/runtime verification

---

## 11. What Should Not Be Reopened Casually

The following are effectively locked for version 1 direction:
- workout-first product direction
- rule-based engine approach
- support for hypertrophy / strength / fat loss / recomposition
- lean onboarding approach
- beginner/intermediate first orientation
- split selection as a real engine layer
- metadata-driven filtering and substitution
- implementation-first execution rather than endless new specs

These should not be reopened without a strong reason.

---

## 12. Immediate Next Logical Work

The most logical next work items are:

1. turn progression guidance into actual auto-updating prescription behavior over time
2. keep hardening the current loop with runtime verification
3. connect explainability more directly to long-cycle auto-adjustments over time
4. keep compatibility cleanup limited to safe persistence-boundary migration work
5. open the next feature wave only if it clearly justifies another regression pass

---

## 13. Recommended Next Focus

Recommended next focus:
- continue implementation from the current repo and file
- stay on engine and workout-loop issues
- avoid drifting into unrelated side features
- keep working from `/Users/user/Desktop/Gym App/gym-app.jsx`

If continuing from the current momentum, the best next topic is:
- runtime verification of the current adaptive loop
or
- the next intentional feature wave after release-candidate sign-off

---

## 14. Resume Instruction

When resuming work later, use this message:

```text
ادامه پروژه IronFa از /Users/user/Desktop/Gym App/docs/current-state.md

حالت کار: implementation
فایل فعلی: /Users/user/Desktop/Gym App/gym-app.jsx
تمرکز فعلی: [موضوع فعلی]

لطفاً:
1. وضعیت فعلی را از روی current-state.md مبنا بگیر
2. تغییرات واقعی اعمال‌شده در gym-app.jsx را ادامه بده
3. از آخرین implementation state ادامه بده
4. اگر لازم است، قدم بعدی را اجرایی و code-facing بچین
```

---

## 15. Short Resume Versions

### General Resume
```text
ادامه پروژه IronFa از /Users/user/Desktop/Gym App/docs/current-state.md
implementation mode
file: /Users/user/Desktop/Gym App/gym-app.jsx
```

### If continuing engine work
```text
ادامه پروژه IronFa از /Users/user/Desktop/Gym App/docs/current-state.md
implementation mode
file: /Users/user/Desktop/Gym App/gym-app.jsx
focus: engine and recommendation layer
```

### If continuing workout loop work
```text
ادامه پروژه IronFa از /Users/user/Desktop/Gym App/docs/current-state.md
implementation mode
file: /Users/user/Desktop/Gym App/gym-app.jsx
focus: workout loop hardening
```

---

## 16. Summary

IronFa has moved from planning into real implementation.

The project now has:
- a rewritten onboarding backbone
- a real split-selection baseline
- metadata-driven exercise logic
- recommended and static program generation with prescriptions
- day-aware workout flow
- logging and completion feedback
- persistence for core loop data
- a stronger progress layer
- early goal-specific programming prescriptions
- prescription adherence tracking
- progression-aware workout guidance
- explainable recommendation layer
- explainable workout feedback layer
- history-aware prescription adaptation
- trust/disclaimer product surfaces

The project should now continue through focused implementation and hardening, not a return to broad planning.
