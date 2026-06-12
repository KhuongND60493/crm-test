# Knowledge Base Index

> File này giúp Cursor AI và Claude Code **tìm đúng tài liệu** trước khi làm việc.
> Cập nhật file này mỗi khi thêm tài liệu mới vào `docs/`.

---

## Đọc theo thứ tự này

| Thứ tự | File | Đọc khi nào |
|--------|------|-------------|
| 0 | **CodeGraph MCP** (`codegraph_explore`) | **Ưu tiên đầu tiên** nếu `.codegraph/` tồn tại — symbol-level exploration |
| 1 | `docs/project_overview.md` | **Luôn luôn** — architecture, patterns, conventions |
| 2 | `docs/codebase/entity-map.md` | Khi cần tên entity, property, relationship thực tế |
| 3 | `docs/codebase/di-registry.md` | Khi cần biết đăng ký DI ở đâu, lifetime nào |
| 4 | `docs/codebase/db-schema.md` | Khi feature có DB/migration changes |
| 5 | `docs/codebase/api-endpoints.md` | Khi feature thêm/sửa API endpoint |
| 6 | `docs/AI_WORKFLOW.md` | Khi cần hiểu workflow Cursor ↔ Claude |
| 7 | `docs/domain/` | Business domain docs thêm (nếu có) |
| 8 | `docs/decisions/` | Architecture Decision Records |
| 9 | `docs/tdd/` | TDD documents (Cursor tạo) |
| 10 | `docs/tasks/` | Task checklists (cả hai AI đọc/ghi) |

---

## Cấu trúc `docs/`

```
docs/
├── KB_INDEX.md                    ← File này — index của knowledge base
├── project_overview.md            ← ★ QUAN TRỌNG NHẤT — đọc trước mọi thứ
├── AI_WORKFLOW.md                 ← Workflow Cursor ↔ Claude Code
│
├── codebase/                      ← ★★ Pre-generated codebase docs (token saver)
│   ├── entity-map.md              ← Tất cả entities, VOs, enums (generate 1 lần)
│   ├── di-registry.md             ← Tất cả DI registrations (generate 1 lần)
│   ├── db-schema.md               ← Table schema, columns, indexes (generate 1 lần)
│   └── api-endpoints.md           ← Tất cả endpoints (generate 1 lần)
│
├── domain/                        ← Business domain docs thêm (tùy chọn)
│   └── [domain-name].md
│
├── api/                           ← API contracts chi tiết (tùy chọn)
│   └── [feature]-api.md
│
├── decisions/                     ← Architecture Decision Records
│   └── ADR-[NNN]-[topic].md
│
├── tdd/                           ← Technical Design Documents (Cursor tạo)
│   └── tdd_[feature].md
│
├── tasks/                         ← Task checklists (cả hai AI đọc/ghi)
│   └── tasks_[feature].md
│
├── diagrams/                      ← Mermaid flow diagrams (Cursor tạo)
│   └── [feature]-flow.md
│
└── reports/                       ← HTML reports (Cursor tạo)
    └── report_[feature]_[date].html
```

---

## Rules cho cả hai AI

### CodeGraph (ưu tiên cao nhất nếu `.codegraph/` tồn tại)
- **Thay thế grep/glob/Read** khi cần tìm symbol, trace flow, hoặc impact analysis
- `codegraph_explore` → hiểu flow end-to-end (1 call thay vì 10-20 file reads)
- `codegraph_search` → tìm file path của class/interface (rồi mới Read nếu cần full content)
- `codegraph_impact` → trước khi refactor bất kỳ public method nào
- **Không thay thế** `docs/codebase/*.md` cho architectural context

### Claude Code (`/ask`, `/spec`, `/plan`)
- `/ask` — **không đọc file nào**, chỉ hỏi user
- `/spec` — đọc `docs/project_overview.md` + `docs/codebase/entity-map.md`
- `/plan` — **CodeGraph first** nếu available; fallback: đọc `docs/codebase/`
  → **không scan source files** nếu CodeGraph hoặc docs đã có
- Ghi SPEC → `.ai/specs/` | PLAN → `.ai/plans/` | Review → `.ai/reviews/`

### Cursor AI (`/implement`, `/tdd`, `/flow`)
1. **Nếu `.codegraph/` tồn tại**: dùng `codegraph_search` để locate files, `codegraph_explore` để hiểu context
2. **Bắt buộc** đọc `docs/project_overview.md` + `docs/codebase/entity-map.md` trước implement
3. Đọc task file trong `docs/tasks/` để biết scope
4. Ghi TDD → `docs/tdd/` | Task files → `docs/tasks/` | Diagram → `docs/diagrams/`

---

## Quy tắc cập nhật knowledge base

| Sự kiện | Action |
|---------|--------|
| Thêm/sửa entity | `/scan-codebase --section entities` |
| Thêm service/repository mới | `/scan-codebase --section di` |
| Thêm migration | `/scan-codebase --section schema` |
| Thêm/sửa API endpoint | `/scan-codebase --section api` |
| Refactor lớn | `/scan-codebase` (full refresh) |
| Thay đổi architecture | `/scan-codebase` + tạo `docs/decisions/ADR-[NNN].md` |
| Lần đầu setup project | `/scan-codebase` sau khi Cursor chạy `/generate-overview` |
