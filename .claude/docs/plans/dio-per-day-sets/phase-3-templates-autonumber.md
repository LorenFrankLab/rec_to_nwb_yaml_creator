# Phase 3 — Standard-set templates + per-label auto-numbering

[← back to PLAN.md](PLAN.md) · design rationale: [§2 ground truth (naming convention)](PLAN.md#2-verified-ground-truth-the-anchor--independently-re-verified-do-not-re-litigate-without-re-checking-these-sources), [§3.4 + §5.4 auto-numbering & templates](PLAN.md#3-decisions)

Speed up building a day's DIO set: **bulk-add canonical sets** ("6 pokes on Din1–6" →
`Poke1…Poke6`) and **per-label auto-numbering** when picking a name suggestion in the day wiring
table. This is where the `SuggestionCombobox` `onSelect` primitive — deliberately kept unused
since Phase 1 — finally gets wired. No exported-YAML shape change.

**Load-bearing convention** ([§2](PLAN.md#2-verified-ground-truth-the-anchor--independently-re-verified-do-not-re-litigate-without-re-checking-these-sources), verified against 98 real lab YAMLs): the number is appended to the label
with **NO separator** (`Poke1`, `Light1`, `Pump1` — **0 of 1864** real names match `Label_<digits>`,
1762 match `Label<digits>`), and the number is a **per-label instance count, NOT the DIO channel
index** (`Pump1` can be `Dout7`). Do not reintroduce the reverted `Label_<index>` form. *(The
checked-in demo sample `20230622_sample_metadata.yml` happens to use underscores like `Light_1`;
that is the sample's user-entered choice and is preserved byte-identically — it is NOT the
auto-numbering format.)*

**Inputs to read first:**

- The day wiring table from [phase-2a](phase-2a-day-wiring-table.md) — the Name `SuggestionCombobox` and each group's `div.table-actions` are the integration points.
- [src/components/SuggestionCombobox.jsx:153-163](../../../../src/components/SuggestionCombobox.jsx#L153-L163) — `selectOption` routes an explicit pick through `onSelect(option)` (vs `onChange` for typing); JSDoc lines 45-47, prop line 66. **No consumer passes `onSelect` today** — this phase is its first use. Picking transforms the chosen label into `label + nextInstanceNumber`.
- [src/valueList.js:905-916](../../../../src/valueList.js#L905-L916) — `behavioralEventsNames()` (`Home box camera`, `Poke`, `Light`, `Pump`, `Run Camera Ticks`, `Sleep`). Add the templates catalog near it.
- [src/utils/dioDescription.js:56](../../../../src/utils/dioDescription.js#L56) — `joinDioDescription(type, index)` builds `Din1`/`Dout1` for template rows.
- [src/validation/rulesValidation.js:712](../../../../src/validation/rulesValidation.js#L712) — Rule 14 (name uniqueness per day; code `duplicate_behavioral_event_name`); [:1016](../../../../src/validation/rulesValidation.js#L1016) — Rule 17 (description uniqueness); shared helper [behavioralEvents.js:18](../../../../src/validation/behavioralEvents.js#L18). Auto-numbering and templates must produce sets that satisfy both.

## Tasks

- **Add a standard-set template catalog.** In `valueList.js` add `behavioralEventTemplates()`
  returning named canonical sets, e.g.:
  ```js
  // Each template is a named set of { name, description } rows using the no-separator
  // Label<n> convention and joinDioDescription for the line. Numbers are per-label instance
  // counts, not asserted to equal the channel — the user re-points channels as needed.
  export const behavioralEventTemplates = () => [
    { id: 'pokes-6',  label: '6 pokes (Din1–6)',   rows: rangeRows('Poke', 'Din', 1, 6) },
    { id: 'lights-6', label: '6 lights (Dout1–6)', rows: rangeRows('Light', 'Dout', 1, 6) },
    { id: 'pumps-6',  label: '6 pumps (Dout1–6)',  rows: rangeRows('Pump', 'Dout', 1, 6) },
  ];
  // rangeRows('Poke','Din',1,6) => [{name:'Poke1',description:'Din1'}, … {name:'Poke6',description:'Din6'}]
  ```
  `rangeRows` builds `{ name: \`${label}${n}\`, description: joinDioDescription(type, n) }`. Keep
  template counts/labels editable in one place. (Channel ranges here are a sensible default; the
  user re-points any row in the table afterward.)

- **Add a "+ add a standard set ▾" control to the day wiring table.** In the Inputs/Outputs
  section actions (phase-2a), add a menu listing `behavioralEventTemplates()`. Selecting one
  **merges** its rows into `day.behavioral_events`, **skipping rows whose `name` OR `description`
  already exists** in the day set (so re-applying a template, or applying into a non-empty day, is
  idempotent and never creates a Rule 14 / Rule 17 collision). Surface a small inline summary of
  what was added vs skipped. Route the merge through the existing `onFieldUpdate('behavioral_events', …)`.

- **Wire per-label auto-numbering via `onSelect`.** On the day table's Name `SuggestionCombobox`,
  add `onSelect={(label) => handleNameSelected(label)}`. `handleNameSelected` sets the editing
  event's `name` to `label + nextInstanceNumber(label, daySet)`, where `nextInstanceNumber` =
  `1 + count of existing day events whose name matches ^{label}\d*$`. So picking **Poke** into a
  set with no pokes yields `Poke1`; the next `Poke2`; etc. **Typing is unaffected** — a free-typed
  name (`beam_break`, `reward_left`) routes through `onChange` and is stored verbatim (Phase 1's
  guarantee). The number is **never** derived from the DIO channel/index.
  ```js
  function nextInstanceNumber(label, events) {
    const re = new RegExp(`^${escapeRegExp(label)}(\\d+)$`);
    const used = events.map((e) => Number(re.exec(e.name ?? '')?.[1])).filter(Number.isFinite);
    return used.length ? Math.max(...used) + 1 : 1;
  }
  ```

- **Empty-state CTA.** Wire the phase-2a empty state's "add a standard set" CTA to the same
  template menu so a blank first day can be populated in one click.

- **CHANGELOG.** Add an entry for standard-set templates and per-label auto-numbering, noting the
  `Label<n>` (no-separator) convention and that the number is a per-label instance count, not the
  channel index. Exported YAML shape unchanged.

## Deliberately not in this phase

- **The day wiring table itself** — built in [phase-2a](phase-2a-day-wiring-table.md); this phase
  only adds the template menu + `onSelect` numbering to it.
- **Reintroducing any `Label_<index>` (underscore / channel-following) naming** — explicitly
  reverted in Phase 1 and contradicted by real data; auto-numbering uses `Label<n>` instance
  counts only.
- **`comments` field / reconfiguration history** — [phase-4](phase-4-reconfiguration-comments.md).
- **Validating template channel ranges against a specific rig's `.rec`** ([§10](PLAN.md#10-deliberately-not-in-this-plan)) — emit well-formed `Din`/`Dout<n>`; the user re-points.

## Validation slice

| Test | Asserts |
| --- | --- |
| `behavioralEventTemplates()` shape | `pokes-6` yields `[{name:'Poke1',description:'Din1'}, …, {name:'Poke6',description:'Din6'}]` — no underscore, `description` via `joinDioDescription` |
| apply template into empty day | selecting "6 pokes" adds `Poke1…Poke6` to `day.behavioral_events`; the day table renders 6 Input rows |
| apply template is idempotent / collision-safe | re-applying "6 pokes", or applying into a day already holding `Poke1`, skips existing name/description rows and produces NO Rule 14 / Rule 17 violation |
| `onSelect` per-label numbering | picking "Poke" into a pokeless set yields `Poke1`; into a set with `Poke1` yields `Poke2`; picking "Light" yields `Light1` (independent counter) |
| number is NOT the channel | picking "Pump" for a row whose `description` is `Dout7` yields `Pump1` (not `Pump7`) |
| typing stays verbatim | typing `beam_break` (with `onSelect` present) routes through `onChange` and stores `beam_break` unchanged — `onSelect` not invoked |
| **golden baselines unchanged** *(integration)* | `npx vitest run baselines` byte-identical |

## Fixtures

In-memory day/animal factories. Add days at known fill states (empty; with `Poke1`; with
`Poke1,Poke2`) to exercise the next-instance counter and template merge/skip. No new YAML golden
fixtures.

## Review

Before opening the PR for this phase, dispatch `code-reviewer` against the diff. Confirm:
- Auto-numbering uses the no-separator `Label<n>` per-label instance count — never the channel index, never an underscore; typing remains verbatim (Phase 1 guarantee intact).
- Template apply is idempotent and cannot create a duplicate `name`/`description` (Rule 14 / Rule 17).
- `onSelect` is now used by the day table and still falls back to `onChange` when absent (other `SuggestionCombobox` consumers unaffected).
- "Deliberately not in this phase" honored; golden baselines byte-identical; full suite + `npm run lint` + `npm run test:e2e` (functional) green.
- No docstring / test name / module name references "Phase 3" or this plan.
