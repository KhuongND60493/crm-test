# ROMIO AI Workflow Template

> **Dual-AI development workflow** — Cursor AI + Claude Code làm việc song song với vai trò rõ ràng.  
> Maintained by **Dcorp Vietnam** — Highland Coffee · Golden Gate · F&B Enterprise chains.

---

## Tổng quan

Bộ template này setup toàn bộ môi trường AI cho bất kỳ project nào chỉ với **1 lệnh**.

```
Cursor AI  ──────── Fast Implementer ────────  viết code, tạo TDD, implement tasks
Claude Code ─────── Architect + Reviewer ────  thiết kế, review, quality gate
CodeGraph ──────── Symbol Intelligence ──────  pre-indexed graph, fewer tool calls
                         │
                  Shared knowledge base
                  docs/ · .ai/specs/ · .ai/plans/ · .codegraph/
```

**Yêu cầu:**

| Tool | Version | Cài đặt |
|------|---------|---------|
| Cursor | **≥ 0.43** (đã test trên 3.4.20) | https://cursor.com |
| Claude Code | latest | `npm install -g @anthropic-ai/claude-code` |
| Node.js | ≥ 18 | https://nodejs.org |
| bash | macOS/Linux/Git Bash | có sẵn |

---

## Cài đặt (1 lần duy nhất)

### Bước 1 — Giải nén template ra chỗ cố định

```bash
# Giải nén vào ~/tools/ — KHÔNG đặt trong project
unzip romio-ai-workflow-FULL.zip -d ~/tools/romio-ai-workflow

# Cấu trúc sau khi giải nén:
# ~/tools/romio-ai-workflow/
# ├── init-project.sh       ← script chính
# ├── templates/            ← tất cả file mẫu
# └── README.md
```

### Bước 2 — Cấp quyền thực thi

```bash
chmod +x ~/tools/romio-ai-workflow/init-project.sh
```

### Bước 3 — Chạy trong project của bạn

```bash
# Di chuyển vào project root (nơi có .git/)
cd /path/to/your-project

# Init
~/tools/romio-ai-workflow/init-project.sh
```

Script tự detect nếu project đã có workflow files → hỏi replace hay không.  
Dùng `--force` để skip prompt:

```bash
~/tools/romio-ai-workflow/init-project.sh --force
```

### Bước 4 — Kết quả sau khi chạy

```
your-project/
├── .cursor/
│   └── rules/                          ← Cursor AI rules (MDC format)
│       ├── 000_global.mdc              ← luôn active (global behavior + CodeGraph map)
│       ├── 01_project_overview_generator.mdc
│       ├── 02_tdd_generator.mdc
│       ├── 03_breakdown_generator.mdc
│       ├── 04_implementation.mdc       ← CodeGraph-first exploration
│       ├── 05_quick_task_creator.mdc
│       ├── 06_flow_diagram_generator.mdc
│       ├── 07_report_generator.mdc
│       ├── 08_plan_generator.mdc       ← CodeGraph-first context building
│       ├── 09_dotnet_review.mdc
│       ├── 10_sk_dotnet_impl.mdc
│       └── 11_sk_dotnet_review.mdc
├── .claude/
│   └── commands/                       ← Claude Code slash commands
│       ├── ask.md · spec.md · plan.md  ← plan.md: CodeGraph-first
│       ├── code.md · review.md
│       ├── handoff.md · fix-task.md · generate-cursor-task.md
│       ├── scan-codebase.md            ← updated: CodeGraph relationship note
│       ├── sync-overview.md · review-cursor.md
│       ├── init-ai-workflow.md
│       └── dotnet-review.md
├── .ai/
│   ├── specs/          ← SPEC-*.md (Claude viết)
│   ├── plans/          ← PLAN-*.md (Claude viết)
│   ├── reviews/        ← REVIEW-*.md + DOTNET-REVIEW-*.md
│   ├── tasks/          ← FIX-*.md
│   └── templates/      ← SPEC-template.md · PLAN-template.md
├── docs/
│   ├── tasks/          ← tasks_*.md (cả 2 AI đọc/ghi)
│   ├── tdd/            ← tdd_*.md (Cursor viết)
│   ├── diagrams/       ← flow diagrams
│   ├── reports/        ← HTML reports
│   ├── codebase/       ← entity-map · di-registry · db-schema · api-endpoints
│   ├── KB_INDEX.md     ← updated: CodeGraph là tier 0
│   └── AI_WORKFLOW.md
└── CLAUDE.md                           ← updated: CodeGraph Integration section
```

---

## Setup lần đầu cho project mới

Sau khi `init-project.sh` chạy xong, thực hiện các bước sau **1 lần duy nhất**:

### 1. Cursor: Scan codebase

Mở project trong Cursor, mở Chat (`Cmd+L`), gõ:

```
/generate-overview
```

Cursor scan toàn bộ source code → tạo `docs/project_overview.md`.  
File này là **shared knowledge base** cho cả hai AI.

### 2. Claude Code: Init + Sync

```bash
# Tại project root
claude

# Trong Claude Code chat:
/init-ai-workflow
```

Claude detect project type → điền vào `CLAUDE.md`.

```
/sync-overview
```

Claude đọc `docs/project_overview.md` → sync vào `CLAUDE.md`.

### 3. Claude Code: Scan codebase docs (token saver)

```
/scan-codebase
```

Tạo 4 file compact trong `docs/codebase/` để `/plan` không cần scan source mỗi lần:
- `entity-map.md` — domain entities, relationships
- `di-registry.md` — DI registrations, lifetimes
- `db-schema.md` — tables, migrations
- `api-endpoints.md` — endpoints, auth

### 4. CodeGraph: Index codebase (symbol-level intelligence) ⭐ NEW

```bash
# Cài CodeGraph nếu chưa có
npx @colbymchenry/codegraph

# Trong project root:
codegraph init -i
```

Interactive prompt sẽ hỏi thư mục muốn exclude. Với .NET project nên exclude:
```
bin/
obj/
.vs/
TestResults/
```

Sau khi init xong, `.codegraph/` xuất hiện trong project root.  
**Restart Claude Code** để MCP server load.

```
# Verify trong Claude Code:
/mcp
# → phải thấy "codegraph" trong danh sách
```

Từ đây cả Cursor lẫn Claude Code sẽ **tự động dùng CodeGraph tools** khi detect `.codegraph/`.

---

## Workflow hàng ngày

### Mode A — Feature mới (recommended cho feature lớn)

**Claude thiết kế → Cursor implement → Claude review**

```
Claude Code                           Cursor AI
──────────────────────────────────    ──────────────────────────────────
/ask order-cancellation               
  → Claude hỏi 3-5 câu để hiểu rõ
  → Trả lời xong

/spec
  → Claude viết SPEC-order-cancellation.md
  → Review, nếu OK gõ: APPROVED

/plan
  → CodeGraph explore flow liên quan   (nếu .codegraph/ có)
  → Fallback: đọc docs/codebase/       (nếu chưa có CodeGraph)
  → Claude viết PLAN-order-cancellation.md
  → Review, nếu OK gõ: APPROVED CODE

/generate-cursor-task
  → Tạo docs/tasks/tasks_order-cancellation.md
                                      /implement docs/tasks/tasks_order-cancellation.md
                                        → CodeGraph search → locate files
                                        → Cursor implement từng task
                                        → Tự update checklist [x]

/handoff docs/tasks/tasks_order-cancellation.md
  → Claude review toàn bộ code Cursor viết
  → Xuất .ai/reviews/REVIEW-*.md
```

### Mode B — Bug fix / CRUD đơn giản

```
Cursor AI
──────────────────────────────────
/task fix null reference trong OrderService.CalculateTotal

Cursor:
  → codegraph_search("OrderService")  ← locate file
  → codegraph_impact("CalculateTotal") ← check scope
  → implement fix
  ✅ Done. Commit: fix(orders): handle null items in CalculateTotal
```

### Mode C — Claude làm tất cả

```
/ask → /spec → [APPROVED] → /plan → [APPROVED CODE] → /code → /review
```

### Mode D — Cursor plan + implement

```
Cursor: /plan .ai/specs/SPEC-[name].md
Cursor: /implement docs/tasks/tasks_[name].md
Claude (optional): /handoff docs/tasks/tasks_[name].md
```

---

## Token Economics

### Tier 1 — CodeGraph (tốt nhất, nếu `.codegraph/` có)

```
codegraph_explore("How does OrderCreation work?")
→ 1–3 tool calls · ~55k tokens · 0 file reads
```

Benchmark trên .NET/Java codebases:
- **96% fewer tool calls** vs grep+glob+Read
- **77% faster** exploration

### Tier 2 — Pre-generated docs (fallback)

```
/scan-codebase   (chạy 1 lần ~ N tokens)
       ↓ tạo 4 file compact trong docs/codebase/
/plan  → đọc 4 file nhỏ  ✅ cheap
/plan  → đọc 4 file nhỏ  ✅ cheap
...
```

### Tier 3 — Direct source scan (last resort)

Chỉ khi không có cả CodeGraph lẫn docs/codebase/.

### .NET skills token efficiency

| Scenario | Monolithic skill | Modular (v2+) | Tiết kiệm |
|----------|-----------------|---------------|-----------|
| `/implement` Handler | 4800 tokens | ~900 tokens | **-81%** |
| `/dotnet-review` | 4800 tokens | ~770 tokens | **-84%** |
| Mở file `.cs` | 4800 tokens | ~0 tokens | **-100%** |

---

## CodeGraph Integration Chi Tiết

CodeGraph và `docs/codebase/` **bổ sung cho nhau**, không thay thế:

| | CodeGraph | docs/codebase/*.md |
|---|---|---|
| Granularity | Symbol-level (function, class, method) | Document-level (architectural context) |
| Query | Graph traversal | AI đọc markdown |
| Dùng cho | "X gọi gì?", "impact nếu sửa Y?" | "Pattern nào đang dùng?", "DI đăng ký ở đâu?" |
| Update | Auto (file watcher) | Manual (`/scan-codebase`) |

**Routing guide cho AI:**

| Task | Tool |
|------|------|
| Tìm class/interface theo tên | `codegraph_search` |
| Hiểu feature hoạt động end-to-end | `codegraph_explore` |
| Tìm tất cả usages của interface | `codegraph_find_refs` |
| Impact analysis trước refactor | `codegraph_impact` |
| Architecture conventions, patterns | `docs/project_overview.md` |
| DI registration location | `docs/codebase/di-registry.md` |
| DB schema, migration history | `docs/codebase/db-schema.md` |

---

## .NET Expert Skills (tự động cho project .NET)

### `10_sk_dotnet_impl.mdc` — Implementation standards

Auto-load khi Cursor mở file `.cs`:

| Chủ đề | Những gì được enforce |
|--------|----------------------|
| EF Core 6 | `AsNoTracking()` trên read-only, projection, pagination |
| N+1 prevention | Batch load với `.Contains()` + `.ToLookup()` |
| Async | Không `.Result`/`.Wait()`, CT propagation |
| PostgreSQL | Error code discrimination (UniqueViolation, Deadlock, FK) |
| Polly v7 | Retry + circuit breaker đúng syntax (KHÔNG Polly v8) |
| DI | Không inject Scoped vào Singleton |
| Compat | Cấm: primary constructors, FrozenDictionary, `AddResilienceHandler` |

### `11_sk_dotnet_review.mdc` — 10 Review lenses

```
L1  Async Correctness       L6  Resource Management
L2  EF Core Query Safety    L7  Performance Hotspots
L3  DI Lifetime             L8  Domain Model Integrity
L4  Exception Handling      L9  Observability Quality
L5  Security & Data Leak    L10 .NET 6 Compatibility
```

### `/dotnet-review` — Expert code review

**Trong Cursor hoặc Claude Code:**
```
/dotnet-review src/Application/Orders/CreateOrderHandler.cs
/dotnet-review src/Infrastructure/Persistence/
/dotnet-review src/Application/Orders/ --quick       ← chỉ blocking issues
/dotnet-review src/Api/Controllers/ --security       ← focus security
```

---

## Bảng lệnh đầy đủ

### Claude Code

| Lệnh | Khi nào dùng | Output |
|------|-------------|--------|
| `/init-ai-workflow` | Setup lần đầu | Update `CLAUDE.md` |
| `/sync-overview` | Sau Cursor `/generate-overview` | Update `CLAUDE.md` |
| `/scan-codebase` | 1 lần/milestone | `docs/codebase/*.md` |
| `/ask [topic]` | Bắt đầu feature mới | Requirement clarification |
| `/spec` | Sau `/ask` xong | `.ai/specs/SPEC-[name].md` |
| `/plan` | Sau `APPROVED` | `.ai/plans/PLAN-[name].md` |
| `/generate-cursor-task` | Sau `APPROVED CODE` | `docs/tasks/tasks_[name].md` |
| `/code` | Claude tự implement | Source code |
| `/review` | Sau `/code` | Review report |
| `/handoff [file]` | Cursor implement xong | `.ai/reviews/REVIEW-*.md` |
| `/review-cursor [file]` | Alias của `/handoff` | `.ai/reviews/REVIEW-*.md` |
| `/fix-task [id]` | Từ review findings | `.ai/tasks/FIX-*.md` |
| `/dotnet-review [file]` | Review code C# chuyên sâu | `.ai/reviews/DOTNET-REVIEW-*.md` |

### Cursor AI

| Lệnh | Khi nào dùng | Output |
|------|-------------|--------|
| `/generate-overview` | Lần đầu + sau refactor lớn | `docs/project_overview.md` |
| `/tdd [feature]` | Feature phức tạp | `docs/tdd/tdd_[name].md` |
| `/breakdown [path]` | Từ TDD file | `docs/tasks/tasks_[name].md` |
| `/task [mô tả]` | Bug fix, CRUD đơn giản | `docs/tasks/tasks_[name].md` |
| `/implement [path]` | Implement task | Source code |
| `/plan [spec]` | Cursor tự plan | `docs/tasks/tasks_[name].md` |
| `/flow [mô tả]` | Vẽ flow diagram | `docs/diagrams/[name].md` |
| `/report [feature]` | Báo cáo kỹ thuật | `docs/reports/report_[name].html` |
| `/dotnet-review [file]` | Review code C# | `.ai/reviews/DOTNET-REVIEW-*.md` |

### CodeGraph MCP Tools (trong Claude Code và Cursor)

| Tool | Khi nào dùng |
|------|-------------|
| `codegraph_explore` | Hiểu flow/feature end-to-end |
| `codegraph_search` | Tìm symbol theo tên |
| `codegraph_find_refs` | Tìm tất cả usages |
| `codegraph_impact` | Impact analysis trước refactor |

### Approval keywords

| Gõ | Nghĩa | AI làm gì tiếp |
|----|-------|----------------|
| `APPROVED` | SPEC ok | Claude chạy `/plan` |
| `APPROVED CODE` | PLAN ok | Claude chạy `/code` hoặc `/generate-cursor-task` |
| `proceed` | Bỏ qua hỏi thêm | AI dùng assumptions, tiến hành ngay |
| `fix [id] now` | Fix ngay | Claude implement fix |
| `cursor fix [id]` | Format cho Cursor | Claude xuất Cursor-paste prompt |
| `accept warnings` | Chấp nhận WARN | Log as TODO, proceed |

---

## Cấu trúc template repo

```
romio-ai-workflow/
├── init-project.sh                   ★ Script chính
├── install-ai-workflow.sh            (legacy)
├── install-ai-workflow.ps1           (legacy PowerShell)
├── README.md
├── PROJECT_CONTEXT.md                ← Giải thích chi tiết mọi file
└── templates/
    ├── CLAUDE.md                     → project root/CLAUDE.md  [v3: +CodeGraph section]
    ├── AI_WORKFLOW.md                → docs/AI_WORKFLOW.md
    ├── SPEC-template.md              → .ai/templates/
    ├── PLAN-template.md              → .ai/templates/
    ├── dotnet-expert.md              (legacy reference)
    ├── cursor-rules/                 → .cursor/rules/
    │   ├── 000_global.mdc            ← [v3: +CodeGraph tools map]
    │   ├── 01_project_overview_generator.mdc
    │   ├── 02_tdd_generator.mdc
    │   ├── 03_breakdown_generator.mdc
    │   ├── 04_implementation.mdc     ← [v3: CodeGraph-first exploration]
    │   ├── 05_quick_task_creator.mdc
    │   ├── 06_flow_diagram_generator.mdc
    │   ├── 07_report_generator.mdc
    │   ├── 08_plan_generator.mdc     ← [v3: CodeGraph-first context building]
    │   ├── 09_dotnet_review.mdc
    │   ├── 10_sk_dotnet_impl.mdc
    │   └── 11_sk_dotnet_review.mdc
    ├── commands/                     → .claude/commands/
    │   ├── ask.md · spec.md · code.md · review.md
    │   ├── plan.md                   ← [v3: Tier 1/2/3 token strategy]
    │   ├── scan-codebase.md          ← [v3: +CodeGraph relationship note]
    │   ├── handoff.md · fix-task.md · generate-cursor-task.md
    │   ├── sync-overview.md · review-cursor.md · init-ai-workflow.md
    │   └── dotnet-review.md
    └── docs-kb/                      → docs/ (scaffold)
        ├── KB_INDEX.md               ← [v3: CodeGraph là tier 0]
        ├── project_overview.md
        └── codebase/
            ├── entity-map.md
            ├── di-registry.md
            ├── db-schema.md
            └── api-endpoints.md
```

---

## Lịch sử thay đổi

### v3.0 — CodeGraph Integration

- **New**: CodeGraph MCP integration — pre-indexed symbol graph cho cả Cursor và Claude Code
- **New**: `CLAUDE.md` — thêm **CodeGraph Integration** section với tool routing table
- **New**: `KB_INDEX.md` — CodeGraph là **tier 0** trước tất cả doc reads
- **Update**: `000_global.mdc` — CodeGraph tools map + updated Golden Rule
- **Update**: `04_implementation.mdc` — CodeGraph-first exploration trong Bước 2
- **Update**: `08_plan_generator.mdc` — CodeGraph-first context building trong Bước 2
- **Update**: `plan.md` — Tier 1 (CodeGraph) → Tier 2 (docs/) → Tier 3 (source scan)
- **Update**: `scan-codebase.md` — note giải thích CodeGraph vs docs/ relationship

**Setup CodeGraph sau khi init:**
```bash
npx @colbymchenry/codegraph   # install + configure MCP
codegraph init -i              # index project
# Restart Claude Code → /mcp để verify
```

### v2.0 — Cursor 3.4+ MDC Migration

- **Breaking**: Toàn bộ `.cursor/rules/*.md` → `.mdc` với YAML frontmatter
- **Breaking**: `.cursorrules` removed → `000_global.mdc`
- **New**: `09_dotnet_review.mdc`, `10_sk_dotnet_impl.mdc`, `11_sk_dotnet_review.mdc`
- **New**: `.claude/commands/dotnet-review.md`
- **Improve**: Token usage -81% nhờ modular skill design

### v1.0 — Initial release

- Dual-AI workflow: Cursor + Claude Code
- 8 Cursor rules (01–08) + `.cursorrules` global
- 12 Claude commands
- .NET Core expert skill

---

## FAQ

**Q: CodeGraph không xuất hiện trong `/mcp`?**  
A: Cần restart Claude Code hoàn toàn sau khi cài. Kiểm tra `~/.claude.json` có entry `codegraph` trong `mcpServers` không.

**Q: CodeGraph index file `.cs` bị thiếu?**  
A: Chạy `codegraph sync` trong project root. Hoặc check `.codegraph/` có bị gitignore không — nên gitignore `.codegraph/` để không commit database vào repo.

**Q: Cursor không nhận rules sau khi init?**  
A: Cursor 3.4+ chỉ đọc `.mdc` files. Đảm bảo dùng `init-project.sh` từ bộ v2.0+.

**Q: `10_sk_dotnet_impl.mdc` không tự load?**  
A: Phải có file `.cs` đang mở trong Cursor editor. Globs `**/*.cs` trigger khi file active trong editor tab.

**Q: Dùng cho non-.NET project được không?**  
A: Được. Rules 01–08 language-agnostic. Rules 09–11 chỉ áp dụng cho `.cs` files. CodeGraph hỗ trợ 19+ languages kể cả Java, TypeScript, Python, Go, Rust.

**Q: Chạy init lại có mất data không?**  
A: Không. Files user-generated được bảo vệ: `docs/project_overview.md`, `docs/codebase/*.md` **không bao giờ bị overwrite**.

**Q: CodeGraph và `/scan-codebase` có conflict không?**  
A: Không. CodeGraph lo symbol-level (call graph, references), `/scan-codebase` lo architectural docs (entity map, DI registry). Dùng cả hai cho coverage tốt nhất.

---

*ROMIO AI Workflow v3.0 — Dcorp Vietnam*  
*Stack: .NET 6 · PostgreSQL · Redis · EF Core 6 · Polly v7*  
*Cursor 3.4.20 · Claude Code · MDC format · CodeGraph MCP*
