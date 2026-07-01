# Manual Verification Checklist

## Purpose
This checklist defines the manual runtime verification pass for the current IronFa app state.

Its purpose is to verify the real product loop end-to-end after the current implementation waves:
- onboarding
- split selection
- adaptive prescriptions
- workout logging
- completion feedback
- persistence
- explainability

This checklist is for hands-on runtime validation, not for planning.

---

## 1. Environment Check

- [ ] Open the current app from the local workspace version, not the old backup or Downloads copy.
- [ ] Confirm the active file/source is `/Users/user/Desktop/Gym App/gym-app.jsx`.
- [ ] Confirm the latest state snapshot exists in `/Users/user/Desktop/Gym App/docs/current-state.md`.

---

## 2. Authentication and Session

- [ ] Login with the demo user.
- [ ] Refresh once and confirm the session persists.
- [ ] Logout and confirm the session clears correctly.
- [ ] Login again and confirm the app restores without obvious state corruption.

---

## 3. Onboarding Flow

- [ ] Start from a user that still needs onboarding.
- [ ] Complete the 5-step onboarding flow.
- [ ] Confirm required fields block progress when empty.
- [ ] Confirm the final summary only shows V1 onboarding fields.
- [ ] Confirm the onboarding trust/disclaimer block is visible.
- [ ] Finish onboarding and confirm the app enters the main flow without crash.

---

## 4. Recommendation and Plan Explanation

- [ ] Open the programs tab after onboarding.
- [ ] Confirm a recommended plan appears.
- [ ] Confirm the split label is visible.
- [ ] Confirm prescription details are shown per movement.
- [ ] Confirm the explanation blocks render:
- [ ] `چرا این برنامه برای تو انتخاب شد`
- [ ] `منطق انتخاب این پیشنهاد`
- [ ] `چه چیزی بعداً این برنامه را تغییر می‌دهد`
- [ ] Confirm trust/disclaimer copy is visible in the programs area.

---

## 5. Static Programs

- [ ] Confirm static programs still render.
- [ ] Confirm static programs also show prescriptions.
- [ ] Confirm static programs can still be activated.
- [ ] Confirm no obvious UI break happens when switching between recommended and static programs.

---

## 6. Program Activation and Day Flow

- [ ] Activate the recommended program.
- [ ] Confirm the workout tab opens with an active day.
- [ ] Confirm day chips render.
- [ ] Switch between days and confirm the active day changes correctly.
- [ ] Confirm the selected exercise auto-updates to a valid movement for the current day.

---

## 7. Workout Logging

- [ ] Try saving with empty fields and confirm save is blocked.
- [ ] Enter a valid set and confirm save feedback appears.
- [ ] Confirm the next suggested exercise updates.
- [ ] Confirm the session log area only shows current-session entries.
- [ ] Confirm log entries contain program/day context in the UI.

---

## 8. Prescription UX

- [ ] Confirm the active prescription block renders for the active movement.
- [ ] Confirm `پر کردن فرم از نسخه` fills reps/sets into the form.
- [ ] Confirm `تنظیم تایمر طبق نسخه` updates the rest timer duration.
- [ ] Confirm active movement progress against target sets updates after logging.
- [ ] Confirm the active-day adherence card updates after logging more than one movement.

---

## 9. Progression Guidance

- [ ] Confirm the progression block appears for a movement with history.
- [ ] Confirm it shows a strategy label:
- [ ] `افزایش وزنه`
- [ ] `افزایش تکرار`
- [ ] `تثبیت اجرا`
- [ ] `نگه‌داشتن بار`
- [ ] Confirm the explanation text under the progression block is understandable.
- [ ] Confirm `استفاده از پیشنهاد` fills the form correctly.

---

## 10. Workout Completion

- [ ] Log at least one full session and click finish workout.
- [ ] Confirm the popup opens without crash.
- [ ] Confirm the popup shows:
- [ ] session summary
- [ ] adherence summary
- [ ] next-step guidance
- [ ] explanation of why that guidance was chosen
- [ ] Confirm the next day is selected automatically when a program is active.
- [ ] Confirm the current-session draft clears after finishing.

---

## 11. Persistence

- [ ] While a workout is in progress, refresh the page.
- [ ] Confirm the active workout draft still exists.
- [ ] Finish the session.
- [ ] Refresh again.
- [ ] Confirm completed history remains available.
- [ ] Confirm the active workout draft is gone after completion.
- [ ] Confirm the active plan and selected day still restore correctly.

---

## 12. Adaptive Prescription Verification

- [ ] After completing sessions, reopen the programs tab.
- [ ] Confirm adaptive prescription notes appear when relevant.
- [ ] Confirm unfinished draft logs do not change the recommendation mid-session.
- [ ] Confirm only completed workout history affects adaptive plan updates.

---

## 13. Progress Tab

- [ ] Open the progress tab after completing at least one session.
- [ ] Confirm session count updates.
- [ ] Confirm latest-session summary updates.
- [ ] Confirm adherence metrics update.
- [ ] Confirm the weight chart still renders even if progress data is minimal.

---

## 14. AI Tab

- [ ] Open the AI tab.
- [ ] Confirm trust/disclaimer copy is visible.
- [ ] Confirm the prompt does not depend on removed onboarding fields.
- [ ] Confirm the AI context reflects active plan/day if one is selected.

---

## 15. Edge Cases

- [ ] Activate a plan, switch days, then refresh.
- [ ] Confirm the selected day restores safely.
- [ ] Confirm invalid or stale exercise selection does not leave the form broken.
- [ ] Confirm no obvious crash happens with empty history.
- [ ] Confirm no obvious crash happens with empty progress data.

---

## 16. Verification Outcome

Mark the verification pass as successful only if:
- [ ] the core loop works end-to-end
- [ ] no major restore/persistence bug appears
- [ ] adaptive prescriptions behave only from completed history
- [ ] workout completion and progression explanations render correctly
- [ ] no obvious blocking runtime error appears during the main flow

---

## 17. Notes

Use this section to record issues found during the pass:

- [ ] No issues found
- [ ] Issues recorded separately

### Code-Level Findings Closed So Far

- [x] Adaptive plans now read only completed workout history, not the active workout draft.
- [x] Switching programs clears the active workout draft instead of mixing sessions across plans.
- [x] Progress weight entry now blocks non-positive and non-numeric values.
- [x] Switching programs or days now resets stale weight/reps/sets in the active workout form.
- [x] Progress tab session stats now use completed workout history only.
- [x] Invalid or stale restored exercise selections now reset the active workout form instead of carrying old values.
- [x] Finishing a workout now stops the active rest timer instead of leaving it running behind the popup.
- [x] The AI tab now visibly shows the active context being sent to the coach layer.

### Runtime Checks Still To Execute

- [x] Real browser/runtime pass from onboarding into recommendation.
- [x] Real workout logging and completion pass with UI interaction.
- [x] Refresh/reload persistence pass during an active workout.
- [x] Post-completion restore pass with history/progress inspection.
- [x] AI tab runtime prompt/context sanity check.

### Runtime Sections Confirmed In Browser

- [x] Authentication and session flow
- [x] Onboarding flow
- [x] Recommendation and plan explanation
- [x] Static programs
- [x] Program activation and day flow
- [x] Workout logging
- [x] Prescription UX
- [x] Progression guidance
- [x] Workout completion popup and next-step behavior
- [x] Persistence across refresh/reload
- [x] Adaptive prescription visibility
- [x] Progress tab
- [x] AI tab
- [x] Spot-check for adaptive prescription copy in the programs tab
- [x] Spot-check for progression state labels and explanation in the workout tab
