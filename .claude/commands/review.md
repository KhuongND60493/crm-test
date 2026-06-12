You are in the **REVIEW phase** of the ROMIO AI Workflow.

## Rules

- Do NOT modify any code unless the user explicitly asks for a fix.
- Review the current `git diff` (staged + unstaged changes).
- If no diff is available, review the files listed in the Implementation Summary.
- Be thorough — this is the last checkpoint before merge.

---

## Your Task

Review all changes and produce the following report:

---

# AI Code Review

**Date:** [date]
**Reviewer:** Claude (ROMIO Workflow)
**PLAN Reference:** `.ai/plans/PLAN-[short-name].md`

---

## 1. Summary

Briefly describe what the changes do and whether they match the approved PLAN.

Verdict: ✅ Looks good / ⚠️ Minor concerns / ❌ Blocking issues found

---

## 2. Correctness Issues

List any logic errors, off-by-one errors, null reference risks, or incorrect behavior.

| Location | Issue | Severity (Low/Med/High) |
|----------|-------|------------------------|
|          |       |                        |

---

## 3. Business Logic Risks

Identify any case where the code might violate the business rules defined in the SPEC.

---

## 4. Security Risks

Check for:
- SQL injection / unsanitized input
- Sensitive data in logs
- Missing authorization checks
- Hardcoded credentials or secrets
- Insecure deserialization

---

## 5. Performance Risks

Check for:
- N+1 query patterns
- Missing indexes implied by new queries
- Unbounded loops or large in-memory collections
- Missing pagination
- Cache invalidation issues

---

## 6. Maintainability

- Is the code readable and following the existing conventions?
- Are there magic numbers or strings that should be constants/config?
- Is error handling consistent with the rest of the codebase?
- Are new abstractions necessary or over-engineered?

---

## 7. Test Coverage

- Are the acceptance criteria from the SPEC covered by tests?
- Are edge cases tested?
- Are there any untested code paths that pose risk?

---

## 8. Suggested Fixes

For each issue found, provide a concrete suggestion:

```
File: [path]
Line: [approx]
Issue: [description]
Suggestion: [how to fix it]
```

---

## 9. Release Checklist

- [ ] Build passes
- [ ] All tests pass
- [ ] No secrets or credentials in code
- [ ] Database migrations are backward compatible (or migration plan confirmed)
- [ ] API changes are backward compatible (or versioning confirmed)
- [ ] Config/environment changes are documented
- [ ] Acceptance criteria from SPEC are met
- [ ] Rollback plan is confirmed
- [ ] PR description is complete

---

After the review, suggest next steps:
- If issues found: ask the user whether to fix them now or log them as TODO.
- If clean: recommend merging and closing the SPEC/PLAN files as completed.
