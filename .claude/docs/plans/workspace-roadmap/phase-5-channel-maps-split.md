# Phase 5 — Channel-maps split: bad channels become day-only

[← PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md)

The animal **Channel Maps** tab becomes wiring/mapping only; **bad-channel marking moves entirely to the day**. Bad channels are **monotonic** — once marked they persist and accumulate across a study, so a new day **carries forward** the prior day's marks (config-version-guarded) and the user **adds** newly-failed channels. A "dead-from-implant" channel is just marked on day 1 and carried forward — no separate animal baseline. **🟡 merge-changing**: the export must stay byte-identical for existing data, which requires a migration of any existing animal-base marks down to the days.

**Inputs to read first:**

- `src/pages/AnimalEditor/ChannelMapEditor.jsx` — currently edits `bad_channels` on each electrode group's FIRST ntrode row (the animal-level base to REMOVE). Read it to find every bad-channel edit path.
- `src/pages/DayEditor/BadChannelsEditor.jsx` — the day checkbox grid (KEEP; this becomes the only bad-channel surface). Writes `day.deviceOverrides.bad_channels.<ntrodeId>`.
- `src/state/workspaceUtils.js` — `resolveDayConfig` + the `deviceOverrides.bad_channels` application block (≈ :234); and where the animal-base `bad_channels` (from the config snapshot's ntrode map) currently enter the resolved map. **This is the merge change.**
- `src/state/workspaceTransitions.js:288` — `createDayRecord(..., carryFrom)` (phase 1) — ADD the config-version-guarded bad-channel carry here.
- `src/state/useWorkspace.js` hydration / `src/domain/dayRecovery.js` / `src/utils/deviceNormalization.js` — the existing load-time normalization/recovery path is where the one-time migration belongs.
- **Verify first:** which baseline/golden fixtures (`src/__tests__/fixtures/golden/`, the workspace-merge fixtures) carry animal-base `bad_channels` (`bad_channels` on a config-snapshot ntrode row). If NONE do, the merge change is baseline-neutral without migrating fixtures, and the migration only touches real persisted data.

**Contracts referenced:** [`createDayRecord(..., carryFrom)`](shared-contracts.md#createdayrecordanimal-animalid-dayid-date-session-now-carryfrom--null--referenced-by-phase-1-phase-5) — the config-version-guarded bad-channel carry rule.

## Tasks

- **Migration (do first; it's the byte-identical gate).** A one-time, idempotent transform at load: for each day, set `day.deviceOverrides.bad_channels[ntrodeId] = union(animal-base marks resolved for the day's config, existing day override)`; then strip `bad_channels` from the config snapshots' ntrode rows. After migration the merge reads only the day override, which equals the prior `base ∪ override` → export byte-identical. Make it idempotent (no base left → no-op on re-run) and shape-safe (a corrupt override is surfaced/left to the existing repair path, not crashed on).
- **Merge change.** In `resolveDayConfig` (`workspaceUtils.js`), stop seeding `bad_channels` from the config snapshot; the resolved map's bad channels come ONLY from `day.deviceOverrides.bad_channels`. Confirm the export for a migrated day is byte-identical to pre-migration.
- **Remove animal-level editing.** Delete the `bad_channels` editing UI from `ChannelMapEditor` (the tab is mapping-only). Name this removed path explicitly in the PR. The status/column that reported animal-level bad channels (if any) is updated to reflect day-ownership.
- **Bad-channel carry-forward.** Extend `createDayRecord`'s `carryFrom` (phase 1) to copy `carryFrom.deviceOverrides.bad_channels` into the new day **only when `carryFrom.configurationVersion === latestVersion`** (the new day's pin). On a config change, do NOT carry (stale ntrode ids).
- **Day "add failed channel" flow.** Keep `BadChannelsEditor`; ensure it remains the canonical surface. Removing a mark stays an explicit edit (monotonic-by-default, not auto-cleared).
- **Docs.** CLAUDE.md / PIPELINE_REQUIREMENTS notes that mention animal-level bad channels; CHANGELOG entry (split + carry-forward + migration; byte-identical).

## Deliberately not in this phase

- A dataset-tier channel map — decision-gated.
- Auto-clearing bad channels — never; monotonic by design.

## Validation slice

| Test | Asserts |
| --- | --- |
| migration byte-identical | a day with animal-base + day-override marks exports the SAME YAML before and after migration |
| migration idempotent | running it twice == running it once; no base left |
| merge reads day-only | after migration, `resolveDayConfig` ignores any (absent) snapshot bad_channels |
| carry-forward same config | new day pins same version → carries the prior day's `bad_channels` |
| carry-forward across config change | source pinned a DIFFERENT version → bad_channels NOT carried |
| animal tab mapping-only | `ChannelMapEditor` no longer exposes bad-channel editing |
| baselines | `npx vitest run baselines` → 125 byte-identical (with fixtures verified base-free or migrated) |

## Fixtures

Inline + the golden fixtures. Build a workspace fixture that DOES carry animal-base bad channels (to exercise the migration), plus a multi-config animal (to exercise the carry-forward guard across a config change). Real-data check: run the migration over the golden set and assert export parity.

## Review

Dispatch `code-reviewer`. Confirm: export is byte-identical before/after the migration (the gate); the migration is idempotent and shape-safe; the merge no longer reads snapshot bad_channels; carry-forward is config-version-guarded (the across-config test proves it does NOT carry); the removed `ChannelMapEditor` bad-channel path is actually gone (no orphan); docstrings/test names don't reference this plan; CLAUDE.md/PIPELINE notes updated.
