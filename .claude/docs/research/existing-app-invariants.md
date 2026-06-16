# Existing-app invariants the redesign must preserve

**Date:** 2026-06-15 · **Branch:** `modern` · Companion to
[action-by-action-ux.md](./action-by-action-ux.md), [mental-model-and-ui.md](./mental-model-and-ui.md),
and the epoch-editor mockups in [../plans/epoch-editor/](../plans/epoch-editor/).

Purpose: the blue-sky design work was for **layout / IA only**. The existing app encodes a large body of
**hard-won correctness logic** — validation rules, the export merge, device normalization, bad-channel
monotonicity, the orphan-visibility contract — that has nothing to do with layout and that a clean
redesign can silently lose. This is the must-preserve checklist, sourced from a code inventory.

> Two of these corrected *errors* in the earlier research docs (now fixed): `volume_in_uL` is a
> deliberate compatibility shim, **not** a bug to drop; `optogenetic_stimulation_software` is a
> load-bearing opto-gate key, **not** a droppable non-schema field. Both verified directly in source.
> Treat that as the proof that "regardless of what exists" must not extend to the correctness substrate.

## The reframe: a new front-end over the SAME substrate

The redesign changes the **input surface**, not the logic beneath it. The day/epoch editor must **consume
the existing rules**, not reimplement them. The app already factored the load-bearing checks as **shared
predicates used by both the editing UI and the export gate so they can never drift** — the redesign keeps
using those same predicates:

- opto completeness — `optoFieldsPresence()` ([src/domain/optoCompleteness.ts](../../../src/domain/optoCompleteness.ts))
- epoch uniqueness — `duplicateTaskEpochs()` ([src/validation/taskEpochs.ts](../../../src/validation/taskEpochs.ts))
- DIO uniqueness — `duplicateBehavioralEventNames/Descriptions` ([src/validation/behavioralEvents.ts](../../../src/validation/behavioralEvents.ts))
- device-override merge — `classifyGeometryOverride/BadChannelsContainer` ([src/domain/deviceOverrideMerge.ts](../../../src/domain/deviceOverrideMerge.ts))

Net: the exported YAML shape is unchanged; **golden baselines stay byte-identical**.

## Must-preserve invariants (by domain)

File:line are from a code inventory — re-verify the specific line before relying; the two starred ⭐
items were verified directly in source for this note.

**Reference integrity** ([src/validation/rules/referenceRules.ts](../../../src/validation/rules/referenceRules.ts))
- `tasks[].camera_id` and `associated_video_files[].camera_id` / `fs_gui_yamls[].camera_id` must
  reference an existing `cameras[].id`; missing/dangling is surfaced, not silently dropped.
- `task_epochs` must be unique across all tasks (Spyglass keys TaskEpoch by session+epoch).
- `associated_files`/`associated_video_files`/`fs_gui_yamls` epoch refs must match a real task epoch,
  else conversion silently drops or mis-aliases.
- camera ids unique within the day.

**Optogenetics all-or-nothing** ⭐ ([src/validation/rules/optoRules.ts](../../../src/validation/rules/optoRules.ts))
- Gated on FOUR keys present + non-empty: `opto_excitation_source`, `optical_fiber`, `virus_injection`,
  **`optogenetic_stimulation_software`** (load-bearing — not droppable). Partial → block export.
- `optical_fiber[].reference` and `virus_injection[].reference` required (converter KeyError otherwise).
- exactly one `opto_excitation_source`.

**Channel-map geometry** ([src/validation/rules/channelMapRules.ts](../../../src/validation/rules/channelMapRules.ts), [src/domain/badChannels.ts](../../../src/domain/badChannels.ts))
- map values unique physical channels; logical keys sequential 0..n; ntrode ids globally unique; each
  group covers every probe electrode exactly once; one ntrode row per shank.
- **Multi-shank bad-channels: the converter reads `bad_channels` ONLY from the first ntrode row** — a
  mark on a later row must be consolidated to the first row (`buildProbeWideBadChannelMap`). The
  bad-channel UI must do this consolidation.

**Bad-channel monotonicity** ([src/domain/badChannelMonotonicity.ts](../../../src/domain/badChannelMonotonicity.ts))
- A channel bad on an earlier same-config day can't be un-marked without an explicit ack
  (`day.state.badChannelRemovalAcks`, off-export); unacknowledged regression blocks export. Config-version
  boundary resets monotonicity.

**Identity reuse** ([src/validation/rules/identityRules.ts](../../../src/validation/rules/identityRules.ts))
- Cameras/data-acq-devices/tasks reused **by name** must carry identical attributes (Spyglass keys by
  name). *The catalog/define-once model enforces this by construction — the redesign should keep it.*

**Load-time orphan visibility contract** ([src/state/useEpochCleanup.ts](../../../src/state/useEpochCleanup.ts))
- Workspace days **do NOT auto-scrub** orphaned epoch refs on load — they're preserved *visible*, surfaced
  by validation, and cleared only by explicit user-confirmed repair. The structural epoch editor must
  honor this (don't silently auto-fix imported corruption) and must **confirm before orphaning** when a
  task/epoch/camera is deleted or reordered.

**Carry-forward what/what-not** ([src/state/workspaceTransitions.ts](../../../src/state/workspaceTransitions.ts))
- Carries: tasks, behavioral_events, keywords, technical, experiment_description, weight, bad_channels
  (same config version only). **NEVER carries: session_id, session_description, associated_files,
  associated_video_files, fs_gui_yamls.** → the epoch *structure* carries; per-epoch **files are
  re-derived for the new date**, not copied (matches "files not carried").

**Export merge byte-identity** ([src/state/workspaceUtils.ts](../../../src/state/workspaceUtils.ts))
- Canonical key order mirrors legacy formData; opto/fs_gui emitted unconditionally (empty lists when
  absent); `fs_gui_yamls` stripped of UI-control keys (`state_script_parameters`); ⭐ `volume_in_uL` +
  `volume_in_ul` both emitted from one value (compat shim).

**Device normalization** ([src/utils/deviceNormalization.ts](../../../src/utils/deviceNormalization.ts))
- Lossless coercion; **corrupt values preserved verbatim** (no laundering) so validation can flag them;
  one-time load migration moves snapshot-base bad_channels down into each day's override.

**Config versioning** ([src/state/workspaceUtils.ts](../../../src/state/workspaceUtils.ts))
- A day pins a snapshot version; missing pinned version throws closed (never exports the wrong probe).

**DANDI subject conformance** ([src/validation/dandiSubject.ts](../../../src/validation/dandiSubject.ts))
- binomial species; no slashes in `subject_id` / `session_id`.

## Reconciliation: the epoch-editor mockups vs the substrate

**Already aligned** (the mockups preserve these): bad-channel monotonicity + ack + config reset;
catalog/define-once (subsumes identity-reuse); config versioning; carry-structure-then-derive-files;
"flag, don't silently drop" on import; validation gates export.

**Gaps the mockups didn't address** (add to the design):
- the full reference-integrity rule set (still needed — the structural row handles the happy path, but
  import/edit can still produce dangling refs);
- **multi-shank bad-channel first-row consolidation** in the failed-channels grid;
- the full opto rule set (4 fields, one source, reference required);
- **repair-before-orphaning confirm** on task/epoch/camera delete and on reorder/re-derive;
- the **orphan-visibility contract** — the structural editor must surface orphans, not auto-erase them;
- export-merge byte-identity (the editor feeds `mergeDayMetadata` unchanged).

**Corrections / deliberate divergences to decide:**
- `volume_in_uL` shim and `optogenetic_stimulation_software` — corrected above (don't drop).
- **Opto power schedule carry-forward:** my notes said "carry the schedule shape," but the existing app
  does **not** carry `fs_gui_yamls`. That's a deliberate divergence to decide, not assume — if we want
  carry-forward of the opto ramp, it's a *change* to the carry-forward contract, made on purpose.

## Design rule going forward

The day/epoch editor is a **new input surface over the existing `useWorkspace` + validation + merge**.
Every invariant above is consumed via its existing shared predicate; the YAML shape is unchanged; golden
baselines stay byte-identical. Layout is the only thing we're free to reinvent.
