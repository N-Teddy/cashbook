## Folder + file structure

This is the structure we’ll use going forward. It keeps UI features separate from platform/native concerns, and keeps persistence logic in Rust (SQLite) with a thin TypeScript invoke layer.

### Frontend (`src/`)
- `src/components/`: reusable UI building blocks (shell, buttons, cards, form parts)
- `src/features/`: feature modules (each has UI + local domain logic)
  - `src/features/dashboard/`
  - `src/features/transactions/`
  - `src/features/debts/`
  - `src/features/settings/`
- `src/lib/`: shared utilities (no feature ownership)
  - `src/lib/tauri.ts`: typed wrappers for Tauri commands (`invoke`)
- `src/styles.css`: Tailwind v4 entry + base styles

### Tauri / Rust (`src-tauri/`)
- `src-tauri/migrations/`: SQL migrations (versioned)
  - `0001_init.sql`
- `src-tauri/src/db/`: SQLite open/init/migrate and DB state
- `src-tauri/src/error.rs`: typed errors (DB/filesystem/etc.)
- `src-tauri/src/lib.rs`: Tauri builder + command registration + app setup

### Docs (`docs/`)
- `docs/IMPLEMENTATION_PLAN.md`: the implementation plan you approved
- `docs/STRUCTURE.md`: this structure reference

