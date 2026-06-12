You are in the **PLAN phase** của ROMIO AI Workflow.

## Nguyên tắc tiết kiệm token

**Tier 1 — CodeGraph** (nếu `.codegraph/` tồn tại trong project):
```
codegraph_explore("How does [feature] work?") → 1 call, đủ context
codegraph_search("[EntityName]")              → locate file → Read nếu cần
```

**Tier 2 — Pre-generated docs** (fallback nếu không có CodeGraph):
```
SPEC nói cần gì?            Đọc thêm:
────────────────────────    ──────────────────────────────
Thêm/sửa entity             docs/codebase/entity-map.md
Thêm service/repo           docs/codebase/di-registry.md
Thêm/sửa DB schema          docs/codebase/db-schema.md
Thêm/sửa API endpoint       docs/codebase/api-endpoints.md
```

**KHÔNG đọc** source files trực tiếp trừ khi cả hai tier trên đều không có.

---

## Bước 1 — Đọc SPEC trước (chỉ 1 file)

Đọc `.ai/specs/SPEC-[name].md`.

Từ SPEC, trích xuất nhanh:
- **Feature name** → dùng cho tên PLAN file
- **§8 Affected Modules** → biết cần pull docs gì
- **§7 DB changes?** → có thì đọc `db-schema.md`
- **§8 API changes?** → có thì đọc `api-endpoints.md`

---

## Bước 2 — Pull context cần thiết

**Luôn đọc:**
- `docs/project_overview.md` — conventions, folder structure, patterns, **DB provider** (MySQL/PostgreSQL)

**Nếu `.codegraph/` tồn tại — dùng CodeGraph thay file reads:**
```
codegraph_explore("How does [affected feature] work end to end?")
codegraph_search("[EntityName hoặc ServiceName từ §8 SPEC]")
```
→ Sau đó chỉ Read file cụ thể nếu cần full implementation detail.

**Nếu không có CodeGraph — đọc docs/ có điều kiện (dựa vào §8 SPEC):**
- `docs/codebase/entity-map.md` → nếu SPEC có entity/domain changes
- `docs/codebase/di-registry.md` → nếu SPEC thêm service, repository, handler mới
- `docs/codebase/db-schema.md` → nếu SPEC có migration/schema changes
- `docs/codebase/api-endpoints.md` → nếu SPEC thêm/sửa endpoint

Nếu `docs/codebase/` vẫn là stub (chưa có dữ liệu thực):
```
⚠️ docs/codebase/ chưa generate. Chạy /scan-codebase trước để tiết kiệm token.
   Tiếp tục ngay? (y = plan với codebase scan trực tiếp | n = dừng để scan trước)
```

---

## Bước 3 — Viết PLAN (lean format, 5 sections)

**Triết lý**: PLAN là instruction cho Cursor, không phải document cho con người đọc.
Cursor cần: file paths + steps + DI location + .NET 6 constraints.
Cursor **không cần**: architecture philosophy, risk tables, rollback plans (đó là SPEC/review job).

Save as: `.ai/plans/PLAN-[short-name].md`

```markdown
# PLAN-[short-name]

> SPEC: `.ai/specs/SPEC-[short-name].md`
> Date: [DATE]

---

## 1. Files thay đổi

| File | Action | Ghi chú |
|------|--------|---------|
| `[exact/path/ClassName.cs]` | Create | |
| `[exact/path/Other.cs]` | Modify | Thêm method `XxxAsync()` |

> Paths lấy từ docs/codebase/ và docs/project_overview.md.
> Không dùng placeholder — phải là đường dẫn thực tế.

---

## 2. Steps (theo thứ tự dependency)

**[DB-01]** Migration `[MigrationName]` *(chỉ nếu có DB changes)*
- File: `[InfraProject]/Migrations/` — auto-generated
- Command: `dotnet ef migrations add [Name] --project [InfraProject]`
- Thay đổi: [table/column/index]

**[DM-01]** [Create/Modify] `[EntityName]`
- File: `[exact path]`
- [Nội dung cụ thể: thêm property X, method Y]

**[APP-01]** Create `[CommandName]` record
- File: `[exact path]`
- Properties: [list ngắn]

**[APP-02]** Implement `[HandlerName]`
- File: `[exact path]`
- Inject: `[I...]`, `[I...]`
- Logic: [3-5 bullet points cụ thể]

**[APP-03]** Create `[ValidatorName]`
- File: `[exact path]`
- Rules: [list ngắn]

**[INF-01]** [Add method / Register service]
- File: `[exact path]`
- [Chi tiết]

**[API-01]** [Add action to Controller] *(chỉ nếu có API changes)*
- File: `[exact path]`
- Route: `[METHOD] [/path]`

---

## 3. DI Registration

> Lấy từ docs/codebase/di-registry.md

- File: `[exact/path/DependencyInjection.cs]`
- Method: `[AddXxx()]`
- Thêm: `services.[AddScoped/AddSingleton]<[IInterface], [Implementation]>()`

---

## 4. DB/API/Config changes

**Migration** *(nếu có)*: `[MigrationName]` — xem Step DB-01

**API** *(nếu có)*: `[METHOD] /[route]` — xem Step API-01

**Config** *(nếu có)*: Key `[Section:Key]` = `[default value]`

Nếu không có gì: "No DB/API/Config changes."

---

## 5. Cursor Notes

> Paste section này vào đầu chat Cursor trước khi /implement.

- Pattern: follow `[ExistingCommandName]` tại `[reference file path]`
- DI: đăng ký tại `[file]` trong method `[AddXxx]`
- KHÔNG sửa: `[file 1]`, `[file 2]` — out of scope
- .NET 6: không primary constructors, không `[..]` collection expr
- Polly: dùng `WaitAndRetryAsync` (Polly v7), không `AddResiliencePipeline`
- EF: dùng `.AsNoTracking()` cho read queries, project sang DTO sớm
```

---

## Bước 4 — Confirm

> **PLAN saved:** `.ai/plans/PLAN-[short-name].md`
>
> Approve? Reply `APPROVED CODE` để generate Cursor tasks.
