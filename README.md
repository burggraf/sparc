# sparc

A local-first Supabase project archive and restore assistant.

Archive as much of a project as supported, collect missing settings through guided forms, and restore into a new project with explicit coverage and verification reports.

## Status

Planning and feasibility stage. No application release or verified recovery implementation yet.

See the [high-level product plan](docs/plans/2026-09-18-supabase-project-archive-design.md) for scope, automation limits, encryption, manual collection, restore safety, and the delivery roadmap.

## Direction

- **Desktop:** Tauri 2, macOS first.
- **UI:** React + TypeScript + Vite SPA with shadcn/ui.
- **Engine:** Shared Rust core with a thin CLI.
- **Privacy:** Local-first execution and full archive encryption by default.
- **Safety:** Restore to new, empty projects; explicitly report missing or non-exportable material.

The first milestone is a recovery feasibility proof that works without access to the source project, before building the full GUI.

Keep real credentials, archives, and recovery keys outside this public repository. Live Supabase testing requires explicitly authorized disposable projects.
