# ROMIO AI Workflow

> Maintained by Dcorp Vietnam engineering team.
> For setup, see: `romio-ai-workflow-template`

---

## 1. The Two-AI Philosophy

This project uses **Cursor AI** and **Claude Code** as a pair — each doing what it's best at:

```
┌─────────────────────────────┐    ┌──────────────────────────────────┐
│        CURSOR AI            │    │         CLAUDE CODE              │
│   "The Fast Implementer"    │    │   "The Thoughtful Architect"     │
├─────────────────────────────┤    ├──────────────────────────────────┤
│ • Writes code fast          │    │ • Clarifies requirements (/ask)  │
│ • Stays inside the editor   │    │ • Designs solutions (/spec/plan) │
│ • Follows task checklists   │    │ • Reviews Cursor's output        │
│ • /implement rule           │    │ • Quality gate before merge      │
│ • /flow, /report, /tdd      │    │ • /handoff, /review-cursor       │
└─────────────────────────────┘    └──────────────────────────────────┘
           │                                      │
           └──────────────┬───────────────────────┘
                          │
              Shared: docs/tasks/*.md
                      docs/project_overview.md
                      .ai/specs/*.md
                      .ai/plans/*.md
```

---

## 2. Workflow Modes — Which To Use When?

### Mode A — "Claude designs, Cursor builds" (recommended for new features)

Best for: Medium-large features that need design review before coding.

```
PHASE         │ AI      │ Command
──────────────┼─────────┼────────────────────────────────────────────
Clarify req   │ Claude  │ /ask
Write SPEC    │ Claude  │ /spec        → .ai/specs/SPEC-[name].md
Write PLAN    │ Claude  │ /plan        → .ai/plans/PLAN-[name].md
              │         │   ↓ User: APPROVED CODE
Convert task  │ Claude  │ /generate-cursor-task  → docs/tasks/tasks_[name].md
Implement     │ Cursor  │ /implement docs/tasks/tasks_[name].md
Review        │ Claude  │ /handoff docs/tasks/tasks_[name].md
Fix (if any)  │ Cursor  │ paste Claude's "Cursor Prompt" into Cursor
              │ or      │
              │ Claude  │ fix [id] now
Merge         │ Human   │ ✅
```

---

### Mode B — "Cursor builds, Claude reviews" (for ad-hoc tasks)

Best for: Quick tasks, bug fixes, or when Cursor has already done the work
(e.g., using Cursor's own `/task` or `/tdd` rules).

```
PHASE         │ AI      │ Command
──────────────┼─────────┼────────────────────────────────────────────
Create task   │ Cursor  │ /task [description]  OR  /tdd + /breakdown
Implement     │ Cursor  │ /implement docs/tasks/tasks_[name].md
Review        │ Claude  │ /review-cursor docs/tasks/tasks_[name].md
              │         │   OR (simpler alias):
              │ Claude  │ /handoff docs/tasks/tasks_[name].md
Fix (if any)  │ Cursor  │ cursor fix [BLOCK-01]
              │ or      │
              │ Claude  │ fix [id] now
Merge         │ Human   │ ✅
```

---

### Mode C — "Claude only" (for critical or complex logic)

Best for: Security-sensitive code, complex business logic, architecture changes
where you want maximum oversight.

```
PHASE         │ AI      │ Command
──────────────┼─────────┼────────────────────────────────────────────
Clarify req   │ Claude  │ /ask
Write SPEC    │ Claude  │ /spec
Write PLAN    │ Claude  │ /plan
Implement     │ Claude  │ /code         (requires APPROVED CODE)
Review        │ Claude  │ /review
Merge         │ Human   │ ✅
```

---

## 3. Shared File Contract

Both AIs read and write to the same `docs/` and `.ai/` folders.
This is what makes them interoperable.

```
project-root/
│
├── CLAUDE.md                         ← Claude's behavior config
│                                        Run /sync-overview to update from Cursor
│
├── docs/
│   ├── project_overview.md           ← Cursor writes this (/generate-overview)
│   │                                    Claude reads this (/sync-overview)
│   ├── tasks/
│   │   └── tasks_[feature].md        ← Both read and write
│   ├── diagrams/
│   │   └── [feature]-flow.md         ← Cursor writes (/flow)
│   └── reports/
│       └── report_[feature].html     ← Cursor writes (/report)
│
└── .ai/
    ├── specs/
    │   └── SPEC-[feature].md         ← Claude writes (/spec)
    ├── plans/
    │   └── PLAN-[feature].md         ← Claude writes (/plan)
    ├── tasks/
    │   └── FIX-[id]-[name].md        ← Claude writes (/fix-task)
    └── reviews/
        └── REVIEW-[feature]-[date].md ← Claude writes (/handoff, /review-cursor)
```

---

## 4. Keeping The Two AIs In Sync

**Problem:** Cursor maintains `docs/project_overview.md`. Claude maintains `CLAUDE.md`.
They can drift out of sync after refactors.

**Solution:** Run `/sync-overview` in Claude Code after Cursor updates the project overview.

```bash
# In Cursor:
/generate-overview          # Cursor scans codebase, updates docs/project_overview.md

# In Claude Code:
/sync-overview              # Claude reads project_overview.md, updates CLAUDE.md Project Info
```

---

## 5. Full Command Reference

### Claude Code Commands

| Command | When to use | Output |
|---------|------------|--------|
| `/init-ai-workflow` | First-time setup | Creates all folders, detects project type |
| `/sync-overview` | After Cursor's `/generate-overview` | Updates CLAUDE.md from project_overview.md |
| `/ask` | Starting any feature | Requirement clarification doc |
| `/spec` | After /ask | `.ai/specs/SPEC-[name].md` |
| `/plan` | After APPROVED | `.ai/plans/PLAN-[name].md` |
| `/generate-cursor-task` | After APPROVED CODE | `docs/tasks/tasks_[name].md` (Cursor format) |
| `/code` | After APPROVED CODE (Claude implements) | Source code + Implementation Summary |
| `/review` | After /code (self-review) | AI Code Review |
| `/handoff [task-file]` | After Cursor finishes | Full expert review + REVIEW-*.md |
| `/review-cursor [task-file]` | Same as /handoff, explicit name | Full expert review |
| `/fix-task [id]` | After /handoff finds issues | `FIX-[id]-[name].md` task file |

### Cursor AI Commands (for reference)

| Command | When to use | Output |
|---------|------------|--------|
| `/generate-overview` | First time or after big refactor | `docs/project_overview.md` |
| `/tdd [feature]` | Complex feature needing design | `docs/tdd/tdd_[feature].md` |
| `/breakdown [tdd-path]` | After TDD approved | `docs/tasks/tasks_[feature].md` |
| `/task [description]` | Quick tasks, bug fixes | `docs/tasks/tasks_[feature].md` |
| `/implement [tasks-path]` | After task file exists | Source code, updates checklist |
| `/flow [description]` | Visualizing a flow | `docs/diagrams/[flow].md` |
| `/report [files]` | Sprint review, documentation | `docs/reports/report_[name].html` |

---

## 6. Approval Words

| Word | Meaning | Next step |
|------|---------|-----------|
| `APPROVED` | SPEC is approved | Run /plan |
| `APPROVED CODE` | PLAN is approved (Claude implements) | Claude runs /code |
| `APPROVED CODE` | PLAN is approved (Cursor implements) | Claude runs /generate-cursor-task |
| `yes` / `y` | Confirm a single action | Proceed |
| `proceed` | Skip clarifying questions, use assumptions | Proceed with stated assumptions |

---

## 7. Decision Guide — Which AI Does What?

| Task | Use Cursor | Use Claude |
|------|-----------|-----------|
| Writing CRUD boilerplate fast | ✅ | |
| Designing a complex feature | | ✅ |
| Writing a migration | ✅ | |
| Reviewing critical business logic | | ✅ |
| Generating flow diagrams | ✅ | |
| Security review | | ✅ |
| Writing unit tests | ✅ | |
| Architecture decisions | | ✅ |
| HTML reports for stakeholders | ✅ | |
| Detecting scope violations | | ✅ |
| Fast bug fixes | ✅ | |
| Reviewing Cursor's output | | ✅ |

---

*ROMIO AI Workflow — Dcorp Vietnam*
*Serving Highland Coffee, Golden Gate, and enterprise F&B chains.*
