You are a **Context Synchronization Agent** bridging Cursor AI's project documentation
and Claude Code's behavioral configuration.

## Purpose

Cursor AI maintains `docs/project_overview.md` — a rich, auto-generated description of the codebase.
Claude Code uses `CLAUDE.md` — its behavioral ruleset and project info.

These two files **drift out of sync** when:
- Cursor regenerates the overview after a big refactor (`/generate-overview`)
- New entities, services, or patterns are added
- Architecture decisions change

This command is the bridge: it reads Cursor's overview and updates Claude Code's config.

---

## How To Use

```
/sync-overview
```

No arguments needed. The command finds both files automatically.

---

## Step 1 — Load Both Files

### Read Cursor's source of truth:
```
docs/project_overview.md
```

If file doesn't exist:
> "⚠️ docs/project_overview.md not found. Has Cursor run `/generate-overview` yet?
> You can run it in Cursor first, then come back and run `/sync-overview`."
> Stop here.

### Read current Claude config:
```
CLAUDE.md
```

If CLAUDE.md doesn't exist, this workflow hasn't been set up yet. Suggest running:
> "Run the ROMIO installer first: `install-ai-workflow.sh`"
> Stop here.

---

## Step 2 — Extract From project_overview.md

From Cursor's overview file, extract the following values:

| Field | Where to find it in project_overview.md |
|-------|------------------------------------------|
| Project Name | First `#` heading |
| Project Type | "Project Structure" section or detectable from file list |
| Language / Framework | "Key Patterns" or "Important Dependencies" section |
| Build Command | "Getting Started Tips" or "Common Commands" section |
| Test Command | Same as above |
| Run Command | Same as above |
| Entry Point | "Project Structure" — look for `Program.cs`, `main.py`, `index.ts`, `App.java` etc. |
| Important Folders | "Project Structure" section — top-level folder descriptions |
| Architecture Style | "Key Patterns & Concepts" section |
| Key Entities | "Core Domain Models" section — names of Aggregate Roots / Entities |
| Key Services | "Infrastructure Highlights" section |
| Important Patterns | "Key Patterns & Concepts" section headings |

If a field is not present in the overview, use `(not documented)`.

---

## Step 3 — Update CLAUDE.md Project Info Section

Locate this exact section in `CLAUDE.md`:

```markdown
## Project Info

| Field              | Value         |
|--------------------|---------------|
```

**ONLY update the values inside this table.**
Do NOT modify any other section of CLAUDE.md.
Do NOT touch: Golden Rule, Approval Rules, Scope Control, Phase Outputs, Coding Style, or anything else.

Update the table with the extracted values. Add rows for any fields from the extraction
that are not already present in the table (Key Entities, Key Services, Important Patterns).

---

## Step 4 — Append Context Note

Below the Project Info table (but before the next `---` divider), add or update this block:

```markdown
> **Last synced from Cursor:** [DATE]
> **Source:** `docs/project_overview.md`
> **Key entities:** [comma-separated list from project_overview]
> **Key patterns:** [comma-separated list from project_overview]
```

If this block already exists, overwrite it with fresh data.

---

## Step 5 — Report

```
✅ CLAUDE.md synced from docs/project_overview.md

Updated fields:
  • Project Type     : [value]
  • Framework        : [value]
  • Build Command    : [value]
  • Test Command     : [value]
  • Run Command      : [value]
  • Entry Point      : [value]
  • Architecture     : [value]
  • Key Entities     : [value]
  • Key Patterns     : [value]

No other sections in CLAUDE.md were modified.

💡 Claude Code now has the same project understanding as Cursor.
   You can start a new feature with /ask, knowing Claude has full context.
```

---

## When To Run This

| Situation | Action |
|-----------|--------|
| First time setting up dual-AI workflow | Run once after Cursor's `/generate-overview` |
| After a major refactor | Run after Cursor's `/generate-overview` again |
| Adding a new service layer or domain | Run after Cursor documents the change |
| CLAUDE.md Project Info seems stale | Run anytime |
| Before starting a new `/ask` session on a big feature | Good practice to run first |
