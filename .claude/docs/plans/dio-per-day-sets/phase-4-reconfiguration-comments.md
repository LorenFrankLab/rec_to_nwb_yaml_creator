# Phase 4 (optional) — Reconfiguration as a named action + passive history + `comments`

[← back to PLAN.md](PLAN.md) · design rationale: [§3.5 reconfiguration = full edit](PLAN.md#3-decisions), [§9 S4 comments round-trip](PLAN.md#9-migration--edge-cases-address-in-the-phase-that-touches-each), [§10 non-goals](PLAN.md#10-deliberately-not-in-this-plan)

**Optional / lowest priority.** Two small additions on top of the day wiring table: (1) expose the
existing per-event **`comments`** third field as an editable "Notes" column, and (2) an optional
**"Mark reconfiguration"** action that tags a day's DIO-set edit in a **passive history log**
(app-internal, never exported). Reconfiguration itself needs no special mechanism — the
carried-forward set is already fully editable (re-point / rename / add / remove); this only
annotates the change for the user's benefit.

**Inputs to read first:**

- The day wiring table from [phase-2a](phase-2a-day-wiring-table.md) — the "Notes (optional)" column slot in the [§5 mockup](PLAN.md#5-ux-design-the-heart) and the section actions are the integration points.
- [src/state/workspaceUtils.js:47](../../../../src/state/workspaceUtils.js#L47) — `BEHAVIORAL_EVENT_ORDER = ['description','name']`; `reorderKeys` ([:94-104](../../../../src/state/workspaceUtils.js#L94-L104)) places known keys first and **appends unknown keys losslessly**; export uses it at [mergeDayMetadata:406-409](../../../../src/state/workspaceUtils.js#L406-L409). **Consequence: `comments` already round-trips today** (appended after `name`) — no export plumbing is required to support it.
- [src/__tests__/fixtures/golden/20230622_sample_metadata.yml:80-87](../../../../src/__tests__/fixtures/golden/20230622_sample_metadata.yml#L80-L87) — the **golden** fixture the baseline gate (`npx vitest run baselines`) runs against; `comments: Indicator for reward delivery` on line 83, rows ordered `description, name, comments`. This is the byte order any `BEHAVIORAL_EVENT_ORDER` change must preserve. (The `fixtures/valid/` copy has the identical `behavioral_events` block but is not the gated file.)
- App-internal day/animal state precedent (never exported): the bad-channel removal acknowledgements stored at `day.state.badChannelRemovalAcks` (see `src/domain/badChannelMonotonicity.js` per CLAUDE.md). Model the reconfiguration history the same way — internal state the export merge does not read.

## Tasks

- **Expose the `comments` field as an optional "Notes" column** in the day wiring table. Bind it to
  `event.comments`; empty/absent renders as blank and is **omitted** from the stored event (don't
  write `comments: ''` — keep absent so byte-output is unchanged for note-less events). No export
  change needed (reorderKeys already appends `comments`).
- **(Optional, recommended) Canonicalize the `comments` position.** Change `BEHAVIORAL_EVENT_ORDER`
  to `['description','name','comments']` so a programmatically-set `comments` always lands after
  `name` (matching the fixture). **Gate on byte-identity:** this is only acceptable if
  `npx vitest run baselines` stays byte-identical (it should — `reorderKeys` already appends
  `comments` after `name`, so the explicit order produces the same bytes). If any baseline moves,
  revert this sub-task — the round-trip already works without it (§9 S4).
- **Add a "Mark reconfiguration…" action** to the day wiring table's section actions. It does not
  gate or transform the edit — the set is freely editable already. It records a passive history
  entry (date of the day, optional free-text note, optionally a terse diff summary vs. the prior
  same-`configurationVersion` day) in **app-internal state** (e.g. `day.state.dioReconfig` or an
  animal-level `dioReconfigHistory` array — follow the bad-channel-acks precedent). **This state is
  never exported** — verify the export merge (`mergeDayMetadata`) does not read it and golden
  baselines stay byte-identical.
- **Show the passive history** as a small, collapsible read-only list ("Reconfigured on …") near
  the table — purely informational. Following [§3.5](PLAN.md#3-decisions): "just edit; history is
  nice."
- **CHANGELOG.** Entry for the Notes/`comments` field and the optional reconfiguration history,
  noting the exported YAML shape is unchanged (comments already round-tripped; history is internal).

## Deliberately not in this phase

- **A heavy versioned DIO-config entity** (electrode-group style) — [§10](PLAN.md#10-deliberately-not-in-this-plan); carry-forward + passive history is the chosen weight.
- **Gating/blocking edits behind reconfiguration** — reconfiguration is a free edit; the action only annotates.
- **Exporting the history or any new YAML key** — history is app-internal; `comments` is the only event field exposed, and it already round-trips.
- **Re-deriving the carried-from / diff automatically beyond a terse summary** — keep it passive and cheap.

## Validation slice

| Test | Asserts |
| --- | --- |
| comments edit round-trips | setting a row's Notes to `reward pump` exports `behavioral_events: [{description, name, comments: 'reward pump'}]`; clearing Notes omits the `comments` key entirely (no `comments: ''`) |
| note-less events unchanged | an event with no Notes exports exactly `{description, name}` — byte-identical to today |
| `BEHAVIORAL_EVENT_ORDER` change (if applied) | `npx vitest run baselines` stays byte-identical; `comments` (when present) is ordered after `name` |
| reconfiguration history is internal | marking a reconfiguration records a history entry in app state but the exported YAML for that day is byte-identical (history not in `mergeDayMetadata` output) |
| history renders | after marking, the read-only "Reconfigured on {date}" entry appears; it does not block or alter the editable set |
| **golden baselines unchanged** *(integration)* | `npx vitest run baselines` byte-identical across the whole phase |

## Fixtures

Reuse day/animal factories. Add a day whose `behavioral_events` includes one row with `comments`
and one without, to assert the omit-when-empty behavior and byte parity. The existing
`20230622_sample_metadata.yml` already exercises the `comments` round-trip on import/export.

## Review

Before opening the PR for this phase, dispatch `code-reviewer` against the diff. Confirm:
- `comments` is omitted (not written as `''`) when empty; note-less events are byte-identical to today; golden baselines byte-identical (especially if `BEHAVIORAL_EVENT_ORDER` was touched).
- The reconfiguration history is app-internal and never reaches exported YAML; it neither gates nor mutates the editable set.
- "Deliberately not in this phase" honored (no versioned-config entity, no new exported keys); full suite + `npm run lint` + `npm run test:e2e` (functional) green.
- No docstring / test name / module name references "Phase 4" or this plan.
