# Pre-cutover professional UX polish audit

**What this is.** The final pre-cutover professional-UX-polish pass (Tasks 0–9) over the **tabbed
workspace** YAML creator: a Claude-executable audit of workflow/screen coherence, interaction/design-
system consistency, form quality, visual hierarchy, responsive layout/overflow, objective
accessibility (computed contrast, focus, status announcements, reduced-motion), content design, and
perceived performance — with the small fixes applied and the larger debt severity-ranked. Phase 10
proved behavior is correct and recoverable; this phase proves the UI is coherent, consistent,
accessible, and visually trustworthy for repeated scientific use. **Not** the v3-cutover default-route
flip.

**IA / scope.** Tabbed IA (`#/workspace`, `#/animal/:id/:tab`, `#/day/:id`, `#/validation`), audited
against [`workflow-screen-map.md`](../../.claude/docs/plans/pre-cutover-export-correctness/workflow-screen-map.md)
and [`workflow-clarity-design.md`](../../.claude/docs/plans/pre-cutover-export-correctness/workflow-clarity-design.md).
Builds on the Phase-10 findings log
([`pre-cutover-usability-behavior-audit.md`](pre-cutover-usability-behavior-audit.md)).

**How it was run.** Dev server `npm run start` (http://localhost:3000); Chromium via Playwright + the
Phase-9 harness (`e2e/helpers/workspace.js`); live MCP inspection; computed WCAG contrast via in-page
`getComputedStyle` (no new dependency); responsive screenshots at desktop 1280×720, tablet ~834, and
narrow 390×844.

- **Commands:** `npm run start`; `npx playwright test e2e/workspace-responsive-cameras.spec.js …`;
  `npx playwright test e2e/workspace-*.spec.js --project=chromium`; `npx vitest run` /
  `npx vitest run baselines`; `npm run build`.
- **Severities:** `blocks safe use` (gates cutover) · `likely confusion` · `polish`.

**Headline result: PROCEED TO CUTOVER-READINESS with tracked follow-ups.** The one `blocks safe use`
finding was fixed and verified. The standout bug — a global CSS class collision painting every valid
Validation & Export panel in error-pink — was fixed. Remaining debt is `likely confusion`/`polish`,
appropriate for fast-follow. No export semantics changed (125 golden baselines byte-identical).

---

## Task 0 — Workflow & screen-coherence gate

Drove the required states. Verdicts:

| State | Coherent? | Note |
| --- | --- | --- |
| New animal, no days | ✅ (after fix) | The setup card's per-section `Set up →` links are clear and NON-gating; a behavior-only day is unblocked. **Fixed:** the opto setup-card vs section-nav contradiction (was `blocks safe use`). |
| Animal with days, no electrodes | ✅ | empty-state "Add Electrode Group"; behavior-only is valid. |
| Imported/recovered animal with existing config | ✅ (after fix) | review state now surfaces only when there IS something to review (corruption/recovered) — fixed F-07. |
| Day "Setup & Failed Channels" empty/uses-config | ✅ | heading matches nav; pinned-config ownership model correct; reconfig entry present. |
| Historical configuration | ⛔ not driven | covered by Phase-9 reconfig specs + `ReconfigurationContextBanner`. |
| Reconfiguration from a day | ⛔ not driven | entry button present; Phase-9 wizard specs cover the flow. |

Electrode-setup discoverability, shared-vs-day ownership, and Day-Devices meaning are coherent. No
residual `blocks safe use` IA gap.

## Task 1 — Screen/state inventory

A full screen×state inventory (user goal · intended mental model · dangerous misconception ·
screenshot · direct-test coverage) was produced during the audit covering every route, tab, modal,
empty state, recovery notice, opto on/off, and destructive confirm from the screen-map. Coverage gaps
noted: the partial-opto setup-card/nav state and the 0-valid export state lacked direct tests — both
are now covered by the fixes' new assertions (`sectionStatus`/`AnimalView` opto tests;
`ValidationSummary` 0-valid test). The cameras-overflow state gained a committed regression
(`e2e/workspace-responsive-cameras.spec.js`).

## Tasks 2–8 — findings (consolidated)

The full per-task tables (interaction consistency, form quality, hierarchy, responsive, a11y, content,
perf) were produced by the audit. Below is the **fix log** and the **remaining debt**; the strongest
positives are noted at the end.

---

## Fixed this phase

### `blocks safe use`

| id | Finding | Fix | Commit |
| --- | --- | --- | --- |
| T2-01 | Partial optogenetics showed **"Done"** in the days-tab setup card while the section-nav showed **"incomplete"** — a self-contradiction that could make a user believe opto was configured when it was empty | `sectionStatus.js` `SETUP_SECTION_IS_CONFIGURED.optogenetics` now uses `getAnimalOptoCompleteness === COMPLETE`, so card + nav + export gate agree (partial → "To do"/incomplete). Cross-cutting consequence handled: the AnimalView "Not used — no stimulation" chip was re-keyed to the **NONE** state only (a partially-configured animal IS using opto, so "Not used" would be wrong). | `1684e3b`, `0855fff` |

### `likely confusion`

| id | Finding | Fix | Commit |
| --- | --- | --- | --- |
| **F11-A** | **Global CSS class collision** — the legacy form's `.validation-summary` error-pink styling leaked onto the **workspace** Validation & Export panel + `#/validation`, so a fully VALID animal rendered in alarming error-pink with a red border (and caused the one text-contrast failure). | Scoped the legacy rules under `.animal-creation-form .validation-summary` in `Home.css`; the workspace panel is now neutral (verified `background: transparent; border: 0`). | `492efbd` |
| T5-1 | Cameras table: with long camera/lens names the **Edit/Remove actions were pushed off-screen and unreachable** at desktop. | `overflow-x:auto` wrapper + `table-layout:fixed` + ellipsis on free-text columns (title on hover); committed regression `e2e/workspace-responsive-cameras.spec.js`. | `492efbd` |
| F-12 | Camera-calibration **repair path was a broken door**: filling a previously-blank `meters_per_pixel` on a camera fired the same-name identity guard, reporting the camera as conflicting **with itself** ("give this camera a new name") — breaking the exact repair the app directs users to. (Flagged top-priority by both the Phase-10 and Phase-11 UX reviews.) | For the SELF comparison only (same id+name), dependent fields whose **saved** value was empty are dropped before the divergence check — filling a blank completes the identity rather than diverging it. The cross-animal/cross-camera reuse guard is untouched (still fires on a populated→different change or a different camera reusing a name). TDD: blank→value RED-then-GREEN; populated→different still blocks; cross-camera still blocks. | `9347773` |
| F-07 | "Review existing data" banner shown for every established animal regardless of corruption — competed with the primary action and read as a standing task. | `showReview = hasCorruption` (raw-shape corruption / corrupt index / orphan / wrong-owner only); a clean established animal no longer shows it. | `0855fff` |
| F-08 | "Export Valid Only" was active when **0 days were valid**, silently exporting nothing. | disabled with an accessible reason ("No valid days to export — fix errors first") when `valid === 0 && error > 0`. | `0855fff` |
| F-06b | AnimalView "Animal not found" return was a weak inline link (DayEditor's was already styled). | prominent `error-state-action` styled "← Back to Workspace". | `0855fff` |
| H-01 | "subject_id" header badge showed a raw schema key on every animal tab. | → "animal ID". | `0855fff` |
| H-03/H-04/C-09 | TAB_SCOPE descriptors: electrode-groups said "forks a configuration version" (dev jargon); channel-maps said "mark bad channels" (**wrong** — bad channels are day-level); DIO had no scope cue bridging "DIO"↔"behavioral events". | rewrote all three to plain, correct language. | `0855fff` |
| C-03 | Per-day delete confirm didn't say tasks/failed-channels/session metadata are removed. | message now previews the cascade. | `0855fff` |
| Forms a11y | `session_description` / `experiment_description` and the electrode-group required fields conveyed "required" only via CSS (no `required`/`*`); coordinates had no unit. | added `aria-required` + visible `*` markers; AP/ML/DV labels show the unit (mm). | `1e34981` |
| C-05/C-06 | Opto incomplete message conflated the app gate with the downstream pipeline; DIO empty-state referenced a "Use on this day" control that doesn't exist under that name in the day flow. | split into two clear sentences; rewrote the DIO guidance to the real mechanic. | `1e34981` |

### `polish`

| Finding | Fix | Commit |
| --- | --- | --- |
| Save spinner not gated by `prefers-reduced-motion` (WCAG 2.3.3); disabled pager contrast ~2:1 | reduced-motion guard added; disabled pager → explicit ≥3:1 muted color | `492efbd` |
| Opto placeholders "xxx nm/W"; `reference` field no placeholder/help | concrete examples + "e.g. bregma" + help | `1e34981` |
| Modal title "Edit recording system" (lowercase); ElectrodeGroups empty-state heading level; "Inherited" badge read as read-only; back-button aria-label casing; animal-delete placeholder showed the literal answer; preflight row order; "Resolve N validation errors" shown with 0 errors | title-cased; heading→h3; badge→"Updates all days"; aria-label cased; placeholder→instruction; config-version moved up in preflight; 0-error message reworded | `1e34981`, `1684e3b` |
| `npm run lint` linted the generated Playwright report's minified bundles (2025 spurious errors) | added `playwright-report`/`test-results` to `.eslintignore` | `5e7facc` |

**Objective accessibility measurements (Task 6):** computed contrast verified — status chips
(error/incomplete) 4.9:1, repair links 4.9:1, preflight `dt/dd` 5.5–13.7:1, blocking ● 5.4:1 (≥3:1
non-text) all PASS; the one FAIL (green valid-count 4.49:1 on the leaked pink card) is resolved by
F11-A (neutral background). Modal focus trap+restore (camera + electrode) confirmed; status changes
announced via `role="status"`/`role="alert"`/`aria-live`; status conveyed by text+icon, not color
alone; reduced-motion respected after the spinner fix. Autosave feedback (`⟳ Saving… → ✓ Saved`) is
timely and unambiguous; no validation flicker; long editors don't freeze.

---

## Remaining UX debt (tracked follow-ups — do NOT block cutover)

| id | Sev | Finding | Recommended fix |
| --- | --- | --- | --- |
| F-04 | `likely confusion` | Camera `meters_per_pixel` not visible in the **batch-triage scan** rows (`#/validation`, per-animal export) — a recalibration is invisible during catch-up. (The export **preflight** now shows it; this is the earlier triage view.) | Add a calibration summary to the Validation/per-animal-export setup-scan column. Known-deferred batch-scan enrichment. |
| F-11 | `likely confusion` | Config-version label differs across surfaces (`config v1` on `#/validation` vs `config from <date>` per-animal) and lacks an explicit latest/historical marker. | Unify the label + add a latest/historical indicator. |
| F-10 | `likely confusion` | Session description not surfaced in batch rows even when set (shows "—"). | Investigate the row binding (the value exists at `day.session.session_description`); surface or expand it. |
| T8-2 | `likely confusion` | No save indicator on the AnimalView setup tabs (cameras/electrodes/recording-system/DIO) — animal-level edits lack the day-editor's "Saved" confidence cue. | Reuse the `SaveIndicator` (wired to workspace persistence state) in the AnimalView panel header. |
| H-05* | `polish` | Some scope/label wording and the device_type opaque probe identifiers (e.g. `128c-4s8mm6cm-20um-40um-sl`) could carry a human summary. | Add a human summary to device_type options (`valueList.deviceTypes`), carefully (selector-stable). |
| Mobile | `polish` | At 390px the batch preflight `<dd>` values and the `#/validation` table can overflow horizontally (the cameras table is fixed). | Add `overflow-wrap`/single-column at narrow widths + a scroll wrapper on the validation table. |
| T2-02* | `polish` | A few empty-state heading levels still vary across setup tabs. | Normalize remaining empty-state heading levels. |

> The starred items (`H-05*`, `T2-02*`) were partially addressed; the residual is the noted remainder.

---

## Strongest positives (verified)

Species dropdown stores the binomial; camera-modal identity guidance is proactive; opto is an
unambiguous three-state with the corrected "Not used" chip; electrode-group coordinate labels use full
anatomical names; section-nav blocking dots are blocking-only and now agree with the setup card and
export gate; repair buttons route to the owning step in scientific language; the export preflight is
scannable and (after the reorder + Phase-10 calibration fix) leads with animal/day → configuration →
recording hardware; autosave/validation/export feedback is timely; modal focus is trapped and
restored; status is conveyed beyond color.

---

## Cutover recommendation

**No `blocks safe use` debt remains.** The opto card/nav contradiction, the high-visibility error-pink
CSS collision, AND the camera-calibration repair-path "broken door" (F-12 — which the Phase-11 UX
review argued should gate cutover) are all fixed and verified. The remaining `likely confusion`/`polish`
items are real but recoverable and are appropriate fast-follows for the v3-cutover window. **This
plan's correctness/usability/polish arc (Phases 1–11) is complete; the workspace is coherent,
consistent, accessible, and visually trustworthy enough to be the cutover target.** The separate v3-workspace-cutover Phase 11
(default-route flip) may proceed onto this audited IA, gated only by the **deferred downstream
round-trip** (`trodes_to_nwb` → `nwbinspector --config dandi` → `dandi validate` → Spyglass ingest;
see `docs/PIPELINE_REQUIREMENTS.md`) and a recommended **human lab-user dry run** — both outside this
Claude-executable phase.

## Gates at handoff

`npx vitest run` → 4519 passed · `npx vitest run baselines` → 125 byte-identical · `npm run lint` →
0 errors · `npm run build` → OK · `npx playwright test e2e/workspace-*.spec.js …` → 87 passed
(incl. the new cameras-overflow regression).
