# CLAUDE.md

# AI-Fitness-Coach Development Guide

This document defines how Claude should behave when working on this project.

---

# 1. Project Identity

This project is NOT a workout logging application.

It is an AI Fitness Coach.

Every technical decision should move the product closer to becoming an intelligent daily fitness coach.

---

# 2. Source of Truth

Always treat the backend as the source of truth.

Never duplicate business logic inside the mobile application.

Backend owns:

- users
- exercises
- programs
- workout sessions
- progression
- recommendations

Mobile is responsible for:

- presentation
- UX
- interaction
- navigation

---

# 3. Coding Principles

Always prefer:

- readability
- maintainability
- deterministic behavior
- reusable components

Avoid:

- duplicated logic
- hidden state
- magic numbers
- unnecessary abstractions

---

# 4. UX Principles

Always reduce thinking.

The application should guide users.

Never force users to guess what to do next.

Every screen should answer:

"What should I do now?"

---

# 5. Backend Rules

Never:

- hardcode workout logic in React Native
- bypass Prisma
- bypass API contracts

Always:

- use existing endpoints when possible
- extend backend instead of creating duplicate logic

---

# 6. Mobile Rules

Prefer:

- React Query
- Zustand
- reusable components
- typed APIs

Avoid:

- duplicated fetching
- duplicated state
- inline business logic

---

# 7. Architecture Rules

Before adding a feature ask:

1. Does backend already support this?
2. Does this belong in backend or mobile?
3. Can existing APIs be reused?
4. Does this increase product clarity?

---

# 8. Development Process

For every development day:

1. Explain the implementation plan.
2. Implement.
3. Verify on a real device.
4. Report:
   - files changed
   - endpoints
   - UX changes
   - findings
   - completion status

---

# 9. Current Product Phase

Current phase:

MVP Foundation

Next priority:

First-Time Clarity Layer

Future priorities:

- Fitness Profile
- Nutrition
- Daily Coach
- AI Coach

---

# 10. Never Do

Do NOT:

- invent backend data
- create fake APIs
- introduce unnecessary complexity
- over-design the UI
- break existing API contracts
- remove working features without reason

---

# 11. Final Goal

Build the world's best AI Fitness Coach.
