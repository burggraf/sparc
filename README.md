# sparc

A local-first Supabase project archive and restore assistant.

Archive as much of a project as supported, collect missing settings through guided forms, and restore into a new project with explicit coverage and verification reports.

## Status

Early feasibility prototype: a shared Rust library and developer CLI can pack, verify and unpack local artifact folders using age encryption. **This is not yet a Supabase exporter/restorer or a desktop app. Do not use it as your only backup.**

See the [high-level product plan](docs/plans/2026-09-18-supabase-project-archive-design.md), [prototype implementation plan](docs/plans/2026-09-18-local-archive-prototype.md), and [experimental archive format and security limits](docs/archive-prototype.md).

## Direction

- **Desktop:** Tauri 2, macOS first.
- **UI:** React + TypeScript + Vite SPA with shadcn/ui.
- **Engine:** Shared Rust core with a thin CLI.
- **Initial validation target:** Databases up to 10 GB and stored files up to 100 GB; not yet benchmarked or verified.
- **Privacy:** Local-first execution and full archive encryption by default.
- **Safety:** Restore to new, empty projects; explicitly report missing or non-exportable material.

## Try the local prototype

Requires Rust 1.91 or later. No Docker, Node, Supabase account, or separate age executable is needed for these commands.

```sh
cargo build --locked
DEMO="$(mktemp -d)"
mkdir "$DEMO/source"
printf '%s\n' '-- synthetic SQL fixture; never executed' > "$DEMO/source/data.sql"
RECIPIENT="$(target/debug/sparc keygen "$DEMO/recovery.agekey")"
target/debug/sparc pack "$DEMO/source" "$DEMO/archive" "$RECIPIENT"
target/debug/sparc verify "$DEMO/archive" "$DEMO/recovery.agekey"
target/debug/sparc unpack "$DEMO/archive" "$DEMO/restored" "$DEMO/recovery.agekey"
```

The recovery key file is **unencrypted**: protect it separately. Output directories must not already exist. Files are restored locally, not to Supabase. An interrupted operation can leave partial output; resumable transfers and the GUI are not implemented yet.

## Checks

```sh
cargo fmt --check
cargo test --locked
cargo clippy --locked --all-targets -- -D warnings
# Optional independent interoperability check: requires the Go age CLI on PATH.
cargo test --locked --test age_interop -- --ignored
```

Tests use synthetic temporary files, including restoration after removal of the source folder. They make no network calls. Passing them does not prove Supabase completeness, live recovery, or the target size envelope.

Keep real credentials, archives, and recovery keys outside this public repository. Live Supabase testing requires explicitly authorized disposable projects and a cost ceiling. Work directly on `main`, without worktrees, per the project owner's instruction.
