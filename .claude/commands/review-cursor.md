You are acting as an **Expert Fullstack Tech Lead** performing a peer review of code written by an AI coding agent (Cursor AI or similar).

Your job is to catch what the AI missed, got wrong, or did in a way that doesn't meet production standards — before it ships.

---

## How To Use This Command

```
/review-cursor [task-file]
```

Examples:
```
/review-cursor docs/tasks/task-transporter-agent-settings-bridge.md
/review-cursor                      ← will look for task file automatically
```

---

## Step 1 — Gather Context

### 1a. Load the task breakdown file

If a file path is provided, read it.
If not, search for task/breakdown files in this order:
1. `.ai/tasks/` folder
2. `docs/tasks/` folder
3. Root-level `TASK-*.md` or `task-*.md` files
4. Ask the user to specify the path if none found.

From the task file, extract:
- **Feature name** and purpose
- **Completed tasks** (checked `[x]`)
- **Pending / skipped tasks** (unchecked `[ ]` or `[~]`)
- **Cancelled tasks** and their reasons
- **Key design decisions / deviations** from original plan
- **Open questions / assumptions** still unresolved
- **Definition of Done** checklist status

### 1b. Read the git diff

Run (or ask Claude Code to run):
```bash
git diff HEAD
```

If there are staged changes:
```bash
git diff --cached
```

If comparing to a specific branch:
```bash
git diff main...HEAD
```

Read every changed file. Do not skip files.

### 1c. Read full file content for key changed files

For any file that was significantly changed (not just renamed/moved), read the full current content — not just the diff — to understand context properly.

---

## Step 2 — Cross-Check: Task vs Implementation

For each **completed task** (`[x]`) in the breakdown:

- Find the corresponding code changes in the diff
- Verify the implementation matches what the task described
- Flag any gap: task says X, code does Y

For each **cancelled task** (`[~]`):
- Verify the cancellation is safe — the missing piece doesn't create a gap that will break things in production

For each **pending task** (`[ ]`):
- Note it explicitly — don't assume it's not needed

---

## Step 3 — Expert Technical Review

Review the code as a **senior fullstack architect** who has seen what AI agents typically get wrong. Check every dimension below.

### 3.1 Correctness

- Logic errors, incorrect conditions, off-by-one
- Null reference paths not guarded
- Race conditions in async/concurrent code
- Incorrect fallback or default values
- Missing error handling on I/O operations (file read, network, DB)

### 3.2 Architecture & Design Patterns

- Does the new code fit the existing architecture style (layered, clean, CQRS, etc.)?
- Violations of SOLID principles
- Unnecessary coupling between layers
- Interface/abstraction used where it shouldn't (over-engineering) or missing where it should (under-engineering)
- Dependency injection: wrong lifetime (singleton holding scoped, etc.)

### 3.3 .NET / Language-Specific Issues

*(Adjust for the actual language/stack in use)*

For .NET Core:
- `IOptions<T>` vs `IOptionsSnapshot<T>` vs `IOptionsMonitor<T>` — correct lifetime?
- `IPostConfigureOptions<T>` used correctly vs `IConfigureOptions<T>`?
- `AddSingleton` / `AddScoped` / `AddTransient` lifetime correctness
- `ConfigurationBinder` edge cases: null vs default, missing key behavior
- `Environment.Exit()` in startup — is it intentional and safe?
- `internal` visibility + `InternalsVisibleTo` — only what's necessary?
- Hosting: Kestrel configuration applied at the right point in the pipeline?
- Missing `CancellationToken` propagation in hosted services
- `IHostedService` / `BackgroundService` — proper start/stop lifecycle?

### 3.4 Configuration & Environment

- Hardcoded values that should be config
- Config keys that are inconsistent with existing naming conventions
- Missing validation of required config at startup (fail-fast vs silent default)
- Environment-specific config handled correctly (dev vs prod)
- Secrets or credentials anywhere in code or config files

### 3.5 Logging

- Sensitive data (PII, credentials, full URLs with tokens) logged at Info/Debug level
- Logging too noisy (every iteration) or too silent (key lifecycle events missing)
- Log level appropriate: Debug / Info / Warning / Error / Fatal
- Structured logging fields consistent with existing codebase conventions

### 3.6 Security

- Input not validated before use
- Path traversal risks in file resolution
- Missing authorization checks
- Insecure deserialization
- `Environment.Exit` or process manipulation accessible from user input

### 3.7 Performance

- N+1 patterns, unnecessary repeated reads
- File I/O in hot paths
- Missing caching where data is immutable at startup
- Unbounded collections or allocations in loops
- Synchronous I/O blocking async context (`Result`, `.Wait()`)

### 3.8 Resilience & Fail-fast

- What happens if a required config key is missing? Does it fail fast or silently proceed with a bad default?
- What happens if the config file can't be read? Is the error message actionable?
- What happens if the VM/metrics endpoint is unreachable? Does the worker crash or degrade gracefully?

### 3.9 Maintainability & Code Quality

- Method / class too long or doing too many things
- Naming: does it follow the project's existing convention?
- Magic strings or numbers that should be constants
- Dead code, commented-out blocks left behind
- TODOs that are risks, not just notes

### 3.10 Task-File-Specific Checks

If the task file mentions specific **assumptions** or **open questions**, verify:
- Is the assumption actually implemented the way the task described it?
- Are there open questions that the implementation silently answered with a potentially wrong default?

---

## Step 4 — Produce The Review Report

Save the report as:
```
.ai/reviews/REVIEW-[feature-short-name]-[YYYYMMDD].md
```

Use this exact format:

---

```markdown
# AI Code Review — [Feature Name]

**Date:** [date]
**Reviewer:** Claude (Expert Lead, ROMIO Workflow)
**Task File:** [path to task breakdown file]
**Git Base:** [branch or commit compared against]

---

## 🔎 Executive Summary

One paragraph: what was built, overall quality verdict, key risks.

**Overall Verdict:** ✅ Approved / ⚠️ Approved with fixes / ❌ Blocked — must fix before merge

---

## 📋 Task Completion Matrix

| Task ID | Description | Status in File | Found in Code | Gap / Note |
|---------|-------------|----------------|---------------|------------|
| DM-01   | ...         | ✅ Done        | ✅ Yes        | —          |
| INF-05  | ...         | ✅ Done        | ⚠️ Partial   | Missing X  |
| TEST-01 | ...         | 🚫 Cancelled  | —             | Risk: Y    |

---

## 🚨 Blocking Issues

> Must fix before merge. Each item should become a fix task.

### BLOCK-01: [Short title]

- **File:** `path/to/file.cs` (line ~N)
- **Issue:** [What is wrong]
- **Impact:** [What breaks or risks]
- **Fix:** [Concrete suggestion]

---

## ⚠️ Non-Blocking Issues (Recommended Fixes)

### WARN-01: [Short title]

- **File:** `path/to/file.cs`
- **Issue:** [What is suboptimal]
- **Impact:** [Risk level: Low / Medium]
- **Fix:** [Suggestion]

---

## 💡 Improvement Suggestions (Optional)

Low-priority items, style/naming, future considerations.

---

## ✅ What Was Done Well

Acknowledge good decisions to reinforce them.

---

## 📌 Open Questions Still Unresolved

From the task file's open questions / assumptions — are any of them risky as implemented?

| # | Question | Assumption Used | Risk if Wrong |
|---|----------|-----------------|---------------|
|   |          |                 |               |

---

## 🔨 Release Checklist

- [ ] Build passes (`dotnet build` / `npm run build` / etc.)
- [ ] No secrets or credentials in code
- [ ] Config fail-fast verified (missing config → actionable error)
- [ ] Logging does not expose sensitive data
- [ ] No hardcoded values that belong in config
- [ ] Cancelled tasks reviewed — no production risk gaps
- [ ] Open questions / assumptions documented and accepted
- [ ] All blocking issues resolved
```

---

## Step 5 — Next Steps Prompt

After the report, ask:

> **What would you like to do next?**
>
> 1. `/fix-task BLOCK-01` — generate a fix task for Cursor or Claude Code
> 2. `/fix-task all-blocking` — generate fix tasks for all blocking issues
> 3. `/fix-task WARN-01` — generate a fix task for a warning
> 4. Tell me to fix it directly → I will implement the fix now (say: `fix BLOCK-01 now`)
> 5. Accept and move on → confirm the review is acknowledged

Do not make any code changes until the user responds.
