You are performing a **one-time deep codebase scan** to generate planning documentation.

## Purpose

> 📌 **Token savings contract**
> Sau khi chạy lệnh này, `/plan` và `/implement` đọc 4 file trong `docs/codebase/` thay vì scan source.
> Đọc `docs/codebase/entity-map.md` trước khi implement bất kỳ entity nào.
> Đọc `docs/codebase/di-registry.md` trước khi thêm service/repository mới.
> Đọc `docs/codebase/db-schema.md` trước khi tạo migration mới.
> Đọc `docs/codebase/api-endpoints.md` trước khi thêm endpoint.

> 💡 **CodeGraph + scan-codebase** bổ sung cho nhau, không thay thế nhau:
> - `scan-codebase` → generates **architectural docs** (entity map, DI registry, schema, endpoints)
> - `CodeGraph` → indexes **symbol-level graph** (call chains, references, impact radius)
> - Nếu project đã có `.codegraph/`: chạy `scan-codebase` cho docs architectural,
>   dùng `codegraph_explore` cho symbol exploration trong `/plan` và `/implement`.


`/plan` normally scans source files every time it runs — burning tokens repeatedly.
This command does the scan **once**, writes the results into `docs/codebase/`,
and from then on `/plan` reads those docs instead of the codebase.

```
Without /scan-codebase:          With /scan-codebase:
─────────────────────            ───────────────────────────────────
/plan                            /scan-codebase  ← run once
  → scan Domain/*.cs   🔥        ─────────────────────────────────
  → scan Application/ 🔥         /plan  /plan  /plan  /plan ...
  → scan Infrastructure/ 🔥        → read docs/codebase/  ✅ cheap
  → scan DbContext 🔥               → read docs/codebase/  ✅ cheap
  (every single time)               (all future plans)
```

**When to re-run:** After adding new entities, new services, schema changes,
or any structural change. The user controls when — this command never runs automatically.

---

## How To Use

```
/scan-codebase
/scan-codebase --section entities     ← refresh only entity map
/scan-codebase --section di           ← refresh only DI registry
/scan-codebase --section schema       ← refresh only DB schema
/scan-codebase --section api          ← refresh only API endpoints
```

Running without `--section` refreshes all 4 documents.

---

## Step 1 — Discover Project Structure

Scan the repository root to identify:
- Solution file (`.sln`) — get all project names
- Project files (`.csproj`) — identify which project is Domain / Application / Infrastructure / Web
- Entry point (`Program.cs` or `Startup.cs`)
- `appsettings.json` — note config key structure

Map the folder structure to layers. Record exact folder paths.

If `docs/project_overview.md` already exists, read it first to reuse known layer paths.

---

## Step 2 — Scan and Generate 4 Documents

### Document 1: `docs/codebase/entity-map.md`

**What to scan:**
- All `.cs` files in `*/Domain/Entities/`
- All `.cs` files in `*/Domain/ValueObjects/`
- All `.cs` files in `*/Domain/Enums/`
- All `.cs` files in `*/Domain/Common/` (base classes)
- DbContext file — check `DbSet<T>` declarations

**For each Entity/Aggregate Root, record:**

```markdown
# Entity Map

> Generated: [DATE]
> Re-run: /scan-codebase --section entities

---

## Aggregate Roots & Entities

### [EntityName]
- **File:** `[exact/path/EntityName.cs]`
- **Base class:** `[BaseEntity / BaseAuditableEntity / etc.]`
- **Properties:**
  | Property | Type | Nullable | Notes |
  |----------|------|----------|-------|
  | Id | Guid | No | PK |
  | [field] | [type] | Yes/No | [note if important] |
- **Domain methods:** `[MethodName(params)]`, `[MethodName2]`
- **Navigation properties:** `[PropertyName] → [TargetEntity]` (1:1 / 1:N / N:M)
- **DbSet name in DbContext:** `[DbSetPropertyName]`

---

## Value Objects

### [ValueObjectName]
- **File:** `[path]`
- **Wraps:** [underlying type]
- **Validation:** [brief description]

---

## Enums

### [EnumName]
- **File:** `[path]`
- **Values:** `[Value1]` = [n], `[Value2]` = [n], ...
- **Used in:** [entity names that use this enum]

---

## Base Classes

| Class | File | Purpose |
|-------|------|---------|
| [BaseEntityName] | `[path]` | [what it provides: Id, timestamps, etc.] |
```

---

### Document 2: `docs/codebase/di-registry.md`

**What to scan:**
- `*/Infrastructure/DependencyInjection.cs` (or equivalent)
- `Program.cs` / `Startup.cs` — all `services.Add*()` calls
- Any `*ServiceCollectionExtensions.cs` files

**Record every registration:**

```markdown
# DI Registry

> Generated: [DATE]
> Re-run: /scan-codebase --section di

---

## Singletons
| Interface | Implementation | Registered In |
|-----------|----------------|---------------|
| `I[Name]` | `[ClassName]` | `[file:method]` |

## Scoped
| Interface | Implementation | Registered In |
|-----------|----------------|---------------|
| `I[Name]` | `[ClassName]` | `[file:method]` |

## Transient
| Interface | Implementation | Registered In |
|-----------|----------------|---------------|

## HttpClients (AddHttpClient)
| Interface | Implementation | BaseUrl Config Key |
|-----------|----------------|-------------------|
| `I[Name]` | `[ClassName]` | `[config:key]` |

## HostedServices
| Service | Registered In |
|---------|---------------|

## MediatR
- Registered in: `[file]`
- Assemblies scanned: `[list]`

## DbContext
- Type: `[DbContextName]`
- Provider: [detect from DbContext: MySQL / PostgreSQL / SQLite]
- Pool size: `[n]`
- Registered in: `[file]`

## Pipeline Behaviors (MediatR)
| Behavior | Order | Purpose |
|----------|-------|---------|
| `[BehaviorName]` | [n] | [validation / logging / transaction] |

---

## Where to add new registrations

| Type | File | Method |
|------|------|--------|
| New Repository | `[path/DependencyInjection.cs]` | `AddInfrastructure()` |
| New Service | `[path/DependencyInjection.cs]` | `AddInfrastructure()` |
| New HttpClient | `[path/DependencyInjection.cs]` | `AddInfrastructure()` |
| New HostedService | `[path/Program.cs]` | top-level |
```

---

### Document 3: `docs/codebase/db-schema.md`

**What to scan:**
- Latest migration file in `*/Infrastructure/Migrations/` (only the most recent)
- All `*Configuration.cs` files in `*/Infrastructure/Persistence/Configurations/`
- DbContext `OnModelCreating` method
- Entity files — for column type hints (attributes or fluent config)

**Record the schema:**

```markdown
# Database Schema

> Generated: [DATE]
> Database: [MySQL / PostgreSQL — detect from DbContext / connection string]
> EF Core: [detect from .csproj]
> Re-run: /scan-codebase --section schema

---

## Tables

### [table_name]
- **Entity:** `[EntityName]`
- **EF Config file:** `[path/EntityNameConfiguration.cs]`

| Column | Type | Nullable | Default | Index | Notes |
|--------|------|----------|---------|-------|-------|
| id | [int/bigint/uuid — detect] | NO | [auto_increment / gen_random_uuid()] | PK | |
| [col] | [type] | YES/NO | | | |
| created_at | timestamptz | NO | now() | | |
| row_version | bytea | NO | | | Concurrency token |

**Indexes:**
- `ix_[table]_[col]` on `([col])` — [purpose]

**Foreign Keys:**
- `[col]` → `[other_table].[col]` (ON DELETE [CASCADE/RESTRICT])

---

## Migration History

| Migration | Date | Summary |
|-----------|------|---------|
| `[MigrationName]` | [date] | [what changed] |

---

## Pending Migrations
[None / list if any]

---

## Conventions
- Table names: [snake_case / PascalCase]
- Column names: [snake_case / camelCase]
- Soft delete: [Yes — uses IsDeleted / No]
- Timestamps: [CreatedAt, UpdatedAt on all tables / only some]
- Concurrency: [RowVersion on all / none / specific tables]
```

---

### Document 4: `docs/codebase/api-endpoints.md`

**What to scan:**
- All `*Controller.cs` files in `*/Web/Controllers/` or `*/API/Controllers/`
- `Program.cs` — Minimal API endpoints if any
- Route attributes on controllers and actions
- Request/Response types referenced

```markdown
# API Endpoints

> Generated: [DATE]
> Re-run: /scan-codebase --section api

---

## [ControllerName] — [base route]

### [HTTP METHOD] [/full/route]
- **Action:** `[MethodName]`
- **Request:** `[CommandName / QueryName / inline params]`
- **Response:** `Result<[Type]>` → HTTP [200/201/204]
- **Auth:** `[Authorize(Roles="...")] / [AllowAnonymous] / None`
- **File:** `[exact/path/Controller.cs:line~N]`

---

## Error Response Conventions

| Result | HTTP Status | Response body |
|--------|-------------|---------------|
| `Result.Failure(NotFound)` | 404 | `{ error: "..." }` |
| `Result.Failure(Validation)` | 400 | `{ errors: [...] }` |
| `Result.Failure(Unauthorized)` | 403 | |
| Exception (unhandled) | 500 | `{ error: "Internal..." }` |

---

## Middleware Pipeline (in order)

1. [ExceptionHandlingMiddleware]
2. [AuthenticationMiddleware]
3. [AuthorizationMiddleware]
4. ...
```

---

## Step 3 — Update `docs/project_overview.md`

After generating all 4 documents, update the **Project Info table** in
`docs/project_overview.md` with:
- Confirmed project name
- Confirmed entry point
- Confirmed build/run commands (from `*.csproj` or `README`)
- Link to each generated codebase doc

Add this section if not present:

```markdown
## Codebase Reference Docs

> Generated by `/scan-codebase`. Re-run to refresh after structural changes.

| Doc | Contents | Last Updated |
|-----|----------|--------------|
| `docs/codebase/entity-map.md` | All entities, VOs, enums, base classes | [DATE] |
| `docs/codebase/di-registry.md` | All DI registrations, where to add new ones | [DATE] |
| `docs/codebase/db-schema.md` | Table schema, columns, indexes, migrations | [DATE] |
| `docs/codebase/api-endpoints.md` | All endpoints, auth, request/response types | [DATE] |
```

---

## Step 4 — Report

```
✅ Codebase scan complete

📄 Documents generated:
  docs/codebase/entity-map.md       — [N] entities, [N] value objects, [N] enums
  docs/codebase/di-registry.md      — [N] Singletons, [N] Scoped, [N] HttpClients
  docs/codebase/db-schema.md        — [N] tables, latest migration: [name]
  docs/codebase/api-endpoints.md    — [N] endpoints across [N] controllers

📊 Token savings estimate:
  Files scanned this run  : [N] files (~[N] tokens)
  Files /plan reads now   : 4 doc files (~[N] tokens)
  Estimated saving per /plan: ~[N]% fewer tokens

📌 When to re-run:
  /scan-codebase --section entities  → after adding/modifying entities
  /scan-codebase --section di        → after adding services or changing DI
  /scan-codebase --section schema    → after adding migrations
  /scan-codebase --section api       → after adding/modifying endpoints
  /scan-codebase                     → after major refactor

💡 From now on, /plan reads docs/codebase/ instead of scanning source files.
```
