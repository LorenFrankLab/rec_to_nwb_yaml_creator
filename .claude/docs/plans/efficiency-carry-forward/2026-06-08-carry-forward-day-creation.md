# Carry-Forward Day Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new recording day defaults its day-owned content (tasks, behavioral events, keywords, weight, experiment description, technical overrides) from the animal's most recent existing day — reviewable, with a one-click "start blank" opt-out — instead of coming up empty.

**Architecture:** Pure-transition change. `createDayRecord` gains an optional `carryFrom` source-day argument; the `createDay` store action resolves it from a new `options.carryForwardFromDayId`; a new shape-safe selector finds the most-recent day; `RecordingDaysTab` adds a toggle (default ON when a prior day exists) and threads the source id through the existing bulk-create loop. **Merge-neutral** — a carried-forward day still exports through `mergeDayMetadata → encodeYaml` exactly as a hand-entered equivalent, so the 125 golden baselines do not move (no fixture uses carry-forward). Files (`associated_files`/`associated_video_files`) and `session_id`/`session_description` are session-specific and are NOT carried.

**Tech Stack:** React 18 (hooks), Vitest + @testing-library/react, hash-routed SPA. No new deps.

---

## File Structure

- `src/state/workspaceSelectors.js` — add `getMostRecentDayId(animal, days)` (find the carry-forward source).
- `src/state/workspaceTransitions.js` — `createDayRecord` gains a `carryFrom` param (seeds day-owned fields).
- `src/state/useWorkspace.js` — `createDay` gains `options.carryForwardFromDayId`.
- `src/pages/AnimalWorkspace/RecordingDaysTab.jsx` — carry-forward toggle + thread the source id through `handleCreateDays`.
- Tests colocated under each module's `__tests__`.

Carry-forward field set (day-owned only): `session.experiment_description`, `session.weight`, `keywords`, `tasks`, `behavioral_events`, `technical`. **Not** carried: `session_id`, `session_description` (date-derived), `associated_files`, `associated_video_files` (session-specific).

---

### Task 1: `getMostRecentDayId` selector

**Files:**
- Modify: `src/state/workspaceSelectors.js` (add after `getAnimalDayIds`, near line 89)
- Test: `src/state/__tests__/workspaceSelectors.test.js` (create if absent, else append)

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { getMostRecentDayId } from '../workspaceSelectors';

describe('getMostRecentDayId', () => {
  const animal = { days: ['remy-2023-06-20', 'remy-2023-06-22', 'remy-2023-06-21'] };
  const days = {
    'remy-2023-06-20': { id: 'remy-2023-06-20', date: '2023-06-20' },
    'remy-2023-06-22': { id: 'remy-2023-06-22', date: '2023-06-22' },
    'remy-2023-06-21': { id: 'remy-2023-06-21', date: '2023-06-21' },
  };

  it('returns the id of the latest-dated present day', () => {
    expect(getMostRecentDayId(animal, days)).toBe('remy-2023-06-22');
  });

  it('returns null when the animal has no present days', () => {
    expect(getMostRecentDayId({ days: [] }, {})).toBeNull();
    expect(getMostRecentDayId({ days: ['ghost'] }, {})).toBeNull();
  });

  it('tolerates a corrupt animal / missing dates', () => {
    expect(getMostRecentDayId(null, null)).toBeNull();
    expect(getMostRecentDayId({ days: ['x'] }, { x: { id: 'x' } })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/__tests__/workspaceSelectors.test.js`
Expected: FAIL — `getMostRecentDayId is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to `src/state/workspaceSelectors.js` (immediately after `getAnimalDayIds`):

```javascript
/**
 * The id of the animal's latest-dated day that is present in `days`, or null. Day dates are
 * `YYYY-MM-DD`, so a lexicographic compare is chronological. Shape-safe: tolerates a corrupt
 * animal, a missing `days` map, or day records without a string `date`.
 *
 * @param {object} animal - The animal record (`days` id list).
 * @param {object} days - The workspace `days` map (id → record).
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/__tests__/workspaceSelectors.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/state/workspaceSelectors.js src/state/__tests__/workspaceSelectors.test.js
git commit -m "Add getMostRecentDayId selector (carry-forward source)"
```

---

### Task 2: `createDayRecord` carry-forward

**Files:**
- Modify: `src/state/workspaceTransitions.js` (`createDayRecord`, ~line 288; imports at top)
- Test: `src/state/__tests__/workspaceTransitions.test.js` (append; create if absent)

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { createDayRecord } from '../workspaceTransitions';

const animal = { configurationHistory: [{ version: 1, devices: {}, appliedToDays: [] }], technicalDefaults: { times_period_multiplier: 1.5, raw_data_to_volts: 0.195 } };
const session = { session_id: 'remy_20230622', session_description: 'desc' };

const sourceDay = {
  id: 'remy-2023-06-21', date: '2023-06-21',
  session: { session_id: 'remy_20230621', session_description: 'prev', experiment_description: 'W-track study', weight: 455 },
  keywords: ['spatial'],
  tasks: [{ task_name: 'w-track', task_description: 'alt', task_epochs: [1, 2] }],
  behavioral_events: [{ name: 'poke', description: 'center' }],
  associated_files: [{ name: 'a.txt' }],
  associated_video_files: [{ name: 'v.h264', camera_id: 0 }],
  technical: { times_period_multiplier: 2.0, raw_data_to_volts: 0.3, default_header_file_path: '', units: undefined },
};

describe('createDayRecord — carry-forward', () => {
  it('without carryFrom, seeds a blank day (existing behaviour)', () => {
    const d = createDayRecord(animal, 'remy', 'remy-2023-06-22', '2023-06-22', session, 'now');
    expect(d.tasks).toEqual([]);
    expect(d.keywords).toEqual([]);
    expect(d.technical.times_period_multiplier).toBe(1.5);
    expect(d.session.experiment_description).toBeUndefined();
  });

  it('with carryFrom, seeds day-owned fields from the source (deep-cloned)', () => {
    const d = createDayRecord(animal, 'remy', 'remy-2023-06-22', '2023-06-22', session, 'now', sourceDay);
    expect(d.tasks).toEqual(sourceDay.tasks);
    expect(d.tasks).not.toBe(sourceDay.tasks); // cloned, not aliased
    expect(d.behavioral_events).toEqual(sourceDay.behavioral_events);
    expect(d.keywords).toEqual(['spatial']);
    expect(d.technical).toEqual(sourceDay.technical);
    expect(d.session.experiment_description).toBe('W-track study');
    expect(d.session.weight).toBe(455);
  });

  it('NEVER carries session_id/description or file lists (session-specific)', () => {
    const d = createDayRecord(animal, 'remy', 'remy-2023-06-22', '2023-06-22', session, 'now', sourceDay);
    expect(d.session.session_id).toBe('remy_20230622'); // from the caller, not the source
    expect(d.session.session_description).toBe('desc');
    expect(d.associated_files).toEqual([]);
    expect(d.associated_video_files).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/__tests__/workspaceTransitions.test.js`
Expected: FAIL — the carry-forward assertions fail (current `createDayRecord` ignores a 7th arg and returns blanks).

- [ ] **Step 3: Write minimal implementation**

At the top of `src/state/workspaceTransitions.js`, ensure these selectors are imported (add the missing ones to the existing `workspaceSelectors` import):

```javascript
import { getConfigHistory, getDayTasks, getDayKeywords, getDayBehavioralEvents } from './workspaceSelectors';
```

Replace the `createDayRecord` signature + body's day-owned fields:

```javascript
export function createDayRecord(animal, animalId, dayId, date, session, now, carryFrom = null) {
  const history = getConfigHistory(animal);
  const latestVersion = history.length > 0 ? history[history.length - 1].version : 0;
  // Carry-forward source (a prior day record), or null for a blank day. Day-owned fields only —
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/__tests__/workspaceTransitions.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the baselines to confirm export is unmoved**

Run: `npx vitest run baselines`
Expected: PASS, 125 byte-identical (carry-forward is opt-in; no fixture uses it).

- [ ] **Step 6: Commit**

```bash
git add src/state/workspaceTransitions.js src/state/__tests__/workspaceTransitions.test.js
git commit -m "createDayRecord: optional carry-forward from a source day"
```

---

### Task 3: `createDay` action threads the source id

**Files:**
- Modify: `src/state/useWorkspace.js` (`createDay`, ~line 392)
- Test: `src/state/__tests__/useWorkspace.createDay.test.js` (create) — or append to an existing useWorkspace test

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkspace } from '../useWorkspace';

function seeded() {
  return {
    animals: { remy: { id: 'remy', subject: { subject_id: 'remy' }, configurationHistory: [{ version: 1, devices: {}, appliedToDays: [] }], days: ['remy-2023-06-21'] } },
    days: { 'remy-2023-06-21': { id: 'remy-2023-06-21', animalId: 'remy', date: '2023-06-21', session: { session_id: 'remy_20230621' }, tasks: [{ task_name: 'w-track', task_description: 'alt', task_epochs: [1] }], behavioral_events: [], keywords: [], associated_files: [], associated_video_files: [], technical: {} } },
    settings: {},
  };
}

describe('createDay — carryForwardFromDayId', () => {
  it('copies the source day tasks into the new day when given a source id', () => {
    const { result } = renderHook(() => useWorkspace({ workspace: seeded() }));
    act(() => {
      result.current.workspaceActions.createDay('remy', '2023-06-22',
        { session_id: 'remy_20230622', session_description: 'd' },
        { carryForwardFromDayId: 'remy-2023-06-21' });
    });
    expect(result.current.workspace.days['remy-2023-06-22'].tasks)
      .toEqual([{ task_name: 'w-track', task_description: 'alt', task_epochs: [1] }]);
  });

  it('creates a blank day when no source id is given (back-compat)', () => {
    const { result } = renderHook(() => useWorkspace({ workspace: seeded() }));
    act(() => {
      result.current.workspaceActions.createDay('remy', '2023-06-23',
        { session_id: 'remy_20230623', session_description: 'd' });
    });
    expect(result.current.workspace.days['remy-2023-06-23'].tasks).toEqual([]);
  });
});
```

NOTE: confirm the hook's return shape (`workspaceActions` / `workspace`) against `useWorkspace.js` exports before running; adjust the destructuring in the test if the facade differs (e.g. via `store.js`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/__tests__/useWorkspace.createDay.test.js`
Expected: FAIL — the new day's tasks are `[]` (the 4th arg is ignored).

- [ ] **Step 3: Write minimal implementation**

In `src/state/useWorkspace.js`, change `createDay` to accept `options` and resolve the source:

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
          // Optional carry-forward: seed day-owned content from an existing day (the toggle in
          // RecordingDaysTab passes the most-recent day's id). Unknown id → null → blank day.
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/__tests__/useWorkspace.createDay.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/state/useWorkspace.js src/state/__tests__/useWorkspace.createDay.test.js
git commit -m "createDay: optional carryForwardFromDayId"
```

---

### Task 4: RecordingDaysTab — carry-forward toggle + wiring

**Files:**
- Modify: `src/pages/AnimalWorkspace/RecordingDaysTab.jsx` (`handleCreateDays` ~line 131; add a toggle near the calendar trigger)
- Test: `src/pages/AnimalWorkspace/__tests__/RecordingDaysTab.carryForward.test.jsx` (create)

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider, useStoreContext } from '../../../state/StoreContext';
import { RecordingDaysTab } from '../RecordingDaysTab';

const initial = { workspace: {
  animals: { remy: { id: 'remy', subject: { subject_id: 'remy' }, configurationHistory: [{ version: 1, devices: {}, appliedToDays: [] }], days: ['remy-2023-06-21'] } },
  days: { 'remy-2023-06-21': { id: 'remy-2023-06-21', animalId: 'remy', date: '2023-06-21', session: { session_id: 'remy_20230621' }, tasks: [{ task_name: 'w-track', task_description: 'alt', task_epochs: [1] }], behavioral_events: [], keywords: [], associated_files: [], associated_video_files: [], technical: {} } },
  settings: {},
} };

/** Probe the new day's tasks from the live store. */
function TasksProbe({ id }) {
  const { model } = useStoreContext();
  return <pre data-testid="t">{JSON.stringify(model.workspace.days[id]?.tasks || null)}</pre>;
}

describe('RecordingDaysTab — carry-forward toggle', () => {
  it('defaults ON and carries the previous day tasks into a newly created day', async () => {
    const user = userEvent.setup();
    render(
      <StoreProvider initialState={initial}>
        <RecordingDaysTab selectedAnimalId="remy" />
        <TasksProbe id="remy-2023-06-22" />
      </StoreProvider>
    );
    // The toggle is checked by default (a prior day exists).
    expect(screen.getByRole('checkbox', { name: /start each new day from the last day/i })).toBeChecked();
    // Open the calendar, pick 2023-06-22, create. (Use the calendar's date cell + create button.)
    await user.click(screen.getByRole('button', { name: /add recording days/i }));
    await user.click(screen.getByRole('gridcell', { name: /june 22, 2023/i }));
    await user.click(screen.getByRole('button', { name: /create 1 recording day/i }));
    expect(JSON.parse(screen.getByTestId('t').textContent)).toEqual([{ task_name: 'w-track', task_description: 'alt', task_epochs: [1] }]);
  });
});
```

NOTE: the calendar defaults to the current month. If the harness clock isn't June 2023, either (a) navigate the calendar to June 2023 first, or (b) assert the wiring at the `handleCreateDays` level with a lighter test. Adjust the date interaction to the real `CalendarDayCreator` controls (confirm the gridcell/label format against the component).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/AnimalWorkspace/__tests__/RecordingDaysTab.carryForward.test.jsx`
Expected: FAIL — no carry-forward checkbox; the new day's tasks are `[]`.

- [ ] **Step 3: Write minimal implementation**

In `RecordingDaysTab.jsx`: import the selector and `useState`; compute the source; add the toggle; pass the option.

```javascript
// near the other imports
import { getMostRecentDayId } from '../../state/workspaceSelectors';
// inside the component, near other useState:
const mostRecentDayId = getMostRecentDayId(selectedAnimal, days);
const [carryForward, setCarryForward] = useState(true);
```

In `handleCreateDays`, pass the option on each `createDay`:

```javascript
        actions.createDay(selectedAnimalId, date, {
          session_id: sessionId,
          session_description: `Recording session for ${selectedAnimalId} on ${date}`,
        }, {
          carryForwardFromDayId: carryForward && mostRecentDayId ? mostRecentDayId : undefined,
        });
```

Render the toggle next to the "Add Recording Days" trigger (only when a source exists):

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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/AnimalWorkspace/__tests__/RecordingDaysTab.carryForward.test.jsx`
Expected: PASS.

- [ ] **Step 5: Run the full suite + lint + build**

Run: `npx vitest run` → all green. `npx vitest run baselines` → 125 byte-identical. `npm run lint` → 0 errors. `npm run build` → OK.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AnimalWorkspace/RecordingDaysTab.jsx src/pages/AnimalWorkspace/__tests__/RecordingDaysTab.carryForward.test.jsx
git commit -m "RecordingDaysTab: carry-forward toggle (default on; bulk-applies)"
```

---

### Task 5: Changelog + verification

**Files:**
- Modify: `docs/REFACTOR_CHANGELOG.md`

- [ ] **Step 1: Add a changelog entry** describing the carry-forward feature (merge-neutral; baselines byte-identical; day-owned fields only; opt-out toggle).

- [ ] **Step 2: Final gate** — `npx vitest run` (green), `npx vitest run baselines` (125 byte-identical), `npm run lint` (0 errors), `npm run build` (OK).

- [ ] **Step 3: Commit**

```bash
git add docs/REFACTOR_CHANGELOG.md
git commit -m "docs: changelog for carry-forward day creation"
```

---

## Self-Review

- **Spec coverage:** carry-forward of day-owned fields (Task 2) ✓; source = most-recent day (Task 1) ✓; opt-out toggle default-on (Task 4) ✓; bulk applies (Task 4 threads the option through the existing loop) ✓; merge-neutral / baselines unmoved (Task 2 Step 5, Task 4 Step 5) ✓. Duplicate-day (A2) and the cameras-used checklist (A4) are **out of scope** — separate plans.
- **Type consistency:** `getMostRecentDayId(animal, days)` returns a day id string|null; `createDayRecord(..., carryFrom)` takes a day record|null; `createDay(..., options)` takes `{ carryForwardFromDayId?: string }`. Consistent across Tasks 1–4.
- **Placeholder scan:** none — every code/test step has complete code; the two NOTEs flag harness-specific selectors to confirm at execution (calendar gridcell label, the hook facade shape), not missing logic.
- **Risk:** merge-neutral. The only export-touching field carried is `technical` + `experiment_description` + `weight`, all already day-owned and already merged today; a carried day is indistinguishable at export from a hand-entered one.

---

## Execution Handoff

Plan saved to `.claude/docs/plans/efficiency-carry-forward/2026-06-08-carry-forward-day-creation.md`. Two execution options:

1. **Subagent-Driven** (`superpowers:subagent-driven-development`) — a fresh subagent per task, review between tasks.
2. **Inline Execution** (`superpowers:executing-plans`) — execute the tasks in this session with checkpoints for review.
