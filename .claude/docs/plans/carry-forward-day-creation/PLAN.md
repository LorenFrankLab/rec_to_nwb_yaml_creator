# Carry-Forward Day Creation Implementation Plan

**Status:** Not started.

**Goal:** A newly created recording day defaults its day-owned content (tasks, behavioral events, keywords, weight, experiment description, technical overrides) from the animal's most recent existing day — reviewable, with a default-on toggle to opt out — instead of coming up blank.

**Architecture:** Pure additive change at three layers. A new shape-safe selector finds the carry-forward source (the latest-dated existing day); `createDayRecord` gains an optional trailing `carryFrom` source-day argument that seeds the day-owned fields (deep-cloned); `createDay` resolves it from a new optional `options.carryForwardFromDayId`; `RecordingDaysTab` adds a default-on toggle and threads the source id through the existing bulk-create loop so single- and multi-day creation both carry forward. The change is **merge-neutral**: a carried day still exports through `mergeDayMetadata → encodeYaml` exactly as a hand-entered equivalent, so the 18 golden fixtures / 125 baseline assertions do not move (no fixture exercises carry-forward). All new params are trailing and optional, so existing call sites are unaffected (no deprecation needed).

**Tech stack:** React 18 hooks, Vitest + @testing-library/react, hash-routed SPA. No new dependencies.

**Out of scope:** Duplicate-day (a separate clone action), the explicit per-day "cameras used" checklist, and a saved "template" concept — each is its own plan. Carrying `associated_files` / `associated_video_files` is deliberately excluded (session-specific file paths).

## Inputs to read first

- [src/state/workspaceSelectors.js:89](../../../../src/state/workspaceSelectors.js#L89) — `getAnimalDayIds`; the new selector sits beside it and reuses it. Day-owned selectors `getDaySession`/`getDayTasks`/`getDayBehavioralEvents`/`getDayKeywords` are at lines 94–109.
- [src/state/workspaceTransitions.js:288](../../../../src/state/workspaceTransitions.js#L288) — `createDayRecord(animal, animalId, dayId, date, session, now)`; the day-owned fields (`tasks: []`, `behavioral_events: []`, `keywords: []`, `technical: {…}`) are the blanks to seed (≈ lines 295–328).
- [src/state/useWorkspace.js:392](../../../../src/state/useWorkspace.js#L392) — `createDay: (animalId, date, session) => { … }`; calls `createDayRecord(animal, animalId, dayId, date, session, now)`.
- [src/pages/AnimalWorkspace/RecordingDaysTab.jsx:131](../../../../src/pages/AnimalWorkspace/RecordingDaysTab.jsx#L131) — `handleCreateDays(dates)` loops over selected dates calling `actions.createDay(selectedAnimalId, date, { session_id, session_description })` (the call is ≈ lines 150–152). `selectedAnimal`, `days`, and `actions` are already in scope in this component.

## Carry-forward field set

Day-owned, **carried**: `session.experiment_description`, `session.weight`, `keywords`, `tasks` (incl. their `camera_id` refs → camera usage carries with them), `behavioral_events`, `technical`.
**Never carried** (session-specific): `session.session_id`, `session.session_description` (both date-derived, supplied by the caller), `associated_files`, `associated_video_files`.

## Tasks

### Task 1 — `getMostRecentDayId` selector

Add to `src/state/workspaceSelectors.js`, immediately after `getAnimalDayIds` (line 89). Dates are `YYYY-MM-DD`, so a lexicographic compare is chronological. Shape-safe: tolerates a null animal, a missing `days` map, dangling ids, and records without a string `date`.

```javascript
/**
 * The id of the animal's latest-dated day present in `days`, or null. Day dates are `YYYY-MM-DD`
 * (lexicographic compare == chronological). Tolerates a corrupt animal, a missing `days` map, a
 * dangling id, or a record without a string `date`.
 *
 * @param {object} animal - The animal record (its `days` id list).
 * @param {object} days - The workspace `days` map (id -> record).
 * @returns {string|null} The most-recent day's id, or null when none qualify.
 */
export const getMostRecentDayId = (animal, days) => {
  const present = getAnimalDayIds(animal)
    .map((id) => (days && typeof days === 'object' ? days[id] : undefined))
    .filter((d) => d && typeof d.id === 'string' && typeof d.date === 'string');
  if (present.length === 0) return null;
  present.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return present[0].id;
};
```

### Task 2 — carry-forward in the store (`createDayRecord` + `createDay`)

**2a. `createDayRecord`** (`src/state/workspaceTransitions.js:288`). Add a trailing `carryFrom = null` param and seed the day-owned fields from it when present (deep-cloned so the new day never aliases the source). Import the day-owned selectors alongside the existing `getConfigHistory` import at the top of the file:

```javascript
import { getConfigHistory, getDayTasks, getDayKeywords, getDayBehavioralEvents } from './workspaceSelectors';
```

Replace the `createDayRecord` signature and the day-owned fields of its returned object:

```javascript
export function createDayRecord(animal, animalId, dayId, date, session, now, carryFrom = null) {
  const history = getConfigHistory(animal);
  const latestVersion = history.length > 0 ? history[history.length - 1].version : 0;
  // Carry-forward source (a prior day record) or null for a blank day. Day-owned fields only:
  // session_id/description are date-derived (from the caller) and file lists are session-specific.
  const cf = carryFrom && typeof carryFrom === 'object' ? carryFrom : null;
  const cfSession = cf && cf.session && typeof cf.session === 'object' ? cf.session : {};
  const cfTechnical = cf && cf.technical && typeof cf.technical === 'object' ? cf.technical : null;
  return {
    id: dayId,
    animalId,
    date,
    experimentDate: formatExperimentDate(date),
    session: {
      session_id: session.session_id,
      session_description: session.session_description,
      experiment_description:
        session.experiment_description !== undefined
          ? session.experiment_description
          : cfSession.experiment_description,
      weight: session.weight !== undefined ? session.weight : cfSession.weight,
    },
    keywords: cf ? structuredClone(getDayKeywords(cf)) : [],
    tasks: cf ? structuredClone(getDayTasks(cf)) : [],
    behavioral_events: cf ? structuredClone(getDayBehavioralEvents(cf)) : [],
    associated_files: [],
    associated_video_files: [],
    technical: cfTechnical
      ? structuredClone(cfTechnical)
      : {
          times_period_multiplier: animal.technicalDefaults?.times_period_multiplier ?? 1.5,
          raw_data_to_volts: animal.technicalDefaults?.raw_data_to_volts ?? 0.195,
          default_header_file_path: '',
          units: undefined,
        },
    state: { draft: true, validated: false, exported: false },
    created: now,
    lastModified: now,
    configurationVersion: latestVersion,
  };
}
```

**2b. `createDay`** (`src/state/useWorkspace.js:392`). Accept a trailing `options = {}` and resolve the source from `prev.days` (an unknown id degrades to `null` → blank day, never throws):

```javascript
      createDay: (animalId, date, session, options = {}) => {
        setWorkspace((prev) => {
          if (!prev.animals[animalId]) {
            throw new Error(`Animal "${animalId}" not found`);
          }
          const dayId = generateDayId(animalId, date);
          if (prev.days[dayId]) {
            throw new Error(`Day "${dayId}" already exists`);
          }
          const animal = prev.animals[animalId];
          const now = getCurrentTimestamp();
          const carryFrom = options.carryForwardFromDayId
            ? prev.days[options.carryForwardFromDayId] || null
            : null;
          const day = createDayRecord(animal, animalId, dayId, date, session, now, carryFrom);
          const updatedAnimal = { ...animal, days: [...getAnimalDayIds(animal), dayId] };
          return {
            ...prev,
            animals: { ...prev.animals, [animalId]: updatedAnimal },
            days: { ...prev.days, [dayId]: day },
            lastModified: now,
          };
        });
      },
```

### Task 3 — `RecordingDaysTab` toggle + bulk wiring

In `src/pages/AnimalWorkspace/RecordingDaysTab.jsx`:

- Import the selector: `import { getMostRecentDayId } from '../../state/workspaceSelectors';`
- In the component body, near the other `useState` calls, compute the source and add the toggle state (default on):

```javascript
const mostRecentDayId = getMostRecentDayId(selectedAnimal, days);
const [carryForward, setCarryForward] = useState(true);
```

- In `handleCreateDays` (line 131), pass the option on the existing `actions.createDay(...)` call (≈ line 150). Resolving the source from a single snapshot (not per-iteration) is correct — every day in a bulk create seeds from the same prior day, which the user then tweaks:

```javascript
        actions.createDay(selectedAnimalId, date, {
          session_id: sessionId,
          session_description: `Recording session for ${selectedAnimalId} on ${date}`,
        }, {
          carryForwardFromDayId: carryForward && mostRecentDayId ? mostRecentDayId : undefined,
        });
```

- Render the toggle near the "Add Recording Days" trigger, only when a source exists:

```jsx
{mostRecentDayId && (
  <label className="carry-forward-toggle">
    <input
      type="checkbox"
      checked={carryForward}
      onChange={(e) => setCarryForward(e.target.checked)}
    />
    Start each new day from the last day ({days[mostRecentDayId]?.date}) — review &amp; adjust per day
  </label>
)}
```

### Task 4 — CHANGELOG

Add a `docs/REFACTOR_CHANGELOG.md` entry: carry-forward day creation; day-owned fields only (list them); default-on toggle with opt-out; merge-neutral / 125 baselines byte-identical; new params are trailing-optional (no breaking change).

## Deliberately not in this plan

- **Duplicate-day** — a `duplicateDay(dayId, newDate)` action + a per-row "Duplicate day…" item. Separate, self-contained PR.
- **Explicit per-day "cameras used" checklist** — carry-forward already carries camera usage via the carried `tasks[].camera_id`; the explicit checklist is its own UX change.
- **Per-day vs chained bulk seeding** — all bulk days seed from the same pre-batch source (simpler, reviewable). Chaining (day N seeds from day N-1 within the batch) is not worth the complexity here.

## Validation slice

| Test | Asserts |
| --- | --- |
| `getMostRecentDayId` returns latest-dated id | Given days dated 06-20/06-21/06-22 (any order), returns the `06-22` id |
| `getMostRecentDayId` empty / corrupt | `[]` days → null; dangling id → null; `null` animal → null (no throw) |
| `createDayRecord` no `carryFrom` (back-compat) | `tasks`/`keywords`/`behavioral_events` `[]`; `technical` from animal defaults; `experiment_description` undefined |
| `createDayRecord` with `carryFrom` | `tasks`/`behavioral_events`/`keywords`/`technical` equal source and are **not the same reference** (cloned); `experiment_description`/`weight` taken from source |
| `createDayRecord` never carries session id/desc or files | `session_id`/`session_description` from the caller's `session`; `associated_files`/`associated_video_files` `[]` |
| `createDay` with `carryForwardFromDayId` | new day's `tasks` equal the source day's `tasks` |
| `createDay` without options (back-compat) | new day's `tasks` `[]` |
| `RecordingDaysTab` toggle default-on carries forward | toggle is checked by default when a prior day exists; creating a day copies the prior day's `tasks` into it (assert via a live-store probe) |
| Golden baselines unmoved | `npx vitest run baselines` → 125 byte-identical (carry-forward is opt-in; no fixture uses it) |
| Full suite + lint + build | `npx vitest run` green; `npm run lint` 0 errors; `npm run build` OK |

## Fixtures

All synthesized inline in the test files (a `remy` animal with a `configurationHistory` of one version, `technicalDefaults`, and one prior day carrying `tasks`/`behavioral_events`/`keywords`/`technical`). No real-data slice needed — this is store/UI logic, not a data loader. The `RecordingDaysTab` test renders under `StoreProvider` and reads the resulting day from the live store via a small probe component; confirm the calendar's date-cell label format against `CalendarDayCreator` and, if the harness clock isn't in the fixture's month, either navigate the calendar to it or assert the wiring at the `handleCreateDays` level.

## Review

Before opening the PR, dispatch `code-reviewer` (or an equivalent independent reviewer) against the diff. Confirm:
- Every task is implemented as specified; nothing in "Deliberately not in this plan" was added.
- Validation-slice tests pass; the baseline run is byte-identical (this is the merge-neutrality gate).
- Tests aren't trivial — the carry-forward tests assert cloned-not-aliased and the exact field set, not tautologies; shared setup is in fixtures, not copy-pasted.
- Docstrings, test names, and module names don't reference this plan.
- New params are genuinely additive — existing `createDay` / `createDayRecord` call sites still pass and behave identically.
