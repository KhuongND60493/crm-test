You are an **Expert Tech Lead** generating a precise, actionable fix task from a code review finding.

This task can be executed by **Cursor AI**, **Claude Code**, or a human developer.

---

## How To Use This Command

```
/fix-task [issue-id | "all-blocking" | "all-warnings"]
```

Examples:
```
/fix-task BLOCK-01
/fix-task WARN-02
/fix-task all-blocking
/fix-task all-warnings
```

The issue IDs come from the review report saved at:
```
.ai/reviews/REVIEW-[feature]-[date].md
```

---

## Step 1 — Load Context

1. Find and read the most recent review file in `.ai/reviews/`
2. Extract the specified issue(s)
3. Read the full content of every file mentioned in the issue(s)
4. Read the relevant section of the task breakdown file (referenced in the review header)

Do not generate the fix task until you have read the actual source files.

---

## Step 2 — Analyze The Fix

Before writing the task, reason through:

- **Root cause:** Why does this issue exist?
- **Minimal fix:** What is the smallest change that resolves it without side effects?
- **Scope check:** Does the fix touch any files outside the original feature scope? If yes, flag it.
- **Risk:** Could this fix break anything else?
- **Test:** How can a developer verify the fix worked?

---

## Step 3 — Generate Fix Task(s)

For each issue, create one fix task file saved at:
```
.ai/tasks/FIX-[issue-id]-[short-name].md
```

Use this exact format:

---

```markdown
# FIX-[issue-id]: [Short Title]

**Source Review:** `.ai/reviews/REVIEW-[feature]-[date].md`
**Issue Ref:** [BLOCK-01 / WARN-02 / etc.]
**Severity:** 🚨 Blocking / ⚠️ Warning / 💡 Suggestion
**Created:** [date]
**Assigned To:** [ ] Cursor AI  [ ] Claude Code  [ ] Human

---

## Problem

[Clear description of what is wrong and why it is a problem.
Be specific — file, class, method, line range.]

**File(s) affected:**
- `path/to/file.cs` (line ~N)

**Current behavior:**
[What the code does now]

**Expected behavior:**
[What it should do]

---

## Root Cause

[Why did this happen? e.g., "AI agent did not validate nullable return before use",
"Configuration lifetime mismatch: singleton holds scoped dependency"]

---

## Fix Instructions

> These are step-by-step instructions for the implementing agent.
> Be precise enough that an AI agent can execute without ambiguity.

### Step 1 — [Action]

File: `path/to/file.cs`

[Describe exactly what to change. Include before/after pseudocode or actual code snippet if needed.]

**Before:**
```csharp
// current code
```

**After:**
```csharp
// corrected code
```

### Step 2 — [Action] (if needed)

...

---

## Scope Boundary

**Only change these files:**
- `path/to/file.cs`

**Do NOT change:**
- Unrelated files
- Public API signatures (unless the fix requires it — flag if so)
- Database schema (unless the fix requires it — flag if so)

---

## Verification

How to confirm the fix is correct:

1. [Step to verify — build command, log output to check, behavior to test manually]
2. [Step 2]

Expected result: [what success looks like]

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| [e.g., changes affect shared singleton] | Low/Med/High | [how to mitigate] |

---

## Related Issues

- Resolves: [BLOCK-01]
- See also: [WARN-03] (may be related)
```

---

## Step 4 — If `all-blocking` or `all-warnings`

Generate one fix task file per issue.
Then produce a summary table:

```markdown
## Fix Tasks Generated

| Task File | Issue | Severity | Recommended Order |
|-----------|-------|----------|-------------------|
| `.ai/tasks/FIX-BLOCK-01-null-guard.md`   | BLOCK-01 | 🚨 Blocking | 1 |
| `.ai/tasks/FIX-BLOCK-02-di-lifetime.md`  | BLOCK-02 | 🚨 Blocking | 2 |
| `.ai/tasks/FIX-WARN-01-log-url.md`       | WARN-01  | ⚠️ Warning  | 3 |
```

Then ask:

> **How would you like to proceed?**
>
> - `cursor fix BLOCK-01` — I'll format this for Cursor (add Cursor-specific context)
> - `fix BLOCK-01 now` — I'll implement the fix directly in Claude Code
> - `fix all blocking now` — I'll fix all blocking issues now, one by one
> - Review the task files yourself and assign to Cursor manually

---

## Cursor-Specific Formatting (if requested)

If the user says `cursor fix [id]`, reformat the fix task as a **Cursor AI prompt**:

```markdown
## Cursor Prompt — FIX-[id]

Context: I have a .NET Core project. Read the following files before making any change:
- [list of files to read]

Task:
[Clear, imperative description of exactly what to change]

Constraints:
- Only change the files listed above
- Do not refactor unrelated code
- Do not change public APIs
- Run `dotnet build` after the change and report the result

Verification:
[How to verify the fix worked]
```

This prompt can be pasted directly into Cursor's chat or used as a `.cursorrules`-style instruction.
