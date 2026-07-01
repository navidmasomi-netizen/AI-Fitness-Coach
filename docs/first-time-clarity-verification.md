# First-Time Clarity Layer — Real-Device Verification Checklist

## Purpose
This checklist defines the manual real-device verification pass for the First-Time Clarity Layer (Intro screen + onboarding-seen behavior) in AI-Fitness-Coach.

Device: physical iPhone via Expo Go.

Pre-check before starting:
- [ ] Confirm pinned Node v22 runtime is active (`.local-runtime`).
- [ ] Confirm `NODE_OPTIONS="--no-experimental-strip-types"` is set before `npx expo start`.
- [ ] Confirm API base URL points to the Mac's LAN IP, not `localhost`.

---

## 1. Fresh User / Register Flow
- [ ] Clear Expo Go app data or use a genuinely new account (new email) so no stale auth token or onboarding flag exists.
- [ ] Register a new user through the real registration screen (not a seeded/demo user).
- [ ] Confirm registration succeeds and the app transitions without a crash or blank screen.

## 2. Intro Appears Once (first login only)
- [ ] Immediately after registration, confirm the Intro screen renders automatically — not the Home tab.
- [ ] Confirm intro content displays correctly (no missing assets, no layout break).
- [ ] Confirm there's no flash of Home screen before Intro mounts (race condition check).

## 3. Continue Routes to Home
- [ ] Tap the Intro's "Continue" action.
- [ ] Confirm navigation lands on the Home tab, not back on Intro or Auth.
- [ ] Confirm the onboarding-seen flag is actually persisted at this point (not just in memory) before proceeding to step 4.

## 4. Restart App Does Not Show Intro Again
- [ ] Fully force-quit the app (not just background it).
- [ ] Relaunch the app.
- [ ] Confirm the app opens directly to Home (or Auth if session expired) — Intro must NOT reappear.
- [ ] If session persists: confirm Home loads with existing user context intact (active program, etc.).

## 5. Home "How this works" Opens Intro Manually
- [ ] From Home, tap "How this works."
- [ ] Confirm it navigates to `/(onboarding)/intro` correctly.
- [ ] Confirm Intro renders properly when opened this way, not only on first-run (check for first-run-only assumptions, e.g. reliance on a param only passed during onboarding).
- [ ] Confirm back navigation from this manually-opened Intro returns cleanly to Home (no stuck state, no restarted onboarding flow, no duplicate Home in the stack).

## 6. Logout/Login Remains Stable
- [ ] From Home, tap Logout.
- [ ] Confirm it routes to `/(auth)/login` and clears session state.
- [ ] Log back in with the same (now-existing) user.
- [ ] Confirm Intro does **not** reappear — critical regression check: the onboarding-seen flag must survive logout/login, not just app restart.
- [ ] Confirm Home restores correctly (active program, session state) after re-login.

---

## Cross-Cutting Checks
- [ ] Repeat steps 1–4 with a second fresh user to rule out state bleeding from the first test account (local storage / SecureStore leakage).
- [ ] Confirm no console errors/warnings appear during any of the above transitions.

---

## Verification Outcome

Mark this verification pass as successful only if:
- [ ] Intro appears exactly once per new user, automatically.
- [ ] Onboarding-seen state survives app restart.
- [ ] Onboarding-seen state survives logout/login (not device-only storage).
- [ ] Manual "How this works" entry point works independently of first-run state.
- [ ] No blocking runtime error appears during any transition above.

## Notes
Use this section to record issues found during the pass:
- [ ] No issues found
- [ ] Issues recorded separately
