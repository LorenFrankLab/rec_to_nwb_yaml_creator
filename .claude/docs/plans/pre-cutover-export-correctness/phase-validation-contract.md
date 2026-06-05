# Validation Contract — make the boundaries explicit (post round-8)

## Why this exists

Review rounds 6, 7, 8 were the **same bug in different clothes**. We kept patching
symptoms — a malformed shape here, a mis-routed repair there — and the next adjacent
malformed-state shape always escaped, because the *contract* was never generalized. The
root cause is that four concerns blur together:

1. **Raw persisted state vs normalized export state.** We normalize *before* validating,
   so corruption in restored/imported state dissolves into defaults (`[]`, `{}`, snapshot
   fallback) and never gets flagged.
2. **Ownership.** We route repairs by field `path`, but path ≠ ownership. A path like
   `ntrode_electrode_group_channel_map[…]` can come from animal geometry, a day override,
   or the bad-channel overlay. The UI then sends the user to the wrong editor.
3. **Repairability.** We add repair controls *after* finding dead-ends, but never test the
   invariant: every export-blocking issue has exactly one reachable, truthful repair that
   actually clears it.
4. **Converter-truth vs UI-convenience.** `trodes_to_nwb` has surprising semantics (bad
   channels read from the **first ntrode row only** for multi-shank groups), so normal UI
   assumptions ("each row owns its bad channels") are actively wrong.

Decision (user, 2026-06-05): **build the full contract, phased & gated, on the
`phase-7-converter-truth-contracts` branch.** Round-8's six findings are absorbed as the
first rows of the contract's test matrices, not patched locally.

## The four boundaries

### Boundary 1 — Raw shape is validated BEFORE normalization
- New `src/validation/rawShape.js`: `validateRawDay(day)`, `validateRawAnimal(animal)` run
  on the **persisted** object. Cover every day-owned array (`tasks`, `associated_files`,
  `associated_video_files`, `behavioral_events`, `keywords`, `fs_gui_yamls`) and every
  `deviceOverrides.*` shape (container, geometry arrays, bad_channels map/keys/values).
- Rule: **the export gate validates raw shape AND normalized content; normalization only
  produces bytes, never decides validity.** The merge may still launder to `[]`/snapshot
  for byte-safety, but raw-shape issues block export regardless.
- Re-home the *shape* checks currently in `dayOverrideIssues` here; leave only the
  provenance-dependent checks (shadowed geometry) for Boundary 2.
- Guard `computeEpochsStatus` and the Epochs/Videos UI (`Array.isArray`).
- Absorbs round-8 **High 1**.

### Boundary 2 — Ownership is declared, never inferred from `path`
- Issue contract gains `ownerSurface` ('day'|'animal'|'none'), `repairStep`, `focusPath`.
- `resolveDayConfig` / `mergeDayMetadata` return a **provenance map** (which merged fields
  came from a day override vs the snapshot vs the bad-channel overlay). A schema-issue
  adapter assigns `ownerSurface` from provenance, not path.
- **Delete `deriveSurfaceFromPath`** (the path heuristic that mis-routes).
- Absorbs round-8 **High 3** (shadowed-override routing, false-blame) and **Medium 3**
  (focus lands on the grid, not the removal button — fixed via explicit `focusPath`).

### Boundary 3 — Repairability is an invariant, tested as a matrix
- `repairabilityMatrix` harness: for **every issue code**, assert the round-trip —
  malformed input → issue raised → a control exists at `focusPath` → invoking it **clears
  the issue**.
- Malformed-persisted-state matrix across all day-owned arrays + all override shapes
  (scalar / wrong-type / array-with-bad-entries).
- Absorbs round-8 **Medium 1** (step-status-only blockers must show a repair action).

### Boundary 4 — Converter-truth ≠ UI-convenience; components tolerate corruption
- Keep `rulesValidation` = converter truths (export-blocking). UI-status hints separate.
- Swept, tested guarantee: every `.map`/`.forEach`/`.filter` over persisted state is
  `Array.isArray`-guarded — **components never throw on loaded corruption**.
- Absorbs round-8 **High 2** (scalar `bad_channels` crash) and **Medium 2** (single-shank
  save accepts non-integer bad channels).

## Execution order (each its own gated commit on the phase-7 branch)
1. Boundary 1 + Boundary 3 scaffold (the gate and the matrix that enforces everything).
2. Boundary 2 (provenance ownership) under the matrix's protection — highest risk.
3. Boundary 4 (validator split + tolerance sweep).

Gate each: full vitest suite (adequate `--test-timeout`; slow multi-shank renders flake on
timeout under parallel load), 125 golden baselines byte-identical, 0 lint errors, clean
build, no plan/phase strings in shipped code. Do NOT merge to `modern`; pause before merge.

## As-built — deviations from the design above

The four-boundary design below is the original plan; the shipped implementation differs in
a few mechanisms. The authoritative as-built record is `docs/REFACTOR_CHANGELOG.md`. Key
deviations (verified against the code):

- **`deriveSurfaceFromPath` was NOT deleted** (Boundary 2 said "delete"). It is retained as
  the final fallback in `repairTargetForIssue` for AJV schema issues that carry no app
  ownership metadata. The resolution order is: explicit `ownerSurface` → `repairSurface` →
  `SURFACE_BY_CODE` → `deriveSurfaceFromPath`.
- **`deviceOverrides` shape checks were NOT re-homed** into `rawShape.js` (Boundary 1 said
  "re-home"). They remain in `dayOverrideIssues` (which needs `mergedDay`/`baseIssues` for
  the stale-key and shadowed-override cases). `rawShape.js` covers only the top-level
  day/animal array fields.
- **`resolveDayConfig`/`mergeDayMetadata` do NOT return a provenance map** (Boundary 2
  described one). Geometry provenance is derived from the persisted day alone
  (`dayGeometryProvenance`) and applied by `tagBaseOwnershipByProvenance`.
- **Ownership enforcement landed as `normalizeIssue`** at the `validateDay` boundary (added
  after the contract reviewer pass): it resolves the owner once, stamps `ownerSurface` /
  `focusPath` / day `step` on every emitted issue, mirrors the legacy `repairSurface`,
  drops the never-read `repairStep` issue field, and throws on an unresolved owner. So
  "ownership is declared, not inferred" is true at the consumer boundary even though
  individual producers still vary.

## Round-8 findings → boundary map
- High 1 (day-collection laundering + Epochs crash) → B1
- High 3 (shadowed-override routing / false-blame) → B2
- Medium 3 (invalid-mark focus on grid) → B2 (focusPath)
- High 2 (scalar bad_channels crash) → B4
- Medium 2 (single-shank non-integer bad channel saved) → B4
- Medium 1 (step-status blocker has no repair action) → B3
