You are in the **CODE phase** of the ROMIO AI Workflow.

## Hard Gate

**Only proceed if the user explicitly said:**

```
APPROVED CODE
```

If the user only said `APPROVED` (without `CODE`), that means the SPEC was approved — not the code.
In that case, go to PLAN phase instead (`/plan`).

If you did not receive `APPROVED CODE`, stop immediately and ask:
> "Please reply `APPROVED CODE` to authorize implementation."

---

## Rules

- Implement **strictly** according to the approved PLAN.
- Only modify files listed in the PLAN under "Files Expected To Change."
- If you need to modify a file not in the PLAN, **stop and explain why** before doing so.
- Do NOT refactor unrelated code.
- Do NOT change public APIs unless the approved SPEC/PLAN explicitly requires it.
- Do NOT modify database schema unless approved.
- Do NOT introduce new dependencies unless approved.
- If a new risk or unexpected blocker is found, **stop and ask** before continuing.
- After implementation, run available build/test commands to verify the result.
- If the implementation deviates from the PLAN for any reason, explain the deviation clearly.

---

## Implementation

Execute the step-by-step implementation from the approved PLAN.

After completing all steps, produce this summary:

---

# Implementation Summary

## 1. Files Changed

| File Path | Change Type | Summary of Change |
|-----------|-------------|-------------------|
|           |             |                   |

## 2. What Changed

For each file, briefly describe:
- What was added / modified / deleted
- Why (reference to PLAN step number)

## 3. Build / Test Result

```
[paste build output or test result here]
```

Status: ✅ Passed / ⚠️ Warning / ❌ Failed

If failed, describe the error and resolution.

## 4. How To Test

Step-by-step instructions for a developer to verify this change manually:

1. ...
2. ...
3. Expected result: ...

## 5. Risks

List any risks that emerged during implementation that were not in the original PLAN.

## 6. Remaining TODO

List anything that was intentionally deferred, or follow-up tasks needed:

- [ ] ...
- [ ] ...

---

After the summary, suggest running `/review` to perform an AI code review before merging.
