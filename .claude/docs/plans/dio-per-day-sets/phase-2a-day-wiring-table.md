# Phase 2a — Day-level DIO wiring table (Inputs / Outputs)

[← back to PLAN.md](PLAN.md) · design rationale: [§5 UX design](PLAN.md#5-ux-design-the-heart), [§6 consistency](PLAN.md#6-consistency-with-the-rest-of-the-app)

Rebuild the **per-day** behavioral-events editor (`BehavioralEventsDisplay`) into a wiring
table grouped into **Inputs (Din)** and **Outputs (Dout)**, in the user's language, with the
guided Type/index controls **moved down** from the animal editor (not rebuilt). The animal-level
library and its "Use on this day" inherited list stay untouched in this phase — they are removed
in [phase-2b](phase-2b-retire-animal-library.md). This phase is a net-new day UI; it changes no
exported YAML (golden baselines stay byte-identical).

**Inputs to read first:**

- [src/pages/DayEditor/BehavioralEventsDisplay.jsx](../../../../src/pages/DayEditor/BehavioralEventsDisplay.jsx) — the surface being rebuilt. Today: inherited read-only list with 🔒 + "Use on this day" (`handleUseOnThisDay`, lines 54-56; inherited block lines 86-123); day-specific section (lines 126-216) with the day-event add editor (lines 170-215); inline duplicate-description error via the shared helper (line 48); duplicate-vs-inherited name warning (line 39). **Only the day-specific editing portion becomes the wiring table here; leave the inherited "Use on this day" block in place for 2b.**
- [src/pages/DayEditor/TasksEpochsStep.jsx:360-366](../../../../src/pages/DayEditor/TasksEpochsStep.jsx#L360-L366) — mounts `BehavioralEventsDisplay`; passes `inheritedEvents={getAnimalBehavioralEvents(animal)}` (line 124), `dayEvents={getDayBehavioralEvents(day)}` (line 125), and wires `onDayEventsChange` → `onFieldUpdate('behavioral_events', events)` (line 364).
- [src/pages/AnimalEditor/BehavioralEventsSection.jsx:294-344](../../../../src/pages/AnimalEditor/BehavioralEventsSection.jsx#L294-L344) — the guided **Type** `<select aria-label="DIO type">` + **Index** `<input aria-label="DIO line index">` cluster (`.dio-description-fields`) and the `descriptionWillBeRewritten` inline note. **Move this control cluster down into the day table; keep the same `aria-label`s, the `splitDioDescription`/`joinDioDescription` round-trip, and the rewrite-warning.** Supporting parse at lines 250-254.
- [src/utils/dioDescription.js](../../../../src/utils/dioDescription.js) — `splitDioDescription` (line 25; empty→`{Din,1}`, unrecognized type→`''`), `joinDioDescription` (line 56). Reuse verbatim.
- [src/validation/behavioralEvents.js:18](../../../../src/validation/behavioralEvents.js#L18) — `duplicateBehavioralEventDescriptions(events)`, the shared helper that the inline gate and export Rule 17 ([rulesValidation.js:1016](../../../../src/validation/rulesValidation.js#L1016)) both use. Keep sharing it.
- [src/valueList.js:905](../../../../src/valueList.js#L905) — `behavioralEventsNames()` (Name suggestions); [:931](../../../../src/valueList.js#L931) — `behavioralEventsDescription()` returns `['Din','Dout']`.
- **Section conventions to mirror** (cited in [§6](PLAN.md#6-consistency-with-the-rest-of-the-app)): [CamerasSection.jsx](../../../../src/pages/AnimalEditor/CamerasSection.jsx) section shell (lines 152-163) + empty-state block (lines 134-148); [TasksTable.jsx](../../../../src/pages/DayEditor/TasksTable.jsx) status-badge glyph+`sr-only` (lines 216-224) and `ConfirmDialog` delete (lines 244-252, handler 111-116); inline validation `div.inline-error[role=alert]` / `div.inline-warning[role=status]` with `aria-invalid`+`aria-describedby` ([BehavioralEventsSection.jsx:283-292, aria at 278-279](../../../../src/pages/AnimalEditor/BehavioralEventsSection.jsx#L278-L292)). `ConfirmDialog` is [src/components/Modal/ConfirmDialog.jsx](../../../../src/components/Modal/ConfirmDialog.jsx).

## Tasks

- **Add a direction selector + Inputs/Outputs grouping to the day events model.** A DIO event's
  direction is derived from its `description` Type via `splitDioDescription(description).type`
  (`Din` → Input, `Dout` → Output). Render two labelled groups in `BehavioralEventsDisplay`'s
  day-specific section — an **"Inputs (Din) — sensors the animal triggers"** block and an
  **"Outputs (Dout) — things you drive"** block — each a `role="table"` following the
  CamerasSection shell (`header.section-header` with `<h2>`/`<p>`, then `div.table-actions` with a
  `button-primary`). An event with an unrecognized/analog `description` (Type `''`) sorts into a
  third "Other" group rather than disappearing. Do **not** change storage: `day.behavioral_events`
  stays a flat array of `{ description, name }`; grouping is presentation only.

- **Move the guided Type/Index control cluster into each table row.** Copy the
  `.dio-description-fields` JSX (Type `<select aria-label="DIO type">` + Index
  `<input aria-label="DIO line index">` + `InfoIcon`) and the `descriptionWillBeRewritten`
  inline warning from [BehavioralEventsSection.jsx:294-344](../../../../src/pages/AnimalEditor/BehavioralEventsSection.jsx#L294-L344) into the day row's editor. Keep the
  `splitDioDescription`/`joinDioDescription` round-trip and the same `aria-label`s. **Do not edit
  the frozen legacy `src/element/SelectInputPairElement.jsx`.** (The animal editor keeps its own
  copy until [phase-2b](phase-2b-retire-animal-library.md) removes that surface; extracting a
  shared `<DioLineFields>` component is acceptable if it reduces duplication, but is not required.)

- **Relabel the fields in the user's language** ([§5.1](PLAN.md#5-ux-design-the-heart)). The
  column/field for `description` is labelled **"DIO channel"**; the field for `name` is labelled
  **"Event"**. **YAML keys are unchanged** — this is display text only. Add a one-line hint on the
  Event field: *"becomes the DIO event's name in the NWB file"* (closes the NWB
  `name`/`description` inversion noted in [§2](PLAN.md#2-verified-ground-truth-the-anchor--independently-re-verified-do-not-re-litigate-without-re-checking-these-sources); no separate preview panel).

- **Add the one-time direction legend + per-field hints.** Render a short, *programmatically
  associated* text legend stating **Din = inputs / Dout = outputs** (not an emoji glyph alone —
  WCAG 1.4.1). Per-field hints carry real examples (e.g. "Din1", "left well poke"). No literal ECU
  hardware diagram (the table is the diagram — [§3.10](PLAN.md#3-decisions)).

- **Keep the shared inline gates.** The day-event **Name** field keeps Rule 14's uniqueness
  surfaced inline (duplicate `name` within the day set), and the **duplicate-`description`** gate
  keeps using `duplicateBehavioralEventDescriptions` ([behavioralEvents.js:18](../../../../src/validation/behavioralEvents.js#L18)) so the inline gate and export Rule 17 never diverge. Use the
  Name combobox (`SuggestionCombobox` with `suggestions={behavioralEventsNames()}`, `warnOffList`)
  exactly as the animal editor does today — **plain `onChange`, no `onSelect`** (per-label
  auto-numbering via `onSelect` is [phase-3](phase-3-templates-autonumber.md)).

- **Add/remove rows via the section conventions.** "+ add event" buttons live in each group's
  `div.table-actions`; delete routes through the shared `ConfirmDialog` (destructive), not
  `window.confirm`, naming the event being removed (mirror [TasksTable.jsx:244-252](../../../../src/pages/DayEditor/TasksTable.jsx#L244-L252)).

- **Default view = "review yesterday's set."** The carried-forward set (already deep-copied by
  `createDayRecord` at [workspaceTransitions.js:389](../../../../src/state/workspaceTransitions.js#L389)) is what the table shows on a new day. Add the section explainer copy: *"Behavioral
  events — how your behavioral hardware maps to the SpikeGadgets ECU (carried forward from
  {prior date} · edit only if you rewired the rig)"* when the day was seeded from a prior day.
  Sourcing the prior date: the day record's carry source is not stored on the day; derive the
  "carried from" date from the immediately-earlier same-`configurationVersion` day in
  `getAnimalDays(animal)` (same logic the bad-channels carry-forward note uses), or omit the date
  clause if none exists.

- **a11y polish** ([§5.3](PLAN.md#5-ux-design-the-heart)): every Type/Index control keeps an
  explicit `aria-label`; the Din/Dout legend is associated (e.g. `aria-describedby` from the group
  headers); status/empty states follow the glyph+`sr-only` pattern.

- **Empty state.** When `day.behavioral_events` is empty, show the CamerasSection-style empty
  block (icon + `<h3>` + copy + hint + primary CTA) inviting the user to add the first event or
  (foreshadowing [phase-3](phase-3-templates-autonumber.md)) a standard set.

- **SCSS.** Extend [src/pages/DayEditor/BehavioralEventsDisplay.scss](../../../../src/pages/DayEditor/BehavioralEventsDisplay.scss); reuse the `.dio-description-fields` rules and the
  `.inline-error`/`.inline-warning` tokens. Per [CSS-is-global], scope new structural class names
  under a `behavioral-events`/day-table root so they don't leak app-wide.

- **CHANGELOG.** Add an "Added"/"Changed" entry for the day-level DIO wiring table (Inputs/Outputs
  grouping, relabeled fields, moved guided controls, legend). State explicitly that the exported
  YAML shape is unchanged.

## Deliberately not in this phase

- **Removing the animal-level library or the "Use on this day" inherited block** — that is
  [phase-2b](phase-2b-retire-animal-library.md). This phase leaves both in place; the wiring table
  edits the day-owned set exactly as the day-specific editor does today.
- **Standard-set templates and per-label auto-numbering** ("add 6 pokes → Poke1…Poke6"; `onSelect`
  wiring) — [phase-3](phase-3-templates-autonumber.md).
- **"Mark reconfiguration" history and the `comments` field** — [phase-4](phase-4-reconfiguration-comments.md).
- **Any change to the exported `behavioral_events` shape, `BEHAVIORAL_EVENT_ORDER`, or the
  validation rules.** Storage and export are untouched.

## Validation slice

| Test | Asserts |
| --- | --- |
| `BehavioralEventsDisplay` groups day events by direction | `Din*` events render under "Inputs (Din)", `Dout*` under "Outputs (Dout)", an `Accel5`/unrecognized event under "Other" — none dropped |
| guided Type/Index round-trip in the day row | editing Type→`Dout` + Index→`3` stores `description: 'Dout3'`; opening `Din1` shows Type `Din`, Index `1` and saves back `Din1` unchanged |
| relabeled fields | the `description` control is reachable by the accessible name **"DIO channel"** and `name` by **"Event"**; the Event field exposes the "becomes the DIO event's name" hint |
| direction legend present + associated | a text node stating Din=input / Dout=output exists and is referenced from the group(s) via `aria-describedby` (not emoji-only) |
| duplicate-`description` inline gate still fires | two day events with `description: 'Din1'` surface the inline error via `duplicateBehavioralEventDescriptions` (same helper as export Rule 17) |
| duplicate `name` inline gate (Rule 14) | two day events named `Poke` surface the inline name-uniqueness error |
| delete via `ConfirmDialog` | row delete opens the shared dialog naming the event; confirm removes it, cancel keeps it (no `window.confirm`) |
| carry-forward default copy | a day created with `carryForwardFromDayId` shows the prior day's set in the table; editing it does not mutate the source day (`structuredClone` at `workspaceTransitions.js:389`) |
| **golden baselines unchanged** *(integration)* | `npx vitest run baselines` stays byte-identical — this phase exports no new/different YAML |

## Fixtures

Reuse the existing day/animal test factories used by `BehavioralEventsDisplay.test.jsx` and
`workspace-day.test.js`. Add a small in-memory animal with a day holding mixed-direction events
(`{description:'Din1',name:'Poke'}`, `{description:'Dout7',name:'Pump'}`, and one analog
`{description:'Accel5',name:'imu'}` to exercise the "Other" group + rewrite warning). No new YAML
fixtures needed (export shape unchanged).

## Review

Before opening the PR for this phase, dispatch `code-reviewer` against the diff. Confirm:
- Every task is implemented as specified; the guided controls were **moved**, not rebuilt, and the frozen `SelectInputPairElement.jsx` is untouched.
- The "Deliberately not in this phase" list is honored — the animal library + "Use on this day" block are still present; no template/auto-number/comments scope crept in.
- Validation slice passes; golden baselines byte-identical (`npx vitest run baselines`); full suite + `npm run lint` (0 errors) + `npm run test:e2e` (functional specs) green. (The 7 local-only visual-regression screenshots are pre-existing stale baselines — out of scope.)
- Tests exercise asserted behavior, not tautologies; shared setup is in fixtures.
- No docstring / test name / module name references "Phase 2a" or this plan.
- a11y: Type/Index `aria-label`s present; legend programmatically associated; no color/emoji-only meaning.
