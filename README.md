# sparc

A local-first Supabase project archive and restore assistant.

Archive as much of a project as supported, collect missing settings through guided forms, and restore into a new project with explicit coverage and verification reports.

## Status

Early feasibility prototype: a shared Rust library and developer CLI can pack, verify and unpack local artifact folders using age encryption, and produce declaration-only offline database plans. **This is not yet a Supabase exporter/restorer or a desktop app. Do not use it as your only backup.**

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

## Try the offline database planner

```sh
PLAN_DEMO="$(mktemp -d)"
cat > "$PLAN_DEMO/declarations.json" <<'JSON'
{"version":1,"connection_mode":"direct","source_major":17,"client_major":17,"destination_major":17}
JSON
target/debug/sparc plan-database "$PLAN_DEMO/declarations.json"
```

This prints a deterministic JSON plan, not SQL or an executable recipe. It reads only the supplied non-secret JSON file; it does not inspect tools, environment credentials or project configuration, connect anywhere, invoke Supabase/PostgreSQL/Docker, create artifacts, or perform export/restore. **A successful exit means valid declarations, not readiness:** every plan has `execution_supported`, `export_ready` and `restore_verified` set to `false`, even with matching majors. Archive integrity is not project recoverability.

Input is strict JSON v1, at most 16 KiB, in a regular non-symlink file. Only the fields shown are allowed. `version` and `connection_mode` are required; mode is `direct`, `session`, `transaction` or `unknown`. Majors may be omitted/null (unknown), or integers 10..=18 (the prototype's accepted range, not a Supabase support guarantee). Do not put credentials, connection strings or real project data in this file. Errors do not echo input values or parser chains. Use stable trusted local paths: concurrent path replacement is not defended against; parent-directory symlinks are allowed.

An older dump client than source violates PostgreSQL's restriction; a newer client is blocked by SPARC's conservative matching-major policy. A destination below source or client is blocked, as is transaction pooling. Direct/session mode and all versions are **declared, never observed**. Feature use remains unknown, never inferred absent. Connectivity/TLS/permissions, Auth/Storage/extension compatibility, Vault keys, side-effect suppression and coherent snapshots remain unverified.

Shared API: `sparc::database::plan_database(&[u8])` and `plan_database_file(&Path)`. See the [bounded implementation plan and retained upstream hazards](docs/plans/2026-09-18-database-feasibility.md) for fixed source provenance, proposed artifacts, exclusions and future live-test gates. In particular, Supabase CLI dry-run is **not** a safe offline probe: it can resolve connections, cause side effects and print passwords.

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
