# Design Feedback Evaluation — Hypothesis Tree & Research Notes

**Date:** 2026-06-10 · **Branch:** `modern` · **Status:** ✅ EVIDENCE GATHERED (investigation-only, no code changed)

Evaluates six design-feedback observations from the user plus a re-assessment of
`docs/POST_V3_FOLLOWUPS.md`. Evidence gathered via 7 parallel read-only code investigations.

## How to read this file

Each finding (F#) follows: **Observation → competing hypotheses → evidence (file:line) →
calibrated confidence (prior → posterior) → recommendation + blast radius.**

- **Confidence:** calibrated probability the stated hypothesis is correct. **Prior** = before
  evidence; **Posterior** = after. Calibration notes at the bottom.
- **Blast radius:** 🟢 merge-neutral (UI/state only, golden baselines untouched) · 🟡 merge-changing
  (alters exported YAML — TDD + byte-identical baselines + migration) · ⚪ docs/UX-copy only · 🔴 unsafe.

Hard constraint: **125 golden baselines byte-identical** (`npx vitest run baselines`). Any 🟡 is gated on it.

---

## F1 — Remove the channel-maps functionality

**Observation:** "No one uses the channel maps functionality; it should be removed."

**Verdict: 🟢 MERGE-NEUTRAL. Removing the editing UI is safe; the exported `ntrode_electrode_group_channel_map` is auto-generated and stays.** (H1 confirmed.)

**Evidence:**
- The "Channel Maps" tab is three components: `src/pages/AnimalEditor/ChannelMapEditor.jsx` (335-line
  modal), `ChannelMapsStep.jsx` (read-only summary table), `wiring/ChannelMapsContainer.jsx` (state +
  CSV import/export); routed from `src/pages/AnimalView/index.jsx:186`.
- The editor edits **only the `map` object** (probe-electrode→hardware reorder). It explicitly does
  **not** touch `bad_channels` (those are day-owned; `ChannelMapEditor.jsx:9-17` documents "WIRING-ONLY").
- Maps are **auto-generated on device-type selection, independently of the editor**:
  `ElectrodeGroupsContainer.handleSaveGroup` → `generateChannelMapsForGroup` (`channelMapUtils.js:51-83`)
  builds identity maps from the probe catalog. Deleting the editor does **not** break map generation.
- Export path: `mergeDayMetadata` → `resolveDayConfig` emits `ntrode_electrode_group_channel_map`
  unconditionally (`workspaceUtils.js:328,429`). The map is **required** in the YAML — must be preserved.
- **All 4 golden fixtures use IDENTITY maps only** (`{0:0,1:1,…}`; multi-shank partitions `0..N`). No
  fixture exercises manual reordering → removing the reorder UI loses **zero** baseline data, baselines
  stay byte-identical.
- Legacy `src/ntrode/ChannelMap.jsx` is a separate editor on the frozen legacy path only — independently deletable.

**Caveats / open product decisions:**
- "Loses zero *baseline* data" ≠ "no user ever reordered." The user has decided no one uses it — this is
  a product call already made; we're confirming it's *technically* safe.
- ChannelMapsContainer also has **CSV import/export** of maps — removed along with the editor (minor utility loss).
- **Decision:** remove the tab entirely, or keep a **read-only** "auto-generated wiring" view? Lean:
  remove the editing affordance; a thin read-only view is optional.
- Removing the editor **moots Post-v3 #9** (ChannelMapEditor empty-state dead-end) and the
  ChannelMapEditor empty-state heading inconsistency.
- 🔴 Do **not** remove `ntrode_electrode_group_channel_map` from the export (hypothetical H3) — breaks trodes_to_nwb + all baselines.

**Confidence:** H1 (UI-only, merge-neutral) **prior 70% → posterior 92%.** H3 (export removal) ruled out.

---

## F2 — Recording days should always be ordered (duplicate can unorder them)

**Observation:** "Recording days should always be ordered; duplicating can make them unordered."

**Verdict: Root cause confirmed — `createDay`/`duplicateDay` append without sorting. 🟢 merge-neutral fix = canonical sort-on-write.** One honest caveat below.

**Evidence:**
- Days are an **ordered ID array** `animal.days`. Both `createDay` (`useWorkspace.js:420`) and
  `duplicateDay` (`useWorkspace.js:500`) do `days: [...getAnimalDayIds(animal), dayId]` — **append, never
  re-sort by date.** Dates are ISO `YYYY-MM-DD` (lexicographically sortable). Duplicating to an earlier
  date lands it at the end of the array.
- Duplicate-date collision is prevented: dayId derives from (animalId, date); a dup date throws (`:469`).
- **Most consumers sort on read** and are therefore safe: `getAnimalDays` (`:735`), `RecordingDaysTab`
  (`:157`), `getMostRecentDayId` sorts before picking latest (`workspaceSelectors.js:99`), YAML export
  iterates the `days` dict (not the array), bad-channel monotonicity uses order-independent ISO string
  compare (`badChannelMonotonicity.js:68`). YAML import builds days in date order (`yamlImportPlan.js:25`).

**Caveat (calibration correction):** because the surveyed display surfaces all sort-on-read, the agent
could **not** point to a currently-broken visible surface — yet the user reports *seeing* unordering. Two
possibilities: (a) a surface that reads raw `animal.days` order exists but wasn't surveyed (e.g.
day-to-day navigation / a calendar enumeration), or (b) it was visible in an earlier build. **The
canonical fix (sort `animal.days` by date on write) is correct either way and is defense-in-depth** —
it makes every future reader safe regardless. Confirm the exact surface the user saw when fixing.

**Confidence:** root cause = append-without-sort **prior 60% → posterior 95%.** Currently-user-visible
**~55%** (unresolved — but does not change the fix). Fix is 🟢 merge-neutral, ~10-line change at 2-3 sites.

---

## F3 — Keyboard shortcuts & lab logo are "hidden behind everything"

**Observation:** "The keyboard shortcuts and lab logo are hidden behind everything."

**Verdict: Likely a single z-index root cause (logo + shortcuts *trigger* share one container painted under the nav). NOT yet browser-verified.**

**Evidence (CSS reading):**
- The lab **logo** and the **shortcuts-trigger button** both live in `.home-region` (`AppLayout.jsx:248-270`).
- `.home-region` has `position: relative` (desktop: `position: fixed`) but **no `z-index`** → `auto`/0
  (`App.scss:20-33,572`). `.primary-nav` has `z-index: 1` and comes later in the DOM (`index.css:22-35`)
  → the nav paints **over** the home-region. That occludes both the logo and the shortcuts trigger.
- The shortcuts **modal** itself is fine (`Modal.scss z-index:1000`) — only the *trigger* and logo are covered.
- Broader smell: z-index values are ad-hoc magic numbers with no scale (0, 1, 2, 10, 20, 40, 100, 999,
  1000). **This is the same disease as F6** (no design system).

**Caveat (important):** this is a CSS-reading hypothesis, **not reproduced in the browser.** Per the
"diagnose layout bugs in the browser" rule, the fix must be verified by reproducing in Playwright and
measuring the rendered occlusion — `position: fixed` + stacking-context interactions can surprise. Treat
the root cause as *probable*, not proven.

**Confidence:** z-index/stacking (vs overflow-clip) **prior 75% → posterior 80%.** Specific mechanism
(home-region no z-index vs nav z-index:1) ~80%. Fix is 🟢 (give `.home-region` a higher z-index / fix
layering), trivial once browser-confirmed.

---

## F4 — Tasks & Epochs is the most confusing screen; remove the emoticon

**Observation:** "Most confusing screen — too much going on, hard to understand the elements; remove the emoticon."

**Verdict: Confirmed — it's not a "step," it's a container for ~7 editors with cross-references. Fixable in two tiers: 🟢 quick wins now, 🟡 deeper model change later.**

**Evidence — the screen (`src/pages/DayEditor/TasksEpochsStep.jsx`) stacks 7 sub-surfaces:**
1. TasksTable + TaskModal (task name/description/environment/cameras/epochs), 2. AssociatedVideosEditor,
3. AssociatedFilesEditor, 4. BehavioralEventsDisplay (inherited + day-specific DIO), 5. FsGuiSection
(opto), 6. repair/confirm dialogs, 7. camera-setup banner. The TaskModal alone has 4 accordions with
4 different validation scopes. Compare: OverviewStep is a flat form; this step is ~9 child components.

**Emoji found (user said "the emoticon," singular):**
- 🧩 puzzle — `TasksTable.jsx:149` (empty-state icon) ← most prominent/decorative; likely the target.
- 📹 camera — `TasksEpochsStep.jsx:314` (camera banner). 🔒 lock — `BehavioralEventsDisplay.jsx:101`.
- Status glyphs ✓/⚠/❌ are text, functional. **Recommend removing the decorative 🧩 (and likely 📹/🔒) for a professional look.** Confirm scope with user.

**Confusion sources (concrete):** dual-field epoch entry (epoch *number* persists; start/end times are
ephemeral, `TaskEpochsEditor.jsx:149`); inherited events shown read-only inside the edit modal (unclear
purpose); "repair-before-orphaning" constraint is invisible until a delete triggers it; inconsistent
add-button labels; status glyphs encode two orthogonal problems under ⚠; no intro paragraph defining
task vs epoch.

**Fix tiers:**
- 🟢 **Quick wins (in-place, no export change):** remove decorative emoji; add an intro explaining
  task↔epoch; replace glyph badges with text+color labels; collapse the optional Cameras accordion by
  default; clarify the epoch number-vs-timing copy; move read-only inherited events out of the edit modal.
- 🟡 **Deeper (model):** promote epochs to a first-class day collection and/or a **task-type catalog**
  (days pick+order epochs) — overlaps the scope-tiers Thread-2 task-catalog idea; merge-changing,
  baseline-gated.

**Confidence:** confusion is real **(95%)**; quick-wins materially help without touching export **~70%**;
full relief needs the model change **~50%**.

---

## F5 — DIO naming/index guidance was richer in legacy

**Observation:** "Legacy had more guidance on how to name DIOs and what index they're associated with (I think index = ordering)."

**Verdict (CORRECTED after user feedback): The user is right — legacy has an explicit "Index" field.** The
workspace replaced legacy's **structured Type + Index** DIO entry with a single **free-text Description**
input, losing both the guided dropdown and the index control. Fix = restore the structured entry — which
emits the *identical* `description` string, so 🟢 merge-neutral / round-trip-safe.

**Evidence (read directly, correcting the subagent):**
- Legacy DIO uses `SelectInputPairElement` (`BehavioralEventsFields.jsx:47-63`): a **Type** `<select>`
  (`Din/Dout/Accel/Gyro/Mag`, from `behavioralEventsDescription()`) **+** a numeric input **literally
  labeled "Index:"** (`SelectInputPairElement.jsx:123`, `type="number" step="1" min="0"`).
- On blur it concatenates `` `${selectRef.value}${inputRef.value}` `` → e.g. `"Din"` + `"1"` = `"Din1"`,
  stored as `behavioral_events[].description` (`SelectInputPairElement.jsx:77-88`). `splitTextNumber`
  (`:14-49`) parses an existing description back into `{text, number}` to repopulate the two controls.
- So "index" = the **numeric suffix of the DIO line** (Din**1**, Dout**3**) — the hardware DIO
  line/channel number. The user's "ordering" intuition is in the right neighborhood: it indexes the
  hardware DIO line, not display order.
- The schema field is still a single `description` string (`nwb_schema.json`); legacy just provides a
  *structured* way to build it. Per `docs/PIPELINE_REQUIREMENTS.md:45`, that string is matched against the
  `.rec` hardware; a description matching no hardware channel → a **silently empty** event series (so
  getting Type+Index right matters, and the failure is silent downstream).
- **Workspace** (`AnimalEditor/BehavioralEventsSection.jsx`) offers one free-text field
  (`"Description of this event"`) — dropping the Type dropdown AND the Index number control. (It *added*
  good library/day-inheritance copy + name validation, but lost the structured hardware entry.)

**Recommendation:** restore the **structured Type + Index** DIO entry in the workspace editor (reuse the
legacy split/join so it emits the identical `"Din1"`-style string → merge-neutral & round-trip-safe);
keep the InfoIcon example; and label it "DIO line index" so the meaning is explicit. This both brings back
the guidance and reduces free-text error.

**Confidence:** legacy HAS an Index field — **confirmed (read the code).** Meaning = hardware DIO line
number — **~88%.** Restoring structured entry is merge-neutral — **~90%** (same output string).

**⚠️ Calibration miss:** my earlier "there is NO index field" was **wrong** — the subagent read only the
`type="number"` attribute and missed that `SelectInputPairElement` is a Type-select + Index-number pair.
The user caught it. Lesson: when a subagent's conclusion contradicts a user's first-hand knowledge of
their own app, read the component myself before locking the finding.

---

## F6 — Styling is inconsistent

**Observation:** "The styling of everything isn't consistent, which is confusing."

**Verdict: Confirmed — a partial token system (~60% adoption) over legacy ad-hoc styling, global CSS with no scoping → class collisions. 🟢 (visual) but the highest-effort item.**

**Evidence:**
- Tokens **exist** (`src/index.css` `:root`: `--color-primary:#1565c0`, grey scale, `--spacing-*`,
  `--font-size-*`, transitions) but adoption is partial. Newer files (DayEditor.scss, Home.css) use them;
  older (App.scss, AnimalSwitcher.css, ConfirmDialog.scss) hardcode.
- Same concept styled many ways: primary button `#1565c0` vs `#1976d2` vs `#0066cc` vs `#2563eb`;
  `.button-danger` `#dc3545` (App.scss:372) vs `#d32f2f` (ConfirmDialog.scss:55); **validation-error uses
  two different icons** — `⚠` (App.scss:606) vs `✗` (DayEditor.scss:397).
- `.button-primary` redefined in **6 files**; `.button-secondary` in 5; generic global names
  (`.form-field`, `.status-chip`, `.section-nav`, `.modal-content`) collide across files (no scoping).
- Greyscale largely hardcoded (`#333/#555/#666/#999/#ccc/#ddd`); no `--radius-*` or `--shadow-*` tokens.
- ~424 hex literals reported — **treat as directional** (the grep likely counts rgba()/comment colors);
  the *qualitative* sprawl is solidly evidenced regardless.

**Recommendation:** a consolidation pass — extend tokens (grey, radius, shadow, the z-index scale from
F3), dedupe `.button-*`/`.form-field`/modal into shared rules, scope component class names, replace the
divergent error icon. Pairs naturally with F3 (z-index scale) and the F4 polish. High effort, broad,
mostly visual; do as a dedicated pass + opportunistic token adoption in any component we touch.

**Confidence:** "no enforced system, significant inconsistency" **prior 85% → posterior 95%.**

---

## P — Re-evaluation of `docs/POST_V3_FOLLOWUPS.md` (verified against current code)

| Item | Status | Evidence | Note / cross-link |
| --- | --- | --- | --- |
| #1 appliedToDays denormalization | **OPEN** | `workspaceTransitions.js:139,219,275` still stores+writes it | gated behind #6 (persisted-shape change) |
| #2 Reconfig wizard UX | **OPEN** | `ReconfigWizard.jsx` no select-all/human labels/confirm | small 🟢 UX |
| #3 Alt+←/→ vs Back/Forward | **OPEN** | `useGlobalShortcuts.js:63` still preventDefaults | revisit w/ feedback |
| #4 Persisted-"Validated" indicator | **OPEN** | `ValidationSummary/index.jsx:46` deriveChip ignores `state.validated` | small 🟢 |
| #5 Structured error logging | **OPEN** | `ValidationSummary/index.jsx:136+` console.error | cross-app, low priority |
| #6 Persistence forward-migration | **OPEN — CRITICAL** | `persistence.js:30,51,62` declares MIGRATABLE_SCHEMA_VERSIONS=[1] but **no migration logic**, discards on mismatch | **release-gating; blocks #1 + any 🟡 persisted-shape change** |
| #7 CalendarDay roving tabindex | **OPEN** | `CalendarDay.jsx:74` still `tabIndex={isToday?0:-1}` | a11y; near F2 area |
| #8 CalendarGrid role=row split | **OPEN** | `CalendarGrid.jsx:90` 42 cells in 1 `role=row` | a11y; near F2 area |
| #9 ChannelMapEditor empty-state | **OPEN → MOOT if F1 ships** | `ChannelMapEditor.jsx:108` | **superseded by F1 removal** |
| #10 addConfigurationSnapshot divergence | **MOOT** | atomic `createConfigurationSnapshotAndApplyForward` (`useWorkspace.js:291`) | resolved by design |
| device_type human summaries | **OPEN** | `valueList.js` deviceTypes still bare IDs | small 🟢; keep option *values* stable |
| empty-state heading levels | **MOSTLY FIXED** | sections use `<h3>`; only ChannelMapEditor differs | moot via F1 |

---

## Cross-cutting synthesis & recommended sequencing

**The feedback splits into three risk tiers:**

**Tier A — 🟢 quick, low-risk, high-value (each independently shippable):**
- **F2** day sort-on-write (~10 lines; fixes the reported ordering, defense-in-depth).
- **F3** logo/shortcuts z-index (trivial CSS; **browser-verify first**).
- **F5** DIO hardware-naming guidance (copy + example dropdown; prevents silent data loss).
- **F4 quick wins** (remove emoji, add intro, text status labels, collapse optional accordions).
- Small Post-v3 UX: #4 validated indicator, #2 reconfig wizard, device_type summaries.

**Tier B — 🟢 but larger / structural-UI:**
- **F1** remove channel-maps editor (merge-neutral; moots #9 + the heading inconsistency). Decide read-only-view vs none.
- **F6** styling consolidation (extend tokens incl. a z-index scale [absorbs F3's root smell] + radius/shadow,
  dedupe `.button-*`/form/modal, scope class names, unify the error icon). Broad but mostly visual.

**Tier C — 🟡 merge-changing / gated (plan carefully, baseline + migration):**
- **#6** persistence forward-migration — **prerequisite** for #1 (appliedToDays) and any persisted-shape change.
- **F4 deep fix** — task-type catalog / epochs-as-day-collection (overlaps scope-tiers Thread 2).
- **#1** appliedToDays → derived (after #6).

**Suggested order:** Tier A batch first (fast wins, fixes the two bugs + the silent-data-loss guidance) →
F1 removal (clears the channel-maps surface + moots a follow-up) → F6 consolidation (foundation that makes
F4/F3 polish stick) → Tier C as a separate planned effort.

---

## Self-critique & calibration log

- **F1:** prior 70%→posterior 92%. Slightly *under*-confident prior; evidence (auto-gen independent of
  editor + identity-only fixtures) was decisive. Risk avoided: did NOT assume "delete tab = delete export."
- **F2:** root-cause prior well-calibrated (60%→95% confirmed). **Mis-calibration caught:** I implicitly
  assumed the bug is user-visible; evidence shows displays sort-on-read, so visibility is *unconfirmed
  (~55%)*. Recorded honestly; fix is correct regardless.
- **F3:** within-prior (75%→80%). **Discipline flag:** CSS-only hypothesis, NOT browser-verified — per the
  layout-debug memory rule, must reproduce in Playwright before claiming fixed. Not overstated.
- **F4:** confusion confirmed; the real uncertainty is *scope of fix* (quick-win vs model change), presented as two tiers rather than one answer.
- **F5:** **I got this wrong and the user corrected me.** The subagent reported "no index field" from the
  `type="number"` attribute alone; in fact legacy renders a Type-select + a field labeled "Index:"
  (`SelectInputPairElement.jsx:123`). Verified by reading the component directly. Real finding: workspace
  replaced legacy's *structured* Type+Index entry with free text. Lesson logged in the F5 section: when a
  subagent contradicts the user's first-hand app knowledge, read the source myself before locking.
- **F6:** the "424 colors" figure is directional, not exact (rgba/comments inflate grep counts); the
  qualitative verdict stands on file:line examples.
- **General:** all conclusions rest on read-only static analysis by subagents. The two *bug* claims (F2
  visibility, F3 occlusion) carry residual uncertainty that only running the app resolves — flagged, not buried.

## Decision log

- 2026-06-10: Scoped the evaluation; fanned out 7 read-only investigations across F1–F6 + P.
- 2026-06-10: Evidence in. F1 confirmed merge-neutral; F2/F3 root-caused (F3 pending browser verify);
  F6 confirmed. Post-v3 #9 mooted by F1, #10 already moot, #6 flagged release-gating. Recommended A/B/C sequencing.
- 2026-06-10: **User corrected F5** — legacy DOES have an "Index" field (Type-select + Index-number pair).
  Re-verified in source; F5 rewritten: fix is to restore the structured DIO entry (merge-neutral).
  **Awaiting user direction on what to build & in what order.**
