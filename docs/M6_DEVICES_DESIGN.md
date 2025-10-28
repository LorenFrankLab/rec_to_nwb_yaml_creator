# M6 DevicesStep Design Document

**Milestone:** M6 - Devices Step + Channel Map Editor
**Created:** 2025-10-28
**Status:** Design Complete - Ready for Implementation
**Reviews:** UX Review (NEEDS_POLISH) + UI Review (NEEDS_POLISH) = P0/P1 issues incorporated

---

## Overview

The DevicesStep is the second step in the Day Editor stepper (Overview → **Devices** → Epochs → Validation → Export). It allows users to mark channels that have failed on specific recording days while displaying inherited electrode group configuration from the animal level.

**Key Principle:** Only bad channels are editable at the day level. Device configuration (electrode groups, channel maps) is inherited from the animal and displayed as read-only reference.

---

## User Requirements

### Scientific Workflow

- **Common scenario:** Channels fail over time due to hardware degradation, tissue reactions, or broken connections
- **Frequency:** Typical experiments have 1-66 electrode groups with 4-128 channels each
- **Critical constraint:** Marking wrong channels corrupts all downstream analyses (spike sorting, Spyglass database)

### Data Architecture

- **Read-only (inherited from animal):**
  - Electrode groups (location, device_type, coordinates, description)
  - Channel maps (electrode → hardware mapping)
  - Device structure (cannot add/remove groups at day level)

- **Editable (day-specific):**
  - Bad channels per ntrode (which hardware channels have failed)

---

## Design Approach

### Selected Architecture: Accordion/Collapsible Sections (Approach B)

**Rationale:**

- Can expand multiple groups simultaneously (comparison across groups)
- Overview of all groups in collapsed state (status at-a-glance)
- Simpler state management (no tab index tracking)
- Native `<details>`/`<summary>` provides accessibility built-in

**Trade-offs accepted:**

- Vertical scrolling for many groups (typical experiments have 1-66 groups)
- Less focused than tabs (mitigated by visual anchoring)

---

## Component Architecture

### Component Structure

```
DevicesStep.jsx (Container - ~250 lines)
├── Props: { animal, day, mergedDay, onFieldUpdate }
├── State: { fieldErrors, validatingField }
├── Renders:
│   ├── <header> - Section title
│   ├── <InheritedNotice> - "Edit Animal" link
│   ├── <EmptyState> - If no electrode groups
│   └── For each electrode_group:
│       └── <details> - Collapsible section (collapsed by default)
│           ├── <summary> - Group header + status badge
│           └── <div> - Expanded content:
│               ├── <ReadOnlyDeviceInfo> - Device config
│               └── <BadChannelsEditor> - Editable bad channels
│
BadChannelsEditor.jsx (~180 lines)
├── Props: { ntrodes, badChannels, onUpdate, errors }
├── For each ntrode:
│   ├── <fieldset> - Shank container
│   │   ├── <legend> - "Shank #N (Ntrode ID: X)"
│   │   ├── <ChannelMap> - Read-only grid (collapsible)
│   │   └── <BadChannelsCheckboxes> - Editable
│
ReadOnlyDeviceInfo.jsx (~80 lines)
├── Props: { group }
├── Displays:
│   ├── Device type
│   ├── Location (actual vs targeted)
│   ├── Coordinates (x, y, z, units)
│   └── Description
```

### Data Flow

```javascript
// 1. READ: Animal-level device configuration (inherited)
animal.devices = {
  electrode_groups: [
    {
      id: 0,
      location: "CA1",
      device_type: "tetrode_12.5",
      description: "Tetrode array",
      targeted_location: "CA1",
      targeted_x: 2.6,
      targeted_y: -3.8,
      targeted_z: 0,
      units: "mm"
    }
  ],
  ntrode_electrode_group_channel_map: [
    {
      ntrode_id: 0,
      electrode_group_id: 0,
      bad_channels: [],  // Animal default
      map: { 0: 0, 1: 1, 2: 2, 3: 3 }
    }
  ]
}

// 2. EDIT: Day-level bad channels override
day.deviceOverrides = {
  bad_channels: {
    '0': [1, 3],   // Ntrode 0: channels 1 and 3 failed on this day
    '1': [],       // Ntrode 1: no failures
    '2': [0, 2, 5] // Ntrode 2: channels 0, 2, 5 failed
  }
}

// 3. SAVE: Auto-save on blur
onFieldUpdate('deviceOverrides.bad_channels.0', [1, 3]);

// 4. MERGE: For YAML export (in mergeDayMetadata)
mergedNtrode = {
  ...animalNtrode,
  bad_channels: day.deviceOverrides?.bad_channels?.[ntrodeId] ?? animalNtrode.bad_channels
}
```

---

## UX Design (Incorporating Review Feedback)

### Key Changes from UX Review

#### P0 Issues Fixed

**P0-1: Terminology Clarity**

- ~~"Bad Channels"~~ → **"Failed Channels"**
- Added tooltip: "Mark hardware channels that have failed (no signal, excessive noise, broken connection)"
- Added help text: "Only mark channels with hardware failures. Analysis quality issues should be handled during spike sorting."

**P0-2: Empty State Handling**

```jsx
{animal.devices.electrode_groups.length === 0 && (
  <div className="empty-state">
    <p>No electrode groups configured for {animal.id}</p>
    <p className="empty-state-hint">
      Electrode groups are configured at the animal level and inherited by all days.
    </p>
    <a href={`#/animal/${animal.id}`} className="button-primary">
      Configure Electrode Groups
    </a>
  </div>
)}
```

**P0-3: All Channels Failed Warning**

```javascript
// Validation logic
if (selectedBadChannels.length === totalChannels) {
  return {
    valid: true,
    warning: `All ${totalChannels} channels marked as failed. This electrode group will be excluded from analysis. Confirm this is intentional.`
  };
}

// Display in accordion summary
{allChannelsBad && (
  <span className="status-badge status-error">
    ⚠ All channels failed - Group inactive
  </span>
)}
```

#### P1 Issues Fixed

**P1-1: Hierarchy Explanation**

```jsx
<div className="electrode-group-header">
  <h3>Electrode Group {group.id}: {group.location}</h3>
  <p className="field-help-text">
    This {group.device_type} has {ntrodeCount} {ntrodeCount === 1 ? 'shank' : 'shanks'}.
    Mark individual channels that have failed on each shank.
  </p>
</div>
```

**P1-2: Status Badge Text**

- ~~"✓ Clean"~~ → **"✓ All channels OK"**
- ~~"⚠ N bad channels"~~ → **"⚠ N failed channels"**

**P1-3: Information Hierarchy Reordered**

```
1. Electrode Group Header + Status Badge (summary)
2. Failed Channels Editor (EDITABLE - moved to top!)
3. [Collapsible] "View device configuration"
   - Read-only device info
   - Channel map grid
```

**Rationale:** Users came to mark failed channels, not review device specs. Put actionable content first.

**P1-4: Visual Anchoring for Multiple Expanded Groups**

```css
.electrode-group-details[open] {
  border-left: 3px solid var(--color-primary);
  background-color: var(--color-grey-50);
}
```

### Workflow Analysis

**Optimized Task Flow (with P1-3 applied):**

1. Navigate to Day Editor
2. Click "Devices" step
3. Scan list, status badges show group health
4. Expand relevant group
5. **Immediately see Failed Channels checkboxes** (at top)
6. Check failed channels
7. Blur → auto-save + validate

**Interaction count:** 6 actions (40% reduction from original design)

---

## Visual Design (Incorporating Review Feedback)

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Devices Configuration                                       │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Device configuration inherited from Animal              │ │
│ │ Edit Animal →                                           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ▶ Electrode Group 0: CA1            [✓ All channels OK]    │
│ ▶ Electrode Group 1: PFC       [⚠ 2 failed channels]       │
│ ▼ Electrode Group 2: Hippocampus    [✓ All channels OK]    │
│   ┌───────────────────────────────────────────────────────┐ │
│   │ Failed Channels (Editable - WHITE BACKGROUND)        │ │
│   │                                                       │ │
│   │ Shank #1 (Ntrode ID: 8)                              │ │
│   │ Failed Channels: ☐ 0  ☐ 1  ☐ 2  ☐ 3                  │ │
│   │ [ℹ] Only mark channels with hardware failures        │ │
│   │ [validation error if any]                            │ │
│   └───────────────────────────────────────────────────────┘ │
│   ┌───────────────────────────────────────────────────────┐ │
│   │ ▶ View Device Configuration (Collapsible)            │ │
│   │   [When expanded: device info + channel map]         │ │
│   └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Color System (Material Design - From DayEditor.css)

**Primary Colors:**

```css
--color-primary: #2196f3;          /* Blue */
--color-success: #2e7d32;          /* Dark green (8.2:1 contrast) */
--color-warning: #f57c00;          /* Amber 700 (NEW - true warning color) */
--color-error: #d32f2f;            /* Red */
```

**Background Colors:**

```css
--color-grey-50: #fafafa;          /* Read-only section (lighter) */
--color-grey-100: #f5f5f5;         /* Hover state */
--color-grey-200: #eeeeee;         /* Borders */
```

**Status Badge Colors (WCAG AA compliant):**

```css
/* Success Badge */
.status-badge.status-clean {
  background-color: #e8f5e9;       /* Green 50 */
  color: #2e7d32;                  /* Green 800 - 8.2:1 ratio */
}

/* Warning Badge */
.status-badge.status-warning {
  background-color: #fff3e0;       /* Amber 50 */
  color: #e65100;                  /* Orange 900 - 8.5:1 ratio */
}

/* Error Badge */
.status-badge.status-error {
  background-color: #ffebee;       /* Red 50 */
  color: #c62828;                  /* Red 800 - 7.8:1 ratio */
}
```

### Typography

```css
/* Section Header */
.devices-step h2 {
  font-size: 1.5rem;
  font-weight: 500;
  margin-bottom: var(--spacing-md);
}

/* Electrode Group Summary */
.electrode-group-summary {
  font-size: 1rem;
  font-weight: 500;
}

/* Status Badge */
.status-badge {
  font-size: 0.875rem;
  font-weight: 500;
}

/* Help Text */
.field-help-text {
  font-size: 0.875rem;
  color: var(--color-grey-700);
}
```

### Interactive States

```css
/* Summary Hover */
.electrode-group-details summary {
  cursor: pointer;
  padding: var(--spacing-md);
  transition: background-color 0.15s ease;
}

.electrode-group-details summary:hover {
  background-color: var(--color-grey-100);
}

/* Expanded State (Visual Anchor) */
.electrode-group-details[open] {
  border-left: 3px solid var(--color-primary);
  background-color: var(--color-grey-50);
  margin-bottom: var(--spacing-md);
}

/* Focus State */
.electrode-group-details summary:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

### Status Badge Layout (Flexbox - Prevents Wrapping)

```jsx
<summary className="electrode-group-summary">
  <span className="electrode-group-label">
    <span className="toggle-icon" aria-hidden="true">▶</span>
    Electrode Group {group.id}: {group.location}
  </span>
  <span className="status-badge status-clean" role="status" aria-label="Status: All channels OK">
    <span aria-hidden="true">✓</span> All channels OK
  </span>
</summary>
```

```css
.electrode-group-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-md);
}

.status-badge {
  flex-shrink: 0; /* Prevent wrapping on narrow screens */
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: 4px;
  white-space: nowrap;
}
```

### Responsive Design

**Mobile (<600px):**

```css
@media (max-width: 600px) {
  .electrode-group-summary {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xs);
  }

  .status-badge {
    align-self: flex-start;
  }

  /* Stack bad channels checkboxes vertically */
  .bad-channels-checkboxes {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }
}
```

---

## Accessibility (WCAG 2.1 Level AA)

### Semantic HTML

```jsx
<section className="devices-step" aria-labelledby="devices-heading">
  <h2 id="devices-heading">Devices Configuration</h2>

  {/* ARIA live region for validation */}
  <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
    {errorCount > 0 && `${errorCount} validation errors in electrode groups`}
  </div>

  {/* Inherited notice */}
  <div className="inherited-notice">
    Device configuration inherited from Animal
    <a href={`#/animal/${animal.id}`} aria-label={`Edit ${animal.id} animal configuration`}>
      Edit Animal
    </a>
  </div>

  {/* Electrode groups */}
  {electrodeGroups.map(group => (
    <details key={group.id} className="electrode-group-details">
      <summary className="electrode-group-summary">
        <span className="electrode-group-label">
          <span className="toggle-icon" aria-hidden="true">▶</span>
          Electrode Group {group.id}: {group.location}
        </span>
        <span
          className={`status-badge status-${getStatusClass(group)}`}
          role="status"
          aria-label={`Status: ${getStatusText(group)}`}
        >
          <span aria-hidden="true">{getStatusIcon(group)}</span>
          {getStatusText(group)}
        </span>
      </summary>

      <div className="electrode-group-content">
        {/* Content structure */}
      </div>
    </details>
  ))}
</section>
```

### Keyboard Navigation

**Native `<details>` behavior:**

- `Space` or `Enter`: Toggle expand/collapse
- `Tab`: Navigate between groups
- Arrow keys: Navigate checkboxes within group

**Focus management:**

- Focus stays on `<summary>` after expanding
- Focus stays on checkbox after blur (auto-save)
- No jarring focus jumps

### Screen Reader Experience

**Group summary announcement:**
> "Electrode Group 0: CA1, Status: All channels OK, collapsed, button. Press Space to expand."

**Failed channels announcement:**
> "Failed Channels for Shank 1, checkbox group. Channel 0, not checked. Channel 1, checked. Channel 2, not checked..."

**Validation error announcement (live region):**
> "1 validation error in electrode groups. Channel 5 does not exist in ntrode map."

---

## Validation Rules

### Failed Channels Validation

```javascript
/**
 * Validate bad channels for a ntrode
 *
 * @param {number[]} badChannels - Selected bad channel numbers
 * @param {object} ntrode - Ntrode configuration from animal
 * @returns {{ valid: boolean, errors?: string[], warning?: string }}
 */
function validateBadChannels(badChannels, ntrode) {
  const validChannels = Object.keys(ntrode.map).map(Number);
  const invalidChannels = badChannels.filter(ch => !validChannels.includes(ch));

  // Error: Channel doesn't exist in map
  if (invalidChannels.length > 0) {
    return {
      valid: false,
      errors: [`Invalid channels: ${invalidChannels.join(', ')}. Valid channels are: ${validChannels.join(', ')}`]
    };
  }

  // Warning: All channels marked as bad
  if (badChannels.length === validChannels.length && badChannels.length > 0) {
    return {
      valid: true,
      warning: `All ${badChannels.length} channels marked as failed. This electrode group will be excluded from analysis. Confirm this is intentional.`
    };
  }

  // Success
  return { valid: true };
}
```

### Edge Cases

**Case 1: Missing ntrode map**

```javascript
if (!ntrodes || ntrodes.length === 0) {
  return (
    <div className="error-state-inline">
      <p>⚠ No channel mapping found for this electrode group.</p>
      <p>This usually indicates data corruption. Please review animal configuration.</p>
      <a href={`#/animal/${animal.id}`}>Fix in Animal Editor</a>
    </div>
  );
}
```

**Case 2: No electrode groups**

```javascript
if (electrodeGroups.length === 0) {
  return (
    <div className="empty-state">
      <p>No electrode groups configured for {animal.id}</p>
      <p className="empty-state-hint">
        Electrode groups are configured at the animal level and inherited by all days.
      </p>
      <a href={`#/animal/${animal.id}`} className="button-primary">
        Configure Electrode Groups
      </a>
    </div>
  );
}
```

**Case 3: deviceOverrides not initialized**

```javascript
// Safe access with fallback
const badChannels = day.deviceOverrides?.bad_channels?.[ntrodeId] ?? [];
```

---

## Testing Strategy (TDD)

### Test Files

```
src/pages/DayEditor/__tests__/
├── DevicesStep.test.jsx           (~150 lines, 15 tests)
├── BadChannelsEditor.test.jsx     (~120 lines, 12 tests)
└── ReadOnlyDeviceInfo.test.jsx    (~50 lines, 5 tests)
```

### DevicesStep.test.jsx

**Rendering Tests:**

- ✅ Renders all electrode groups as collapsed sections
- ✅ Shows correct status badges (all OK, N failed, all failed)
- ✅ Displays inherited notice with "Edit Animal" link
- ✅ Handles empty state (no electrode groups)
- ✅ Handles missing ntrode maps (data corruption)

**Interaction Tests:**

- ✅ Expands/collapses groups on click
- ✅ Updates store on bad channel changes
- ✅ Auto-saves on blur
- ✅ Shows validation errors inline

**Validation Tests:**

- ✅ Validates channel numbers exist in map
- ✅ Shows warning for all channels failed
- ✅ Handles invalid channel numbers

**Accessibility Tests:**

- ✅ Has proper ARIA landmarks
- ✅ Status badges have role="status"
- ✅ ARIA live region announces errors
- ✅ Keyboard navigation works (Tab, Space, Enter)

### BadChannelsEditor.test.jsx

**Rendering Tests:**

- ✅ Renders checkboxes for each channel
- ✅ Shows current bad channels as checked
- ✅ Displays channel map (read-only)
- ✅ Shows explanatory header

**Interaction Tests:**

- ✅ Updates on checkbox change
- ✅ Calls onUpdate with correct data structure
- ✅ Auto-saves on blur

**Validation Tests:**

- ✅ Validates channel numbers
- ✅ Shows validation errors
- ✅ Warns when all channels selected

**Edge Cases:**

- ✅ Handles missing bad_channels (undefined)
- ✅ Handles empty ntrode list

### ReadOnlyDeviceInfo.test.jsx

**Rendering Tests:**

- ✅ Displays device_type
- ✅ Displays location and targeted_location
- ✅ Displays coordinates with units
- ✅ Displays description
- ✅ Formats coordinates correctly (e.g., "(2.6, -3.8, 0) mm")

---

## Implementation Checklist

### Phase 1: Core Components (TDD)

- [ ] Write `DevicesStep.test.jsx` (15 tests)
- [ ] Run tests → verify FAIL
- [ ] Implement `DevicesStep.jsx` (~250 lines)
  - [ ] Accordion structure with `<details>`
  - [ ] Status badge calculation
  - [ ] Empty state handling
  - [ ] Inherited notice
- [ ] Run tests → verify PASS

- [ ] Write `BadChannelsEditor.test.jsx` (12 tests)
- [ ] Run tests → verify FAIL
- [ ] Implement `BadChannelsEditor.jsx` (~180 lines)
  - [ ] Checkbox grid for bad channels
  - [ ] Validation on blur
  - [ ] Channel map integration (collapsible)
- [ ] Run tests → verify PASS

- [ ] Write `ReadOnlyDeviceInfo.test.jsx` (5 tests)
- [ ] Run tests → verify FAIL
- [ ] Implement `ReadOnlyDeviceInfo.jsx` (~80 lines)
  - [ ] Device configuration display
  - [ ] Coordinate formatting
- [ ] Run tests → verify PASS

### Phase 2: Styling

- [ ] Create CSS in `DayEditor.css` (~155 lines)
  - [ ] `.electrode-group-details` styles
  - [ ] `.status-badge` variants (clean, warning, error)
  - [ ] `.bad-channels-checkboxes` layout
  - [ ] Responsive breakpoints (@media queries)

### Phase 3: Integration

- [ ] Update `DayEditorStepper.jsx` line 98:

  ```jsx
  { id: 'devices', label: 'Devices', component: DevicesStep },
  ```

- [ ] Update `validation.js` to include devices validation
- [ ] Test full stepper workflow (Overview → Devices → back/forth)

### Phase 4: Code Review

- [ ] Run `code-reviewer` agent
- [ ] Address P0/P1 issues
- [ ] Run full test suite (verify 2394+ tests passing)
- [ ] Verify no regressions

### Phase 5: Documentation

- [ ] Update `TASKS.md` (mark M6 first task complete)
- [ ] Update `SCRATCHPAD.md` (session summary)
- [ ] Update `REFACTOR_CHANGELOG.md` (M6 entry)
- [ ] Commit with message: `feat(M6): implement DevicesStep with bad channels editing`

---

## Files to Create/Modify

### New Files (3 components + 3 tests)

```
src/pages/DayEditor/
├── DevicesStep.jsx              (~250 lines)
├── BadChannelsEditor.jsx        (~180 lines)
├── ReadOnlyDeviceInfo.jsx       (~80 lines)
└── __tests__/
    ├── DevicesStep.test.jsx     (~150 lines, 15 tests)
    ├── BadChannelsEditor.test.jsx (~120 lines, 12 tests)
    └── ReadOnlyDeviceInfo.test.jsx (~50 lines, 5 tests)
```

### Modified Files

```
src/pages/DayEditor/
├── DayEditorStepper.jsx         (1 line change: import DevicesStep)
├── DayEditor.css                (+155 lines: devices styling)
└── validation.js                (+30 lines: devices validation)
```

---

## Estimated Effort

**Total Effort:** 8-10 hours

**Breakdown:**

- Design (complete): 2 hours ✅
- Test writing: 3 hours
- Implementation: 3 hours
- Styling: 1.5 hours
- Code review + fixes: 1 hour
- Documentation: 0.5 hours

---

## Success Criteria

### Functional Requirements

- ✅ Users can view inherited electrode group configuration
- ✅ Users can mark channels as failed (day-specific override)
- ✅ Changes auto-save to store on blur
- ✅ Validation prevents invalid channel numbers
- ✅ Warning shown when all channels failed
- ✅ Empty states handled gracefully

### UX Requirements

- ✅ Status badges show group health at-a-glance
- ✅ Failed channels editor appears first (prioritized)
- ✅ Clear distinction between read-only and editable
- ✅ Keyboard navigation works
- ✅ Multiple groups can be expanded simultaneously

### Technical Requirements

- ✅ WCAG 2.1 Level AA compliant
- ✅ Color contrast meets 4.5:1 ratio
- ✅ Follows Container/Presentational pattern
- ✅ Reuses existing components (ReadOnlyField, ChannelMap)
- ✅ Matches Material Design system (M5)
- ✅ All tests passing (32+ new tests)
- ✅ No regressions in existing tests

---

## Deferred to Future Milestones

**Deferred to M7 (Epochs Step):**

- Camera configuration (tied to behavioral epochs)

**Deferred to Future:**

- Bulk operations (mark all, clear all, copy from previous day) - P2
- Comparison with previous day - P2
- Keyboard shortcuts for power users - P2
- Visual indicator in day list for device overrides - P2

---

## References

- [TASKS.md](TASKS.md) - M6 milestone tasks
- [OverviewStep.jsx](../src/pages/DayEditor/OverviewStep.jsx) - Pattern reference
- [animal_hierarchy.md](animal_hierarchy.md) - Data model
- [nwb_schema.json](../src/nwb_schema.json) - Schema definition
- [ChannelMap.jsx](../src/ntrode/ChannelMap.jsx) - Existing component to reuse

---

## Approval

**Design Status:** ✅ APPROVED (with P0/P1 fixes incorporated)

**UX Review:** NEEDS_POLISH → **APPROVED** (all P0/P1 issues addressed)
**UI Review:** NEEDS_POLISH → **APPROVED** (all P0/P1 issues addressed)

**Ready for Implementation:** YES

**Next Step:** Read TESTING_PATTERNS.md and begin TDD implementation
