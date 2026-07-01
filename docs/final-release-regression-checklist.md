# Final Release Regression Checklist

## Purpose
This checklist defines the final release-style regression pass for IronFa before treating the current build as a release candidate.

Its purpose is to re-check the core loop after the latest implementation, hardening, verification, progression, and QA waves.

---

## 1. Workspace and Build

- [x] Confirm the active workspace is `/Users/user/Desktop/Gym App`.
- [x] Confirm the active app file is `gym-app.jsx`.
- [x] Confirm `npm run build` succeeds without blocking errors.
- [x] Confirm the local runtime harness still starts correctly.

---

## 2. Authentication and Session

- [x] Login with the demo user.
- [x] Refresh and confirm the session persists.
- [x] Logout and confirm the session clears.
- [x] Login again and confirm restore remains stable.

---

## 3. Onboarding Regression

- [x] Register a fresh user and enter onboarding.
- [x] Confirm the 5-step onboarding still works.
- [x] Confirm required fields still block progress.
- [x] Confirm the final summary still shows only V1 onboarding fields.
- [x] Confirm onboarding completion still enters the app without crash.

---

## 4. Programs and Recommendation

- [x] Confirm the recommended program renders.
- [x] Confirm static programs render.
- [x] Confirm prescriptions still show inside programs.
- [x] Confirm explanation blocks still render.
- [x] Confirm trust/disclaimer copy is still present.

---

## 5. Workout Flow

- [x] Activate a program and confirm the workout tab opens correctly.
- [x] Confirm day switching still works.
- [x] Confirm workout logging still works.
- [x] Confirm save feedback still appears.
- [x] Confirm prescription controls still work.
- [x] Confirm progression guidance still renders.

---

## 6. Completion and Restore

- [x] Finish a workout and confirm the popup still works.
- [x] Confirm the popup can scroll fully.
- [x] Confirm the rest timer stops on workout completion.
- [x] Confirm the active draft clears after completion.
- [x] Confirm the next day still auto-selects when a program is active.

---

## 7. Persistence and History

- [x] Refresh during an active workout and confirm the draft restores.
- [x] Refresh after completion and confirm only completed history remains.
- [x] Confirm progress stats still use completed history only.
- [x] Confirm adaptive plans still ignore unfinished drafts.

---

## 8. Progression and Adaptive Behavior

- [x] Confirm progression labels still render:
- [x] `افزایش وزنه`
- [x] `افزایش تکرار`
- [x] `تثبیت اجرا`
- [x] `نگه‌داشتن بار`
- [x] Confirm plateau/deload labels render when triggered:
- [x] `ریست پلاتو`
- [x] `دیلود کوتاه`
- [x] Confirm adaptive notes in the programs tab still match prescription changes.

---

## 9. Progress and AI

- [x] Confirm the progress tab still renders session stats and adherence.
- [x] Confirm the weight chart still renders.
- [x] Confirm the AI disclaimer is still visible.
- [x] Confirm the AI context summary still reflects the active program/day.

---

## 10. Final Gate

- [x] No blocking runtime error appears during the main loop.
- [x] No major persistence regression appears.
- [x] No obvious UI break appears in the main surfaces.
- [x] The current build is acceptable as a release candidate.

---

## Notes

- [x] No new issues found
- [x] Issues recorded separately

- Progression states `افزایش وزنه`, `افزایش تکرار`, `تثبیت اجرا`, and `نگه‌داشتن بار` were confirmed in the browser.
- Adaptive prescription note rendering was confirmed in the programs tab.
- Plateau/deload states were deterministically triggered and confirmed in the workout tab through the local progression test controls.
- The current residual risk is limited to future waves introducing new regressions; no blocking release issue is currently open in the verified loop.
