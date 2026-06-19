# Shared contracts

[← back to PLAN.md](PLAN.md)

Contracts referenced by more than one phase. Each lives here once; phases link in by anchor.

- [1. Severity → presentation vocabulary](#1-severity-vocabulary)
- [2. Repair-anchor `data-field-path` convention + video repair surfaces](#2-repair-anchor)
- [3. View-model ⇔ gate parity (no drift)](#3-parity)

---

## 1. Severity → presentation vocabulary {#1-severity-vocabulary}

**Referenced by:** Phase 1 (introduces the vocabulary + non-video dimensions), Phase 2 (adds the video
camera dimension), Phase 3 (modal header pill), Phase 4 (adds the `review`-tier tag mismatch), Phase 5
(invents no new colors).

The single rule: **a color's loudness equals its export consequence.** Tiers:

| Tier | Meaning | Visual |
| --- | --- | --- |
| `blocking` | The `validateDay` gate fails because of this. | error tokens (`--color-error*`). |
| `review` | Valid to export, worth a glance. | warning tokens (`--color-warning*`). |
| `todo` | Expected, not-yet-done, not blocking. | neutral/grey; **never red**. |
| `ok` | Done + convention-following. | success tokens, sparingly. |

### Video camera state — three states, not a boolean

A present video's `camera_id` is one of three states. The boolean model is **wrong**: the schema
**requires** `camera_id` on every `associated_video_files` item
([nwb_schema.json items.required = `["name","camera_id","task_epochs"]`]), so a *blank* camera is an
AJV-blocking error, not "valid".

| `videoCameraState` | When | Tier | Row/chip label |
| --- | --- | --- | --- |
| `valid` | `camera_id` is a defined `cameras[].id`. | `ok` | "Video: N" |
| `unselected` | `camera_id` is `''`/`null` on a present video. | **`blocking`** (schema required) | "Select camera" |
| `dangling` | `camera_id` non-empty but not a defined id (covers stale id AND no-cameras-at-all). | **`blocking`** (`dangling_camera_ref` / `missing_camera`) | "Camera missing" |

`unselected` and `dangling` are distinct *labels* but the same blocking *tier*. The view-model
computes the state relative to the set of defined camera ids (empty set when the animal has no
cameras): blank → `unselected`; non-empty-and-not-in-set → `dangling`; else `valid`. This union is
exactly what `validateDay` blocks on (Rule 2 `missing_camera` + Rule 9 `dangling_camera_ref` + the
schema required-check) — pinned by [§3 parity](#3-parity).

### Statescript expectation — corpus-grounded, carry-forward-driven

A missing statescript is **not** a flat neutral state. Corpus (1,814 files): **run/task** epochs have a
statescript ~universally (84%); **sleep** epochs are bimodal and **fixed per lab** (overall 21%; some
animals log every sleep statescript, others none — by intent, e.g. alison's `# no need to have sleep sc
logs`). So expectation is per-epoch and animal-specific:

| Epoch is… | Statescript expected? | Missing → tier |
| --- | --- | --- |
| run / task (non-sleep) | **always** | `review` (loud warning) |
| sleep, and this animal's prior same-config days logged sleep statescripts | yes | `review` (loud warning) |
| sleep, and the animal has no prior sleep statescript (incl. day 1) | no | `todo` (quiet — "optional") |

The view-model derives a per-row `statescriptExpected: boolean` = `isSleepTask(taskName) ?
expectSleepStatescripts : true`, where `expectSleepStatescripts` is an **animal/config-level** input
(true iff any prior same-`configurationVersion` day binds a statescript to a sleep epoch). `isSleepTask`
reuses the existing sleep test in `tagShortCode` (`/\bsleep\b/i`). A missing **expected** statescript is
a **loud warning, never a hard block** (export is still allowed) — it is *presentation-only*, NOT a new
`validateDay` rule (so it stays outside [§3 parity](#3-parity)).

### Derived fields (additive to `EpochGridRow`)

`buildEpochGrid` gains (existing fields unchanged):

```ts
// in EpochGridRow
statescriptExpected: boolean;                                  // P1; run=true, sleep=animal pattern (above)
videoCameraState: 'valid' | 'unselected' | 'dangling' | null;  // null when the epoch has no present video
gateState: 'blocking' | 'review' | 'todo' | 'ok';              // the row's worst tier
filenameTagMismatch: boolean;                                  // Phase 4; false until then
```

`gateState` is the **max tier** over the row's signals:

```ts
const blocking =
  status === 'needs_video' ||                       // undeclared-missing video (P1 owns)
  duplicate ||                                       // duplicate epoch (P1 owns)
  videoCameraState === 'unselected' ||               // P2 adds
  videoCameraState === 'dangling';                   // P2 adds
const review =
  statescriptNaming === 'manual' ||                  // P1 owns
  (statescript == null && statescriptExpected) ||    // P1 owns — missing EXPECTED statescript (loud warning)
  filenameTagMismatch;                               // P4 adds
const gateState = blocking ? 'blocking' : review ? 'review' : status === 'complete' ? 'ok' : 'todo';
```

A missing statescript that is **not** expected (sleep on an animal that doesn't log sleep) contributes
nothing — it stays `todo`/quiet. A missing **expected** statescript is `review` (warning), never
`blocking` (no hard block).

**Phasing of `gateState`:** Phase 1 implements the `status`/`duplicate`/`manual`/`statescriptExpected`
dimensions; the `videoCameraState` terms are added by Phase 2 and `filenameTagMismatch` by Phase 4.
Each increment is additive and independently tested — no phase ships a half-computed predicate (a
dimension a phase doesn't yet own simply isn't in the `||` chain until that phase lands).

**Do not weaken:** `blocking` must stay a superset of what makes `validateDay` fail for the row.

## 2. Repair-anchor `data-field-path` convention + video repair surfaces {#2-repair-anchor}

**Referenced by:** Phase 2.

The frame routes a "Fix" click by setting `focusRequest = { fieldPath, token }` then focusing the
element whose `data-field-path` equals `fieldPath`
([DayEditorFrame.tsx:243-266](../../../../src/pages/DayEditor/DayEditorFrame.tsx)). For an anchor to be
reachable the owning section must render an element with that exact `data-field-path` **and** have it
on-screen.

**Video-reference issues the gate emits — and where each must land after Phase 2:**

| Issue (referenceRules.ts) | `focusPath` | Repair home after P2 |
| --- | --- | --- |
| `dangling_camera_ref` (video) | `associated_video_files[<i>].camera_id` | drawer camera `<select>` of the epoch owning video `i` (if the video is on a valid epoch) OR the Unassigned-videos editor (if it isn't). |
| `orphaned_video` ([referenceRules.ts:283](../../../../src/validation/rules/referenceRules.ts)) | `associated_video_files[<i>].task_epochs` | **Unassigned-videos editor** — an orphaned video matches no epoch row, so it has no drawer; it needs a dedicated surface. |

**Key finding:** `AssociatedVideosEditor` — which already renders both a camera `<select>` and a
task-epoch `<select>` with stale-id handling and *both* anchors
([AssociatedVideosEditor.tsx:129-197](../../../../src/pages/DayEditor/AssociatedVideosEditor.tsx)) — is
**imported nowhere in non-test source** (verified: only comment references remain). The epoch-centric
redesign moved per-epoch video editing into the drawer and left orphaned/unassigned videos with no
surface. Phase 2 revives this component as the **Unassigned videos** repair surface (videos matching no
current epoch row), closing both dead-ends, and extracts the camera `<select>` into a shared
`VideoCameraSelect` reused by the drawer (no divergent re-implementation).

**Scope of the "no dead-ends" claim:** Phase 2 closes every **video-reference** repair dead-end
(camera + task_epoch). It does not claim to audit every possible `validateDay` issue on the surface;
supplemental-file orphans are already handled by `AssociatedFilesEditor`'s epoch select.

## 3. View-model ⇔ gate parity (no drift) {#3-parity}

**Referenced by:** Phase 1 + Phase 2.

Because the view-model re-derives partial gate logic (camera validity, needs-video) rather than reading
mapped `validateDay` issues, the two can drift. Each phase that adds a `blocking` dimension MUST add a
parity test asserting the equivalence on a fixture set:

> For a day fixture, the set of epochs/videos the view-model marks `blocking` for a dimension equals
> the set `validateDay` emits a blocking issue for on that dimension. (`unselected` ⇔ a schema
> required-error on that `camera_id`; `dangling` ⇔ `dangling_camera_ref`/`missing_camera`;
> `needs_video` ⇔ `epochVideoUndeclared`; `duplicate` ⇔ `duplicate_task_epoch`.)

This keeps the cheaper view-model derivation honest without the larger refactor of threading mapped
issues into the grid (captured as a future option in [overview Open Questions](overview.md#open-questions)).
