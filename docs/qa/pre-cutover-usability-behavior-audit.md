# Pre-cutover usability & proper-behavior audit

**What this is.** A Claude-executable (not human) usability/behavior audit of the **tabbed workspace**
YAML creator before the professional-UX-polish gate (Phase 11) and the v3 cutover. It is a scripted,
artifact-producing audit that triangulates three views of truth — the **visible UI**, the persisted
**`rec_to_nwb_workspace_v1` localStorage** state, and the **exported YAML** — and scores the app
against the screen-map and the mistake-prevention / Spyglass-identity / DANDI contracts. It is **not**
a human usability study (that is recommended separately, and remains so after this audit).

**Scope / IA.** The app is the tabbed Animal View IA (`#/workspace`, `#/animal/:id/:tab`, `#/day/:id`,
`#/validation`) — NOT the removed stepper. Audited against
[`workflow-screen-map.md`](../../.claude/docs/plans/pre-cutover-export-correctness/workflow-screen-map.md).

**How it was run.** Dev server `npm run start` (http://localhost:3000); Chromium via the committed
Phase-9 e2e harness (`e2e/helpers/workspace.js`) + Playwright, plus live MCP-driven inspection for
label/screenshot scans. Where a behavior is already pinned by a committed Phase-9 spec, this audit
cites that spec; it adds the triangulation / clarity / recovery checks Phase 9 does not consolidate.

- **Commands:** `npm run start`;
  `npx playwright test e2e/usability-audit.triangulation.spec.js --project=chromium`;
  `npx playwright test e2e/workspace-*.spec.js --project=chromium` (regression backbone);
  `npx vitest run` / `npx vitest run baselines`.
- **Artifacts:** the committed triangulation spec `e2e/usability-audit.triangulation.spec.js`;
  Playwright HTML report (`playwright-report/`), traces/screenshots (`test-results/`, gitignored);
  captured YAML downloads (asserted in-test).

---

## Severity scale

| Sev | Meaning | Gating |
| --- | --- | --- |
| **S1 — dangerous confusion** | A scientist can silently produce wrong/incomplete metadata, or cannot repair a blocked export without schema/Spyglass/DANDI knowledge. | **Blocks Phase 11 / cutover** until fixed or explicitly accepted here. |
| **S2 — important** | Real workflow friction or label/ownership ambiguity that risks a mistake but has a recoverable/visible path. | Track as follow-up; does not block. |
| **S3 — minor/polish** | Cosmetic/consistency/copy nit. | Phase 11 polish candidate. |

**Headline result: PROCEED TO PHASE 11 with tracked follow-ups.** All S1 findings were fixed during
this phase. No silent UI↔export disagreement exists; every scripted dangerous mistake is caught before
export; a blocked day is fully repairable in scientific language without schema knowledge. Residual
findings are S2/S3 and are listed in Task 7.

---

## Task 1 — Scenario + mental-model matrix

Result column: ✅ pass · ⚠️ finding (id) · ❌ fail · ⛔ not reachable with current fixtures.

### A. Core workflow scenarios

| # | Scenario | User goal | Dangerous misconception | Expected behavior (UI / state / YAML / preflight) | Result |
| --- | --- | --- | --- | --- | --- |
| C1 | Create animal | Register the subject | Recording-day fields belong here | Required subject fields; lands on `#/animal/:id/days`; keyboard-completable | ✅ |
| C2 | Configure probes | Describe implant geometry | A day owns its probes | electrode-groups tab; channel-maps auto-regen; integer ids in YAML | ✅ |
| C3 | Camera same-name / different zoom | Add side camera at new zoom | Same name can carry different calibration | divergence block + "Use a new camera name"; catalog not overwritten | ✅ |
| C4 | Data-acq identity | Record the rig device | Reusing a name w/ different hardware is fine | reuse-with-divergence block; array w/ name+system+amplifier+adc in YAML | ✅ |
| C5 | Region canonical entry | Set brain region | "CA1"/"ca1" are the same | datalist canonicalizes `ca1`→`CA1` on blur | ✅ |
| C6 | Subject / DANDI fields | Fill subject metadata | `species: Rat` / slash in ids OK | binomial dropdown; no-slash ids; timestamp DOB; weight req | ✅ |
| C7 | Task/video references | Attach video to task/epoch | A stale id is harmless | camera/epoch are controlled selects; no free-text id | ✅ |
| C8 | Fail-closed repair | Export a finished day | "Download = it's ready" | invalid day: Download disabled + visible reason + repair action → owning tab/step | ✅ |
| C9 | Persistence recovery | Edits survive / bad blob shouldn't crash | A corrupt blob is silently trusted/lost | reload survives; malformed → named notice, no crash; failed save keeps guard | ✅ |
| C10 | Opto off → on | Record opto state | Partial opto silently drops downstream | off=clean; partial=blocked w/ checklist; complete=both key spellings | ✅ |
| C11 | Export preflight/download | Confirm what's encoded | Preflight is just a button | preflight names animal/day/config-version/cameras+calibration/probes+bad-channels/tasks/opto | ✅ (F-02 fixed) |

### B. State-specific primary-action states (screen-map)

| # | State | Verdict | Note |
| --- | --- | --- | --- |
| S-1 | No animals | ✅ | `Create Animal` dominant |
| S-2 | Picker with animals | ✅ | card opens days; ⋮ separated |
| S-3 | New/under-configured | ⚠️ F-07 | "Review existing data" banner competes with `Add Recording Days` |
| S-4 | Established animal | ⚠️ F-07 | same always-on review banner dilutes the primary action |
| S-5 | Existing/recovered data | ✅ | review links to this animal's export tab |
| S-6 | Some days invalid | ✅ F-05 fixed | day-row status now humanized (was raw `experiment_description`) |
| S-7 | One ready day | ⚠️ F-08 | when 0 valid, `Export Valid Only` is inert/misleading; should foreground repair |
| S-8 | Multiple ready days | ⛔ | not reachable with single-day fixture; covered by `workspace-workflows.spec.js` batch path |
| S-9 | Historical configuration | ⛔ | single-config fixture; reconfig path covered in code/Phase-9 |
| S-10 | Hardware changed starting this day | ✅ | reconfig entry button present in Setup & Failed Channels step |
| S-11 | Export blocked | ✅ F-03 fixed | disabled Download + `role="alert"` reason (now humanized) + repair button |
| S-12 | Export ready | ✅ F-02 fixed | preflight now shows per-camera calibration |
| S-13 | Animal not found | ✅ F-06 fixed (DayEditor) / ⚠️ F-06b (AnimalView return link weak) | non-stranding "Animal not found" + Back to Workspace |

### C. High-risk modals (screen-map)

| # | Surface | Verdict |
| --- | --- | --- |
| M-1 | Inline create-animal panel | ✅ heading "Create New Animal", Create/Cancel, success→days |
| M-2 | Recording-day calendar | ⛔ button present, full flow not driven (covered by Phase-9 carry-forward tests) |
| M-3 | Reconfiguration wizard | ⛔ entry present, full wizard not driven |
| M-4 | Electrode group modal | ✅ identity+anatomy; focus trap/restore; delete cascades |
| M-5 | Channel map editor | ✅ label matches job; modal focus-managed |
| M-6 | Camera modal | ✅ proactive identity guidance; divergence + "Use a new camera name"; ⚠️ F-09 (Edit aria-label) **fixed** |
| M-7 | Animal delete (type-to-confirm) | ✅ (driven in Phase-9 `workspace-lifecycle.spec.js`); ⋮ keyboard ok |
| M-8 | Per-day delete (plain confirm) | ✅ (Phase-9) |
| M-9 | Import preview/result | ✅ un-importable named + reason + remediation hint; result names created identities (Phase-9 + restored after Task-2 reconciliation) |

### D. Batch row scan contract (catch-up)

| Field | `#/validation` | per-animal `export` tab | Verdict |
| --- | --- | --- | --- |
| date + session id | date ✅ / session "—" | date ✅ / session "—" | ⚠️ F-10 (session description not surfacing) |
| animal (cross-animal) | ✅ | ✅ | ✅ |
| config version | ✅ "config v1" | ✅ dated | ⚠️ F-11 (latest/historical not labelled; wording differs) |
| camera/calibration summary (zoom-detectable) | count only | count only | ⚠️ F-04 (mpp not in batch scan — known-deferred) |
| opto state | ✅ | ✅ | ✅ |
| validation/export state | ✅ | ✅ | ✅ |
| next action + owner | ✅ "Open editor" | ✅ | ✅ |

> **Out-of-scope (documented):** legacy single-page form (`#/`) — frozen safety net, not the cutover IA;
> cross-browser (Chromium-only by config); the deferred downstream
> `trodes_to_nwb`→NWB-Inspector→`dandi validate`→Spyglass round-trip (separate pre-cutover gate, see
> `docs/PIPELINE_REQUIREMENTS.md`); full axe/WCAG audit (Phase 11 + manual).

---

## Task 2 — UI / state / export triangulation

Committed spec `e2e/usability-audit.triangulation.spec.js` (6 tests) captures all three planes for the
seeded configured `remy` day and asserts agreement. **All audited sections AGREE — zero silent
disagreement.**

| Section | Visible UI | localStorage | Exported YAML | Agree? |
| --- | --- | --- | --- | --- |
| Camera 0/1 calibration | `0.00085` / `0.0009` + lens (Cameras tab) | same | same | ✅ |
| data_acq_device | table + preflight `1 device (SpikeGadgets)` | array of 4-field object | `data_acq_device:` list, identical | ✅ |
| electrode groups / ntrode ids | preflight `8 electrode groups` | numeric ids `[0..7]`/`[1..8]` | unquoted integers | ✅ |
| day bad-channels | preflight `2 failed channels` | ntrode overrides | same two marks on ntrode rows | ✅ |
| subject species / ids / DOB / weight | (inherited) | `Rattus norvegicus`, no-slash ids, T-timestamp, 485 | identical | ✅ |
| tasks / videos | preflight `3 tasks, 4 videos` | 3 tasks / 4 videos; `w_alternation.camera_id:[0,1]` | same | ✅ |
| optogenetics | preflight `No optogenetics` | undefined | empty arrays, no `opto_software` | ✅ |

**No S1/S2 triangulation findings.** (F-02, an S1 *clarity* gap — preflight showed only a camera
count, not calibration — was fixed this phase; the underlying values always agreed.)

## Task 3 — Mistake-injection audit (first catching surface)

All eight scripted dangerous mistakes are caught at or before export. **No mistake reaches export
uncaught.**

| Mistake | First catching surface | Gap |
| --- | --- | --- |
| Reused camera name, changed mpp/lens | editing surface — camera modal divergence + "Use a new camera name"; save blocked | none |
| Reused data-acq name, different hardware | editing surface — recording-system divergence; save blocked | none |
| Task name reused, different description | editing surface — task modal divergence; Save disabled | none |
| Region case drift (ca1/CA1) | editing surface — datalist canonicalizes on blur | none |
| Dangling task/video camera/epoch ref | structural — controlled selects/checkboxes of known cameras/epochs | none |
| Whitespace-only required string | editing surface (Overview error) **and** export gate | none |
| Slash in subject_id / session_id | create-form validation (subject_id); session_id is read-only auto-derived | none |
| Partial optogenetics | export gate — "All fields required (or none)" + ✗ checklist; Download disabled | none |

## Task 4 — Labels, units & decision-clarity scan + screen-map coherence

Strong patterns confirmed: species dropdown stores the binomial; camera-modal identity guidance is
proactive; opto three-state ("Not used — no stimulation") is unmistakable; electrode-group coordinate
labels use full anatomical names; blocking dots are blocking-only; repair buttons route to the owning
step. **Fixes applied this phase (see Task 7).** Residual S2/S3 label items tracked in Task 7.

## Task 5 — Keyboard, focus & narrow-viewport behavior

| Flow | Keyboard-completable | Focus correct | Disabled reason exposed | Narrow 390×844 | Verdict |
| --- | --- | --- | --- | --- | --- |
| Create animal | ✅ | ✅ form auto-focus | n/a | ✅ | PASS |
| Object-selector popup | ✅ | ✅ Esc→trigger, arrows rove | n/a | ✅ | PASS |
| `?field=` repair landing | ✅ | ✅ **fixed** (now focuses owning control, was `<main>`) | n/a | ✅ | PASS (F-01 fixed) |
| Blocked Download (Export) | ✅ repair reachable | ✅ | ✅ `role="alert"` reason + repair button | ✅ in-viewport | PASS |
| Setup modals (camera/electrode) | ✅ | ✅ trap+restore | n/a | ✅ fits | PASS (F-09 Edit aria-label fixed) |

No layout S1: no critical control off-screen/clipped at 390×844; modals fit; primary safe action
reachable.

## Task 6 — Error-recovery drill

Seeded an invalid workspace (blank camera `meters_per_pixel` + blank electrode-group `location`).
Using ONLY visible repair actions: the Export step lists *"Resolve N validation errors"* with
scientific-language messages (e.g. *"Electrode group 0 has an empty location. A non-empty brain region
is required — Spyglass creates a BrainRegion from this exact string."*) and "Fix in Animal Setup → …"
buttons that land on the editable owner; the user fills the value and reaches a clean preflight +
download. **PASS — recoverable without any AJV/Spyglass/DANDI knowledge; no read-only dead end.**

One residual friction (F-12, S2): the camera-calibration repair fires the same-name identity guard
even when *filling a blank* placeholder (a fill, not a change), producing a "Give this camera a new
name" prompt that contradicts the repair intent — a multi-step gauntlet, not a dead-end.

## Task 7 — Findings / fix log & Phase 11 readiness

### Fixed this phase (S1 — were Phase-11 blockers)

| id | Finding | Fix | Commit |
| --- | --- | --- | --- |
| F-02 | Export preflight showed only a camera **count**, not calibration — a recalibrated camera was invisible at the confidence checkpoint | preflight now lists each day-used camera's name + `meters_per_pixel` (`src/domain/preflightSummary.js`) | `1c5959e` |
| F-03 | Raw AJV jargon (`must have required property 'task_environment'`) shown to users in the export-blocked state | humanize required-field messages **at the display layer** (`humanizeValidationMessage` applied in `RepairActions`/`ValidationStep`); validation core left raw so import remediation + baselines still work | `2fbed72` (re-architected from `1c5959e`) |
| F-05 | Day-row "Needs fixing — `experiment_description` …" leaked a raw schema key | humanize the reason at the day-row render (`RecordingDaysTab.jsx`) | `2fbed72` |
| F-13 | Legacy species datalist `'sus scrofa'` (lowercase) fails the DANDI binomial regex | `'Sus scrofa'` (`src/valueList.js`) | `1c5959e` |

### Fixed this phase (S2/S3 — clarity/accessibility/consistency)

| id | Finding | Fix | Commit |
| --- | --- | --- | --- |
| F-01 | `?field=` repair deep-link left focus on `<main>` wrapper, not the owning control | move focus to first focusable control in the highlighted section (`AnimalView/index.jsx`), mirroring DayEditor | `119dc48` |
| F-09 | Cameras-table "Edit" button had no per-row accessible name (two "Edit"s indistinguishable to SR) | `aria-label="Edit camera {id}"` (`CamerasSection.jsx`) | `119dc48` |
| F-14 | `meters_per_pixel` column header "Meters/Pixel" + modal help lacked unit/identity context | "Meters per Pixel" + calibration/identity help (`CamerasSection.jsx`, `CameraModal.jsx`) | `119dc48` |
| F-15 | `raw_data_to_volts` / `times_period_multiplier` labels were bare schema keys | added units/purpose + default-value guidance (`DataAcqSection.jsx`) | `119dc48` |
| F-16 | Electrode Groups panel heading "Electrodes & Ephys" ≠ nav/route/screen-map "Electrode Groups" | heading → "Electrode Groups" (`ElectrodeGroupsStep.jsx`) | `119dc48` |
| F-17 | Day Editor panel heading "Devices Configuration" ≠ nav "Devices & Failed Channels" | heading → "Setup & Failed Channels" (`DevicesStep.jsx`) | `9d495d9` |
| F-18 | Experimenter placeholder "Firstname Lastname" taught the wrong format | "Last, First (e.g. Doe, Jane)" (`AnimalCreationForm.jsx`) | `9d495d9` |
| F-19 | Custom-species hint "for NWB compatibility" understated DANDI rejection | concrete "free text like \"Rat\" is rejected by public archives (DANDI)" (`AnimalCreationForm.jsx`) | `9d495d9` |
| F-06 | DayEditor "Animal/Day not found" return was a weak inline link | prominent styled "← Back to Workspace" action (`ErrorState.jsx` + scss) | `9d495d9` |
| F-20 | preflight grammar "1 electrode groups" | conditional pluralization (`preflightSummary.js`) | `1c5959e` |

### Residual findings — tracked follow-ups (do NOT block Phase 11)

| id | Sev | Finding | Recommended owner/fix |
| --- | --- | --- | --- |
| F-04 | S2 | Camera `meters_per_pixel`/zoom not detectable from the batch-triage scan (`#/validation` + per-animal export tab show camera **count** only) — a recalibration is invisible during catch-up. (Known-deferred in the tabbed-IA handoff: "Workspace day rows lack the batch scan fields".) | Add a calibration summary column to the Validation/per-animal-export setup scan (`ValidationSummary/index.jsx`). The export **preflight** already shows it (F-02). |
| F-07 | S2 | The "Review existing data" banner competes as a primary action on the days tab even for an established, trusted animal | Suppress the review banner unless there is genuinely recovered/corrupt/wrong-owner data; let `Add Recording Days` dominate (`RecordingDaysTab.jsx`). |
| F-08 | S2 | `#/animal/:id/export` shows `Export Valid Only` as the action when **0** days are valid (inert/misleading) | When `validCount === 0`, foreground a focused "Go to first blocked day" repair instead (`ValidationSummary`/per-animal export). |
| F-10 | S2 | Session description does not surface in batch rows even when set (shows "—") | Investigate the row data binding — likely a key mismatch between the seeded/stored session-description field and the row renderer (`ValidationSummary` / day classification). |
| F-11 | S2 | Batch rows show config version number but not latest/historical status, and the wording differs between `#/validation` (`config v1`) and the per-animal export tab (`config from <date>`) | Unify the setup-scan wording and add a latest/historical indicator. |
| F-12 | S2 **(highest-priority S2 — schedule EARLY in Phase 11)** | Camera-calibration repair fires the same-name identity guard when *filling a blank* placeholder (a fill, not a change), prompting "Give this camera a new name" — high friction at the exact point the tool told the user to repair. Risk: a scientist may abandon the repair or give the camera an arbitrary new name, breaking day references that used the original name. | In `CamerasContainer.jsx` (`selfConflict`), suppress the divergence for a dependent field whose **existing** value is empty/missing (a fill), keeping the reference-decision only when a *populated* value changes. Touches identity-safety logic — do with care + tests. Per the Phase-10 UX review, prioritize this over the other S2 items because it sits on the critical repair path. |
| F-06b | S3 | AnimalView's own "Animal not found" return link is visually weak (the DayEditor one was fixed) | Mirror the styled-action treatment on `AnimalView`'s not-found return. |

### Recommendation

**PROCEED TO PHASE 11 with the tracked S2/S3 follow-ups above.** Rationale:

- **No silent scientific-data corruption surface:** UI ⇄ localStorage ⇄ exported YAML agree on every
  audited value; the export path is byte-stable (golden baselines untouched throughout).
- **All dangerous mistakes are caught before export** at the editing surface or the fail-closed gate.
- **Repair requires no schema knowledge:** the recovery drill reached a valid download using only
  visible, scientific-language repair actions.
- **All S1 (dangerous-confusion) findings were fixed and verified this phase**, including
  re-architecting the required-field humanization to the display layer so it did not regress the
  import-remediation guidance or the validation baselines.

The residual items are real but recoverable workflow/clarity frictions (batch-scan calibration
visibility, the competing review banner, the inert "Export Valid Only", the calibration-fill repair
friction) appropriate for the Phase-11 professional-UX-polish pass. **A separate human lab-user dry
run remains recommended** before the cutover — it is outside this Claude-executable phase.

### Gates at handoff

`npx vitest run` → 4511 passed · `npx vitest run baselines` → 125 byte-identical · `npm run lint` →
0 errors · `npm run build` → OK · `npx playwright test e2e/workspace-*.spec.js e2e/usability-audit.triangulation.spec.js …`
→ all green (85+ tests).
