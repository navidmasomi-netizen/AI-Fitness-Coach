# Release-Style QA Tightening

## Purpose
This checklist defines the short release-style QA tightening pass after the main runtime verification wave.

Its purpose is to reduce release risk without opening a new feature wave.

---

## 1. Snapshot Alignment

- [x] Confirm `docs/current-state.md` reflects the latest implementation checkpoint.
- [x] Confirm the latest verification and progression commits are represented in the project snapshot.

---

## 2. Git Cleanliness

- [x] Confirm no intended product changes remain uncommitted.
- [x] Confirm unrelated files are still excluded from product commits.

---

## 3. Runtime Entry

- [x] Confirm the local runtime harness still builds successfully.
- [x] Confirm the dev server can still start from the repo workspace.

---

## 4. Core Loop Sanity

- [x] Confirm onboarding still reaches the main app.
- [x] Confirm recommendation still renders after the latest progression changes.
- [x] Confirm workout logging still works after the latest progression changes.
- [x] Confirm completion popup still works after the latest progression changes.

---

## 5. Progression and Adaptive Behavior

- [x] Confirm progression labels still render correctly after plateau/deload updates.
- [x] Confirm adaptive prescription notes still render correctly in the programs tab.
- [x] Confirm no obvious copy mismatch exists between progression state and prescription adjustment note.

---

## 6. Persistence and Restore

- [x] Confirm refresh/reload behavior still restores active plan and workout draft correctly.
- [x] Confirm completed history remains separate from active workout draft.

---

## 7. Risk Register

Record any remaining release-facing risks here:

- [x] Snapshot lag
- [x] Runtime harness mismatch
- [x] Progression copy mismatch
- [x] Restore/persistence regression
- [x] No new issues found

## Notes

- A console warning about mixing `border` and `borderColor` in the logout button was found during runtime QA and fixed.
- The remaining unchecked QA-tightening items were covered by the later manual regression pass and the deterministic progression test controls.
