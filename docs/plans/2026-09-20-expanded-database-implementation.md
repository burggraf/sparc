# Combined Database Rehearsal Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Prepare and verify one bounded synthetic rehearsal covering application schema dependencies, custom roles/default privileges and migration-history preservation, without treating history statements as executable migrations.

**Architecture:** Preserve the proven v1 fixture and adapter unchanged. Add a small developer-only metadata contract for two fixed NOLOGIN roles and migration rows, with offline validation before any SQL generation. Then prepare a fixed v2 fixture and parent-owned capture/restore procedure; no generic role-dump parser or desktop connection UI.

**Tech Stack:** Python standard library/unittest, native PostgreSQL 17, pinned upstream schema/data scripts, SPARC age archives.

---

Work on main, no worktrees, one writer. This plan is not hosted mutation authorization. Deliver all three coverage areas together, with separate acceptance checks.

## Task 1: Strict role/history contract (offline)

Create `scripts/expanded_metadata.py` and `tests/expanded_metadata_test.py`.

1. Add failing tests for an exact versioned JSON contract containing roles, memberships and history. Reject duplicate/unknown fields, malformed UTF-8, invalid JSON constants, booleans as versions, oversize input, unexpected role attributes, reserved roles, non-allowlisted membership edges, duplicate migration versions, NUL/surrogate text and malformed arrays.
2. Support exactly `sparc_rehearsal_reader` and `sparc_rehearsal_member`, NOLOGIN, no superuser/createdb/createrole/replication/bypassrls; INHERIT. Only reader -> member membership, no admin option; membership inherit/set flags explicit. No passwords or arbitrary settings.
3. Preserve migration `version`, nullable `name`, nullable `statements` array and nullable elements exactly. Versions are bounded decimal strings; rows must be unique and sorted. Fixed table shape is version text PK, name text nullable, statements text[] nullable. Seed-file history is not covered and must be absent for this fixture.
4. Run `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'expanded_metadata_test.py' -v`; observe RED before implementation, then GREEN. Validation errors must be bounded and must not echo archive contents.

## Task 2: Non-replaying history SQL and role refusal (offline)

Same files.

1. Add failing tests proving generated SQL is derived only from validated metadata, role collisions are refused before CREATE, no reserved roles are altered, and migration statements appear only in safely encoded data.
2. Use PostgreSQL `decode(hex, 'hex')` + `convert_from(..., 'UTF8')` for a validated JSON payload and `jsonb_array_elements` to insert nullable values, preserving array element order. Do not interpolate untrusted identifiers or emit the archived statements as SQL. Explicitly preserve NULL array versus empty array.
3. Generated fragments must be transaction-only (caller owns BEGIN/COMMIT), set safe transaction-local string handling where needed, refuse an existing migration schema rather than merging history, and create only the pinned three-column history table.
4. Test a failing SQL statement, psql meta-command text, quotes, backslashes, Unicode and newline as inert history values. Textual checks prove generation boundaries only; actual PostgreSQL proof remains pending.

## Task 3: Exact live-scope proposal (no live writes)

Document fixed additions to existing `sparc_rehearsal`: enum `note_state` (draft/published), table `recovery_cases` (id PK, state enum, nonempty label), partial index `recovery_cases_published`, security-invoker SQL function `label_length(text)`, security-invoker view `published_cases`. All owned by postgres; this milestone tests custom-role grants/membership rather than custom object-owner recovery.

Add the two NOLOGIN roles above with only their mutual membership; schema USAGE and table/view SELECT to reader. No explicit membership in authenticated, anon, service_role or provider roles. PostgreSQL may automatically grant the creating postgres role administrative membership in newly created roles; capture/check these creator edges separately and do not grant privileged roles to either fixture role. No existing provider-role attributes/settings may change. Set schema-scoped default SELECT grants for future postgres-created tables to reader; deny member writes and role administration.

Create synthetic `supabase_migrations.schema_migrations` with exact pinned column types and three records: NULL name/NULL statements; empty name/empty statements; Unicode/quote/backslash name and an ordered array containing an intentionally failing SQL statement plus a NULL element. History is inserted as data, not applied. Reject any pre-existing migration schema/history or matching custom role before seeding.

Before writing operational source seed or destructive destination preparation helpers, obtain explicit permission for these source additions and destination fixture-only cleanup plus role/history restoration. Keep both projects; no project reset/deletion, provider role changes, other service writes or charges. Preserve old verified archives and stop on unexpected dependencies. Destination cleanup uses explicit RESTRICT drops and one-shot fencing; permission does not imply automatic retry.

## Task 4: Combined capture/restore after scope approval

Read all callers before changing shared helpers. Keep old v1 tests intact; use fixed v2 assertions, not permissive switches. Capture exact role attributes/membership, schema-scoped default ACL and migration rows into private bounded metadata; validate it before archive pack. Use pinned schema/data scripts for the application schema only. Name the new recipe/inventory distinctly from v1; history/roles are not upstream role-script parity.

Restore order: verify archive and exact inventory/hashes -> validate metadata and target baseline -> transaction -> role definitions -> schema/data SQL -> restore ordinary replication role/timeouts -> history data -> exact catalog/ACL/default-privilege/behavior checks -> commit -> independent check. Check role collisions and history conflicts before any mutation. Fixed custom roles do not get privileged memberships or credentials. Any failure quarantines target; no automatic cleanup/retry.

Capture uses a quiescent synthetic source; separate script calls do not prove concurrent snapshot consistency. Client TLS remains verify-full; source credential/config paths are OS-denied during destination-only restore. Preserve old evidence and add a new single-attempt fence.

## Local verification extension

`tests/expanded_metadata_pg_test.py` is opt-in via `SPARC_TEST_PG17_BIN`. It creates its own private temporary PG17 cluster, listens only on a Unix socket, uses a sanitized child environment, and terminates/removes the cluster on completion. It must never accept a hosted URL or existing data directory. Test generated fragments as a non-superuser CREATEROLE database owner, verify exact role attributes/membership/history, prove the failing statement is inert, and reject role/history collisions. This tests local SQL semantics, not Supabase provider restrictions or a full archive round trip.

## Task 5: Verification and publication

Run all Python tests plus root Rust/age regression checks; inspect staged files for private artifacts; commit only verified code/docs. Label offline contract validation separately from live PostgreSQL and hosted recovery evidence. After hosted approval/execution, publish exact row/type/function/view/index results, effective role permissions, default-privilege behavior, inert migration-statement trap, and unmodified reserved-role/service baselines. Do not claim full database, custom ownership, seed-history, Auth, Storage, scale or CLI/Docker parity.
