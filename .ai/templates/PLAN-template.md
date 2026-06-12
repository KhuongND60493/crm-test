# PLAN-[short-name]

**Status:** Draft | Approved | Implemented
**SPEC Reference:** `.ai/specs/SPEC-[short-name].md`
**Created:** YYYY-MM-DD
**Author:** AI-assisted (ROMIO Workflow)

---

## 1. Scope

> Briefly restate what will and will not be changed, referencing the SPEC.
> Do not expand scope here.

## 2. Files Inspected

> Files read to understand the existing codebase before planning.

| File Path | Purpose / Notes |
|-----------|-----------------|
|           |                 |

## 3. Files Expected To Change

| File Path | Change Type            | Reason |
|-----------|------------------------|--------|
|           | Create/Modify/Delete   |        |

## 4. Current Architecture Understanding

> Describe the relevant parts of the existing architecture:
> - Design pattern (layered, clean, CQRS, event-driven, etc.)
> - Key classes, services, or components involved
> - Existing data flow relevant to this feature

## 5. Design Approach

> Explain the implementation strategy:
> - What pattern will be followed and why
> - Alternatives considered and why they were rejected
> - Any new abstractions or interfaces proposed

## 6. Step-by-step Implementation

> Number each step. Steps should be small, safe, and independently verifiable.

1. **[Step name]** — Description of what to do and why.
2. **[Step name]** — Description of what to do and why.
3. ...

## 7. Data Model Changes

> Describe any database or schema changes:
> - New tables, columns, or indexes
> - Migration file(s) to create
> - Backward compatibility considerations
> - Seed data changes if applicable

If none: *No data model changes required.*

## 8. API Changes

> Describe changes to public interfaces (REST endpoints, message contracts, event schemas):
> - New endpoints or modifications to existing ones
> - Breaking vs non-breaking changes
> - Versioning strategy if applicable

If none: *No API changes required.*

## 9. Config Changes

> List environment variables, feature flags, or config file changes:

| Config Key | Type    | Default | Description     | Required In |
|------------|---------|---------|-----------------|-------------|
|            |         |         |                 |             |

If none: *No config changes required.*

## 10. Test Plan

| Test Type     | What to Test                        | Tool / Approach   |
|---------------|-------------------------------------|-------------------|
| Unit          |                                     |                   |
| Integration   |                                     |                   |
| Manual / E2E  |                                     |                   |

## 11. Risks

| Risk Description                       | Likelihood   | Impact | Mitigation           |
|----------------------------------------|--------------|--------|----------------------|
|                                        | Low/Med/High |        |                      |

## 12. Rollback Plan

> How to revert this change if it causes issues in production:

1. Code rollback: ...
2. Data/migration rollback (if applicable): ...
3. Feature flag disable (if applicable): ...

---

**Code Authorization:**

> *Reply `APPROVED CODE` to authorize implementation.*

---

*ROMIO AI Workflow — PLAN template*
