# Claude Command: .NET Code Review

## Trigger

```
/dotnet-review <file-or-folder>
/dotnet-review                     ← file trong context hiện tại
/dotnet-review <file> --quick      ← chỉ blocking issues
/dotnet-review <file> --security   ← focus security & data leakage
```

---

## Mục tiêu

Review code C# / .NET 6 với tư cách **.NET Principal Engineer** tại Dcorp Vietnam.  
Stack: **.NET 6 · C# 10 · EF Core 6 · Polly v7 · Npgsql · Redis · MediatR**  
Domain: F&B Enterprise — high-throughput POS (~1000 req/s peak), multi-tenant, financial precision.

---

## Bước 1 — Load context

Đọc nếu có:
- `docs/project_overview.md` → architecture, naming, entity names
- `docs/codebase/di-registry.md` → DI lifetimes thực tế
- `docs/codebase/entity-map.md` → domain model

---

## Bước 2 — Chạy 10 lenses

Lenses đầy đủ có trong `11_sk_dotnet_review.mdc` (Cursor skill).

| # | Lens | Severity nếu vi phạm |
|---|------|---------------------|
| L1 | Async Correctness | 🔴/🟡 |
| L2 | EF Core Query Safety | 🔴/🟡 |
| L3 | DI Lifetime | 🔴/🟡 |
| L4 | Exception Handling | 🔴/🟡 |
| L5 | Security & Data Leakage | 🔴/🟡 |
| L6 | Resource Management | 🔴/🟡 |
| L7 | Performance | 🟡/🔵 |
| L8 | Domain Model | 🟡/🔵 |
| L9 | Observability | 🟡/🔵 |
| L10 | .NET 6 Compatibility | 🔴 |

`--quick`: chỉ L1, L2, L3, L4, L5, L10  
`--security`: L5 deep-dive + L1, L4, L10

---

## Bước 3 — Lưu report

Lưu vào `.ai/reviews/DOTNET-REVIEW-[filename]-[DATE].md`

Template:

```markdown
# .NET Code Review — [FileName]
> Reviewer: Claude Code (ROMIO .NET Expert)
> Date: [DATE] · File: [path]
> Stack: .NET 6 · EF Core 6 · Polly v7

## Verdict
| Metric | Value |
|--------|-------|
| 🔴 Blocking | N |
| 🟡 Warning | N |
| 🔵 Note | N |
| ✅ Good patterns | N |
| **Overall** | ✅ APPROVED / ⚠️ NEEDS FIX / 🔴 BLOCKED |

## 🔴 Blocking Issues
### BLOCK-01: [Title]
- **Lens:** L[#] · **File:** `path/file.cs` (line ~N)
- **Found:**
  ```csharp
  [problematic snippet]
  ```
- **Problem:** [tại sao vấn đề]
- **Impact:** [crash / data loss / security breach / ...]
- **Fix:**
  ```csharp
  [corrected snippet]
  ```

## 🟡 Warnings
### WARN-01: [Title]
- **Lens/File/Found/Problem/Risk/Suggestion**

## 🔵 Notes
### NOTE-01: [one-liner]

## ✅ Good Patterns
- `ClassName.Method`: [tại sao tốt]

## 📋 Fix Checklist
- [ ] BLOCK-01: [title]
- [ ] WARN-01: [title] (optional)
```

---

## Bước 4 — Chat summary

```
🔍 .NET Code Review: [FileName]

🔴 Blocking : N issues
🟡 Warning  : N issues
🔵 Note     : N suggestions
✅ Good     : N patterns

Verdict: ✅ APPROVED / ⚠️ NEEDS FIX / 🔴 BLOCKED
Saved: .ai/reviews/DOTNET-REVIEW-[name]-[DATE].md

What next?
  fix BLOCK-01 now        → Claude implements fix
  fix all blocking        → Claude fixes all BLOCK issues
  /fix-task BLOCK-01      → Generate Cursor task for fix
  show BLOCK-01           → Full detail + context
  accept warnings         → Log as TODO, proceed to merge
```

---

## Behavior Rules

1. Không bịa issue — chỉ report thấy trong code. Lens không có issue → `✅ No issues found`.
2. Fix snippet phải compilable .NET 6 / C# 10. Không dùng API từ .NET 7+.
3. `--quick` mode: chỉ BLOCK + tổng WARN count, không detail WARN.
4. F&B context: throughput 1000+ req/s, multi-tenant (StoreId isolation), tiền tệ dùng `decimal`.
5. `float`/`double` cho giá/tiền → tự động escalate lên 🔴 BLOCK (financial precision).
6. Thiếu StoreId filter → tự động escalate lên 🔴 BLOCK (cross-tenant leak).
