Initialize or repair the **ROMIO AI Workflow** in this repository.

## Important

- Do NOT change any application source code.
- Do NOT modify business logic, configurations, or build files.
- Only inspect the repository and create/update AI workflow files.

---

## Tasks

### Step 1 — Check Existing Workflow Paths

Verify whether these paths exist in the current working directory:

| Path                        | Status |
|-----------------------------|--------|
| `CLAUDE.md`                 |        |
| `.ai/requirements/`         |        |
| `.ai/specs/`                |        |
| `.ai/plans/`                |        |
| `.ai/prompts/`              |        |
| `.ai/templates/`            |        |
| `.claude/commands/`         |        |
| `docs/AI_WORKFLOW.md`       |        |

If any path is missing, create it.

---

### Step 2 — Detect Project Type

Scan the repository root for the following files and infer the project type:

| File(s)                                  | Project Type        |
|------------------------------------------|---------------------|
| `*.sln`, `*.csproj`                      | .NET / .NET Core    |
| `package.json`                           | Node.js / TypeScript|
| `pom.xml`                                | Java / Maven        |
| `build.gradle`, `settings.gradle`        | Java / Gradle       |
| `requirements.txt`, `pyproject.toml`     | Python              |
| `go.mod`                                 | Go                  |
| `Cargo.toml`                             | Rust                |
| Multiple of the above                    | Monorepo / Mixed    |

Also check for:
- `Dockerfile` or `docker-compose.yml` → containerized environment
- `*.yaml`/`*.yml` in `.github/workflows/` or `.gitlab-ci.yml` → CI/CD pipeline
- `README.md` → read for project name and any documented commands

---

### Step 3 — Detect Build / Test / Run Commands

Based on the detected project type, fill in the standard commands.
If custom commands are found in `package.json` scripts, Makefile, or README, use those instead.

| Field              | Detected Value |
|--------------------|----------------|
| Build Command      |                |
| Test Command       |                |
| Run Command        |                |
| Main Entry Point   |                |
| Important Folders  |                |

---

### Step 4 — Update CLAUDE.md Project Info Section

Update **only** the "Project Info" table in `CLAUDE.md` with the detected values.
Do NOT modify any other section of `CLAUDE.md`.

If `CLAUDE.md` does not exist, create it from the standard ROMIO template.

---

### Step 5 — Output Report

Produce the following report:

```
# ROMIO AI Workflow Initialization Report

## 1. Detected Project Type

[project type + detected indicators]

## 2. Detected Commands

| Field         | Command |
|---------------|---------|
| Build         |         |
| Test          |         |
| Run           |         |
| Entry Point   |         |

## 3. Important Files / Folders Found

List key files discovered (sln, csproj, package.json, Dockerfile, etc.)

## 4. Created Paths

List every folder and file that was created during this initialization.

## 5. Updated Files

List every file that was updated (e.g., CLAUDE.md Project Info section).

## 6. Recommended Next Command

To start your first task, run:

/ask
```

---

If anything is unclear or the project structure is unusual, describe the anomaly in the report and ask the user for clarification before proceeding.
