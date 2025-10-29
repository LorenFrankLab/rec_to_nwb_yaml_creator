# M8 Implementation Plan: Cameras, Hardware & Tasks

**Created:** 2025-10-29
**Status:** APPROVED - Ready for implementation
**Estimated Effort:** 36-44 hours (1-1.5 weeks)

---

## Executive Summary

M8 completes the animal-level hardware configuration and adds day-level task/epoch management. This milestone implements the **"Animal = Template, Day = Instance"** pattern, where users configure hardware once at animal level and inherit configuration across all recording days.

**Key Insight:** Behavioral events (DIO channels) and cameras rarely change per session, so they belong at animal level. Tasks and epochs vary per session, so they belong at day level.

---

## Architecture Overview

### Animal Editor (becomes 4 steps)

```
Step 1: Electrode Groups ✅ (M7 complete)
Step 2: Channel Maps ✅ (M7 complete)
Step 3: Cameras, Data Acq & Behavioral Events (M8a - NEW)
Step 4: Optogenetics (M8.5 - OPTIONAL, future)
```

### Day Editor (becomes 5 steps)

```
Step 1: Overview ✅ (M5 complete)
Step 2: Devices (bad channels) ✅ (M6 complete)
Step 3: Tasks & Epochs (M8b - NEW)
Step 4: Associated Files (M8.5 - future)
Step 5: Export (M9 - future)
```

---

## UX & UI Review Summary

### UX Review Results (NEEDS_POLISH)

**Approved with critical fixes:**

1. ✅ **Mental model is sound:** Animal = Template, Day = Instance aligns with scientific workflow
2. ⚠️ **3 Critical Issues identified:**
   - Don't block task creation if cameras not configured (non-blocking validation)
   - Allow incomplete tasks to be saved with warnings
   - Add explicit UI for day-specific behavioral events
3. ✅ **Efficiency gains validated:** 8.5 hours vs. 33 hours for 100 sessions

**Key Recommendations:**
- Use info banners (blue) not warnings (amber) for optional configurations
- Add "Inherited from Animal" labels with lock icons
- Support day-level behavioral event additions (rare but needed)
- Validate at export time, not data entry time

### UI Design Review Results (NOT production-ready)

**Requires 4-5 days of design refinement:**

1. 🚨 **5 CRITICAL issues** (14-20 hours):
   - Replace emoji icons with Material Symbols (accessibility)
   - Fix inherited field contrast (WCAG AA violation)
   - Enforce 48px minimum touch targets
   - Implement mobile responsive patterns

2. ⚠️ **8 MODERATE issues** (10-14 hours):
   - Refine visual hierarchy (3-section layout)
   - Add validation state indicators in tables
   - Simplify TaskModal with accordion sections

3. ℹ️ **12 MINOR issues** (1.75 hours):
   - Change warning to info styling
   - Align button padding to 8px grid
   - Use consistent `<details>` pattern

**Design System Compliance:**
- ✅ Material Design 3 foundations solid
- ✅ Color palette and spacing consistent
- ✅ Component patterns established
- ❌ Accessibility gaps must be fixed

---

## M8a: Animal Editor Step 3 - Cameras, Hardware & Behavioral Events

### Component: HardwareConfigStep.jsx

**Location:** `src/pages/AnimalEditor/HardwareConfigStep.jsx`

**Purpose:** Configure all recording hardware except electrodes (cameras, data acq device, behavioral events)

### Data Model

```javascript
animal.cameras = [
  {
    id: "1", // Auto-assigned sequential ID
    camera_name: "Overhead", // Descriptive name
    manufacturer: "Basler",
    model: "acA1300-60gm",
    lens: "Fujinon 12.5mm",
    meters_per_pixel: 0.001 // Spatial calibration
  }
]

animal.data_acq_device = {
  system: "SpikeGadgets", // Dropdown: SpikeGadgets, Open Ephys, etc.
  amplifier: "Intan RHD2000",
  adc_circuit: "Intan"
}

animal.technical = {
  default_header_file_path: "/path/to/config.trodesconf",
  ephys_to_volt_conversion: 1.0, // Rarely changed
  times_period_multiplier: 1.0 // Rarely changed
}

animal.behavioral_events = [
  {
    name: "reward_left", // Unique identifier
    description: "Left reward port" // Human-readable description
  },
  {
    name: "reward_right",
    description: "Right reward port"
  }
]
```

### UI Layout (with UX/UI fixes applied)

```
┌─────────────────────────────────────────────────────┐
│ Animal Editor: remy              [Last saved: 2m]   │
├─────────────────────────────────────────────────────┤
│ ● Step 1: Electrode Groups ✓                       │
│ ● Step 2: Channel Maps ✓                           │
│ ● Step 3: Cameras & Hardware (current)             │
│ ○ Step 4: Optogenetics (Optional)                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │ <- Elevation 1
│ ┃ 📹  Cameras                                    ┃ │    (Material Symbol)
│ ┃ ────────────────────────────────────────────── ┃ │
│ ┃                                                 ┃ │
│ ┃ ℹ️  Configure cameras for behavior tracking    ┃ │
│ ┃ Tasks and videos will reference these cameras. ┃ │
│ ┃                                                 ┃ │
│ ┃ ┌───────────────────────────────────────────┐ ┃ │
│ ┃ │ ID | Name     | Manufacturer | Model     │ ┃ │
│ ┃ │    | | m/px  | Status | Actions         │ ┃ │
│ ┃ ├────┼──────────┼──────────────┼──────────┤ ┃ │
│ ┃ │ 1  │ Overhead │ Basler       │ acA...   │ ┃ │
│ ┃ │    │ | 0.001 | ✓      | [Edit][Delete]  │ ┃ │
│ ┃ └───────────────────────────────────────────┘ ┃ │
│ ┃                                                 ┃ │
│ ┃ [ + Add Camera ]                               ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                                     │
│ ┌───────────────────────────────────────────────┐ │ <- Elevation 0
│ │ 🖥️  Data Acquisition Device                   │ │    (gray bg)
│ │ ────────────────────────────────────────────── │ │
│ │                                                 │ │
│ │ System:    [SpikeGadgets ▼]                    │ │
│ │ Amplifier: [Intan RHD2000________________]     │ │
│ │ ADC:       [______________________________]    │ │
│ │                                                 │ │
│ │ Default Header File:                           │ │
│ │ [/path/to/config.trodesconf] [Browse...]       │ │
│ │                                                 │ │
│ │ <details> ▶ Advanced Settings                  │ │
│ │   Ephys to Volt:  [1.0___]                    │ │
│ │   Times Multiplier: [1.0___]                  │ │
│ │   ℹ️  Contact support before changing          │ │
│ │ </details>                                      │ │
│ └───────────────────────────────────────────────┘ │
│                                                     │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │ <- Elevation 1
│ ┃ ⚡  Behavioral Events (DIO Channels)          ┃ │
│ ┃ ────────────────────────────────────────────── ┃ │
│ ┃                                                 ┃ │
│ ┃ ℹ️  Define DIO events for this animal's setup  ┃ │
│ ┃                                                 ┃ │
│ ┃ ┌───────────────────────────────────────────┐ ┃ │
│ ┃ │ Name         | Description                │ ┃ │
│ ┃ ├──────────────┼───────────────────────────┤ ┃ │
│ ┃ │ reward_left  │ Left reward port          │ ┃ │
│ ┃ │ [ Edit ] [ Delete ]                       │ ┃ │
│ ┃ └───────────────────────────────────────────┘ ┃ │
│ ┃                                                 ┃ │
│ ┃ [ + Add Behavioral Event ]                     ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                                     │
├─────────────────────────────────────────────────┤ <- Footer divider
│ [ ← Back to Channel Maps ]  [ Continue to Opto →]│
└─────────────────────────────────────────────────┘
```

### Components to Create

#### 1. HardwareConfigStep.jsx (main container)
- Renders 3 sections with proper elevation hierarchy
- Manages section expand/collapse state
- Handles save/autosave logic

#### 2. CamerasSection.jsx
- Table view of cameras
- Add/Edit/Delete operations
- Validation: unique IDs, positive meters_per_pixel

#### 3. CameraModal.jsx
- Form fields: id (auto), name, manufacturer, model, lens, meters_per_pixel
- Validation: required fields, numeric constraints
- Help text for meters_per_pixel: "Typical range: 0.0005 - 0.002"

#### 4. DataAcqSection.jsx
- Single form (not a table - only one device per animal)
- Collapsible "Advanced Settings" section
- File browser for header file path

#### 5. BehavioralEventsSection.jsx
- Table view of events
- Inline editing for simple fields
- Validation: unique names, non-empty description

### Validation Rules

#### Cameras
- ✅ Camera ID unique within animal
- ✅ Camera ID > 0
- ✅ Meters per pixel > 0
- ⚠️ Meters per pixel typical range (0.0005 - 0.002) - warn if outside
- ✅ Camera name non-empty

#### Data Acquisition Device
- ℹ️ All fields optional (have sensible defaults)
- ✅ Ephys to volt conversion > 0 (if provided)
- ✅ Times multiplier > 0 (if provided)

#### Behavioral Events
- ✅ Event name unique within animal
- ✅ Event name non-empty
- ✅ Event name valid identifier (alphanumeric + underscore)
- ⚠️ Warn if event name conflicts with common reserved words

### Tests to Write

**HardwareConfigStep.test.jsx** (~15 tests)
- Renders all 3 sections
- Sections have correct elevation styling
- Save indicator updates on changes
- Navigation buttons enabled/disabled correctly

**CamerasSection.test.jsx** (~12 tests)
- Empty state with "Add Camera" button
- Table displays cameras correctly
- Add camera opens modal
- Edit camera pre-populates modal
- Delete camera shows confirmation
- Validation: duplicate IDs, negative meters_per_pixel

**CameraModal.test.jsx** (~10 tests)
- Form fields render correctly
- Auto-assigns next sequential ID
- Validates required fields
- Validates numeric constraints
- Save button disabled until valid
- Cancel closes without saving

**DataAcqSection.test.jsx** (~8 tests)
- Renders form fields
- Advanced settings collapsed by default
- File browser opens on button click
- Validation for conversion factors

**BehavioralEventsSection.test.jsx** (~10 tests)
- Empty state
- Table displays events
- Add/edit/delete operations
- Validation: duplicate names, empty fields

**Total M8a Tests:** ~55 tests

### Estimated Effort

- Component implementation: 12-16 hours
- UI/UX fixes (icons, contrast, touch targets): 8-10 hours
- Testing: 6-8 hours
- **Total M8a:** 26-34 hours

---

## M8b: Day Editor Step 3 - Tasks & Epochs

### Component: TasksEpochsStep.jsx

**Location:** `src/pages/DayEditor/TasksEpochsStep.jsx`

**Purpose:** Define what happened during this recording session (tasks, epochs, behavioral events used)

### Data Model

```javascript
day.tasks = [
  {
    task_name: "W-track",
    task_description: "Spatial alternation on W-shaped maze",
    camera_ids: ["1"], // References animal.cameras[].id
    task_epochs: [
      {
        start_time: 0, // Seconds since session start
        end_time: 1800 // 30 minutes
      },
      {
        start_time: 1800,
        end_time: 3600
      }
    ]
    // Implicitly uses animal.behavioral_events
  }
]

// Optional: Day-specific events (rare)
day.day_specific_events = [
  {
    name: "novel_object",
    description: "Novel object presentation (one-time event)"
  }
]
```

### UI Layout (with UX/UI fixes applied)

```
┌─────────────────────────────────────────────────────┐
│ Day Editor: remy-2024-11-01          [Last saved: 1m]│
├─────────────────────────────────────────────────────┤
│ ● Step 1: Overview ✓                               │
│ ● Step 2: Devices ✓                               │
│ ● Step 3: Tasks & Epochs (current)                │
│ ○ Step 4: Associated Files                        │
│ ○ Step 5: Export                                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ℹ️  Define what happened during this recording     │
│                                                     │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃ Tasks                                           ┃ │
│ ┃ ────────────────────────────────────────────── ┃ │
│ ┃                                                 ┃ │
│ ┃ ┌───────────────────────────────────────────┐ ┃ │
│ ┃ │ Task    | Cameras  | Epochs | Actions    │ ┃ │
│ ┃ ├─────────┼──────────┼────────┼────────────┤ ┃ │
│ ┃ │ W-track │ Overhead │ 2      │ [Edit][Del]│ ┃ │
│ ┃ │ Sleep   │ -        │ 1      │ [Edit][Del]│ ┃ │
│ ┃ └───────────────────────────────────────────┘ ┃ │
│ ┃                                                 ┃ │
│ ┃ [ + Add Task ]                                 ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                                     │
│ ℹ️  No cameras configured in animal setup          │ <- Info banner (blue)
│ Cameras are optional but recommended for video     │
│ linking and spatial tracking.                      │
│ [ Add Cameras in Animal Editor ]  [ Skip ]        │
│                                                     │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃ Behavioral Events                               ┃ │
│ ┃ ────────────────────────────────────────────── ┃ │
│ ┃                                                 ┃ │
│ ┃ Inherited from Animal: 🔒                       ┃ │
│ ┃ • reward_left (DIO 1) - Left reward port       ┃ │
│ ┃ • reward_right (DIO 2) - Right reward port     ┃ │
│ ┃ • choice_left (DIO 3) - Left arm entry         ┃ │
│ ┃                                                 ┃ │
│ ┃ <details> ▶ Session-Specific Events (Optional) ┃ │
│ ┃   (none)                                        ┃ │
│ ┃   [ + Add Session-Specific Event ]             ┃ │
│ ┃ </details>                                      ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                                     │
├─────────────────────────────────────────────────┤
│ [ ← Back to Devices ]      [ Continue to Files →]│
└─────────────────────────────────────────────────┘
```

### TaskModal (with UX fixes - accordion sections)

```
┌─────────────────────────────────────────────────────┐
│ Edit Task: W-track                            [×]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│ <details open> ▼ Task Details (Required)           │
│   Task Name*                                        │
│   [W-track alternation________________]            │
│                                                     │
│   Description                                       │
│   [Spatial alternation on W-maze______]            │
│ </details>                                          │
│                                                     │
│ <details open> ▼ Cameras (Optional)                │
│   Inherited from animal configuration:              │
│   ☑ Overhead (Camera 1)                            │
│   ☐ Side View (Camera 2)                           │
│                                                     │
│   ℹ️  No cameras configured yet                    │
│   [ Configure in Animal Editor ]                   │
│ </details>                                          │
│                                                     │
│ <details> ▶ Behavioral Events (3 inherited)        │
│   Inherited events will be active during this      │
│   task's epochs:                                   │
│   ☑ reward_left  ☑ reward_right  ☑ choice_left   │
│ </details>                                          │
│                                                     │
│ <details open> ▼ Task Epochs* (Required)           │
│   ┌────────────────────────────────────────┐      │
│   │ # | Start (s) | End (s) | [+]         │      │
│   ├───┼───────────┼─────────┼─────────────┤      │
│   │ 1 │    0      │  1800   │ [Del]       │      │
│   │ 2 │  1800     │  3600   │ [Del]       │      │
│   └────────────────────────────────────────┘      │
│                                                     │
│   ℹ️  Times in seconds since session start         │
│ </details>                                          │
│                                                     │
│ [ Cancel ]              [ Save Task ]              │
└─────────────────────────────────────────────────────┘
```

### Components to Create

#### 1. TasksEpochsStep.jsx (main container)
- Renders tasks table
- Shows inherited behavioral events (read-only)
- Optional section for day-specific events
- Handles camera availability warnings

#### 2. TasksTable.jsx
- Table view of tasks
- Add/Edit/Delete operations
- Shows camera count and epoch count
- Status badges for validation

#### 3. TaskModal.jsx
- Accordion sections for progressive disclosure
- Task name/description inputs
- Camera selection (multi-select checkboxes)
- Behavioral events display (inherited from animal)
- Task epochs inline editor

#### 4. TaskEpochsEditor.jsx
- Dynamic table for adding/removing epochs
- Validation: end_time > start_time
- Inline editing of times
- Add row button

#### 5. BehavioralEventsDisplay.jsx
- Read-only display of inherited events from animal
- Collapsible section for day-specific events
- Add/edit day-specific events (rare use case)

### Validation Rules

#### Tasks
- ✅ Task name non-empty
- ✅ Task name unique within day
- ⚠️ Warn if no cameras selected (optional but recommended)
- ⚠️ Warn if camera_ids reference non-existent cameras
- ✅ At least one epoch required per task

#### Task Epochs
- ✅ Start time >= 0
- ✅ End time > start_time
- ⚠️ Warn if epochs overlap (might be intentional)
- ℹ️ Allow gaps between epochs (sleep, breaks)

#### Day-Specific Events
- ✅ Event name unique (within day + animal combined)
- ✅ Event name valid identifier
- ⚠️ Warn if duplicates animal-level event name

### Tests to Write

**TasksEpochsStep.test.jsx** (~15 tests)
- Renders tasks table
- Shows inherited behavioral events
- Camera warning appears if no cameras
- Day-specific events section collapsible
- Navigation buttons work

**TasksTable.test.jsx** (~10 tests)
- Empty state with "Add Task"
- Table displays tasks correctly
- Add/edit/delete operations
- Status badges for validation

**TaskModal.test.jsx** (~18 tests)
- All accordion sections render
- Required sections open by default
- Optional sections collapsed by default
- Camera selection works
- Task epochs editor integrated
- Validation errors shown
- Save button disabled until valid

**TaskEpochsEditor.test.jsx** (~12 tests)
- Add/remove epoch rows
- Inline editing of times
- Validation: end > start
- Auto-focus on new row

**BehavioralEventsDisplay.test.jsx** (~8 tests)
- Shows inherited events
- Read-only styling applied
- Day-specific section works
- Add day-specific event

**Total M8b Tests:** ~63 tests

### Estimated Effort

- Component implementation: 10-14 hours
- UI refinement (accordions, validation states): 4-6 hours
- Testing: 6-8 hours
- **Total M8b:** 20-28 hours

---

## Implementation Order

### Phase 1: M8a - Animal Hardware Config (Week 1)

**Days 1-2: Cameras Section**
1. Create CamerasSection.jsx + CameraModal.jsx
2. Write tests (22 tests)
3. UI fixes: Material Symbols, touch targets, validation states
4. Test responsive behavior

**Days 3-4: Data Acq & Behavioral Events**
5. Create DataAcqSection.jsx
6. Create BehavioralEventsSection.jsx
7. Write tests (18 tests)
8. Integrate all sections into HardwareConfigStep.jsx

**Day 5: Integration & Polish**
9. Animal Editor navigation updates
10. Autosave integration
11. Accessibility audit
12. Code review

### Phase 2: M8b - Day Tasks & Epochs (Week 2)

**Days 1-2: Tasks Infrastructure**
1. Create TasksEpochsStep.jsx
2. Create TasksTable.jsx
3. Create TaskModal.jsx with accordions
4. Write tests (25 tests)

**Days 3-4: Epochs & Events**
5. Create TaskEpochsEditor.jsx
6. Create BehavioralEventsDisplay.jsx
7. Write tests (20 tests)
8. Validation integration

**Day 5: Integration & Polish**
9. Day Editor navigation updates
10. Cross-reference validation (tasks ↔ cameras)
11. Accessibility audit
12. Code review

---

## Acceptance Criteria

### M8a (Animal Hardware Config)

- ✅ Users can add/edit/delete cameras with validation
- ✅ Data acquisition device configurable with advanced settings collapsed
- ✅ Behavioral events manageable with unique name validation
- ✅ All fields persist to animal.cameras, animal.data_acq_device, animal.behavioral_events
- ✅ Material Symbols used (not emoji)
- ✅ WCAG AA compliant (4.5:1 contrast minimum)
- ✅ Touch targets >= 48px
- ✅ Mobile responsive (card layout < 600px)
- ✅ 55+ tests passing
- ✅ No regressions in existing 2681 tests

### M8b (Day Tasks & Epochs)

- ✅ Users can add/edit/delete tasks
- ✅ Task epochs editor works with validation
- ✅ Inherited behavioral events displayed (read-only)
- ✅ Day-specific events can be added (optional)
- ✅ Camera references validated (warn if missing)
- ✅ Info banner for missing cameras (blue, non-blocking)
- ✅ TaskModal uses accordion pattern
- ✅ All validation rules enforced
- ✅ 63+ tests passing
- ✅ No regressions

### Combined (M8a + M8b)

- ✅ Animal Editor has 3 steps (Electrode Groups, Channel Maps, Hardware)
- ✅ Day Editor has 3 steps (Overview, Devices, Tasks)
- ✅ Inheritance works: day.tasks reference animal.cameras
- ✅ Behavioral events inherited from animal (with day override option)
- ✅ Total: 2799+ tests passing (2681 existing + 118 new)
- ✅ Golden baseline tests still passing (YAML output unchanged for existing features)
- ✅ Code review approved

---

## Data Migration & Backward Compatibility

### Existing Data (from legacy form imports)

When users import existing YAML files:

```yaml
# Legacy YAML has cameras at root level
cameras:
  - id: "1"
    camera_name: "Overhead"
    # ...

behavioral_events:
  - name: "reward_left"
    # ...
```

**Migration Strategy:**

1. On YAML import, detect cameras/behavioral_events at root level
2. Move to `animal.cameras` and `animal.behavioral_events`
3. Show migration banner: "Cameras moved to animal configuration. Edit in Animal Editor."

### Export Strategy

When exporting day → YAML, merge animal + day:

```javascript
// Export function merges:
const yamlData = {
  // Session metadata from day
  session_id: day.session.session_id,

  // Subject from animal
  subject: animal.subject,

  // Devices from animal + day overrides
  devices: mergeDevices(animal.devices, day.deviceOverrides),

  // Cameras from animal
  cameras: animal.cameras,

  // Data acq from animal
  data_acq_device: animal.data_acq_device,

  // Behavioral events from animal + day
  behavioral_events: [
    ...animal.behavioral_events,
    ...day.day_specific_events
  ],

  // Tasks from day (with camera references resolved)
  tasks: day.tasks
}
```

---

## Testing Strategy

### Unit Tests (~118 new tests)

- Component rendering
- User interactions (click, type, tab)
- Validation rules
- State updates

### Integration Tests (~10 new tests)

- Animal Editor → Day Editor inheritance
- Camera references in tasks
- Behavioral event inheritance
- YAML export with merged data

### Accessibility Tests (~8 new tests)

- Keyboard navigation
- Screen reader announcements
- Focus management
- Color contrast validation

### Regression Tests

- Run existing 2681 tests
- Verify golden baseline YAML tests pass
- Check no breaking changes in legacy form

---

## Rollout Plan

### Pre-Launch

1. Complete M8a implementation (Week 1)
2. Complete M8b implementation (Week 2)
3. Internal testing with sample data
4. Accessibility audit with screen reader
5. Code review approval
6. Update documentation (CHANGELOG.md, TASKS.md, SCRATCHPAD.md)

### Launch (Soft Release)

1. Deploy to production with feature flag OFF by default
2. Enable for beta testers (2-3 users)
3. Collect feedback on workflow
4. Fix any critical issues
5. Monitor for errors/crashes

### Full Release

1. Enable feature flag for all users
2. Add migration guide for legacy users
3. Update help documentation
4. Announce in lab meeting/email
5. Monitor usage and support tickets

---

## Risk Mitigation

### Risk 1: Users confused about animal vs. day split

**Likelihood:** Medium
**Impact:** Medium (users edit wrong place)
**Mitigation:**
- Add "Inherited from Animal" labels everywhere
- Show lock icons on inherited fields
- Add tooltips explaining inheritance model
- Create video tutorial

### Risk 2: Existing YAML files don't import correctly

**Likelihood:** Low
**Impact:** High (data loss)
**Mitigation:**
- Write comprehensive import tests (50+ sample YAMLs)
- Test with production data from lab
- Add validation warnings for unexpected structures
- Provide manual recovery path

### Risk 3: Performance degrades with many cameras/events

**Likelihood:** Low
**Impact:** Low (typical: 2 cameras, 4 events)
**Mitigation:**
- Test with 10 cameras, 20 events
- Use virtualization if table > 100 rows
- Monitor bundle size (should be < 500KB added)

### Risk 4: Accessibility issues missed in testing

**Likelihood:** Medium
**Impact:** High (excludes users with disabilities)
**Mitigation:**
- Manual testing with NVDA and VoiceOver
- Automated Axe tests in CI
- User testing with accessibility-focused reviewer
- Fix all WCAG AA violations before launch

---

## Success Metrics

### Quantitative

- Time to configure new animal: < 45 minutes (baseline: 2+ hours)
- Time per recording day: < 8 minutes (baseline: 20+ minutes)
- Test coverage: 100% of new components
- Accessibility: 0 WCAG AA violations
- Performance: < 100ms to render hardware config step

### Qualitative

- User feedback: "Easier to configure hardware"
- Support tickets: < 5 per week (related to M8)
- Error rate: < 5% validation failures on first export
- Adoption: > 80% of users complete Animal Editor setup

---

## Future Enhancements (Post-M8)

### M8.5: Optogenetics & Associated Files

- Animal Editor Step 4: Optogenetics hardware
- Day Editor Step 4: FS GUI YAMLs, videos, associated files

### M9: Export Step

- Day Editor Step 5: YAML export with validation summary
- Shadow export comparison (golden baseline verification)

### M10: Validation Summary & Batch Tools

- Cross-day validation
- Batch export (multiple days)
- Autosave to localStorage

### M11: Camera Day-Level Overrides

- Allow day-specific camera calibration changes
- Merge strategy: day override > animal default

---

## Appendix: UX/UI Review Artifacts

### UX Review Key Findings

**Rating:** NEEDS_POLISH

**Critical Issues (MUST FIX):**
1. Camera blocking dependency - Allow task creation without cameras
2. Multi-editor navigation for errors - Add inline recovery paths
3. Behavioral events ambiguity - Add explicit day-level override UI

**Approved Patterns:**
- Animal = Template mental model ✓
- Inheritance with overrides ✓
- Progressive disclosure ✓

### UI Design Review Key Findings

**Rating:** NOT production-ready (4-5 days fixes needed)

**Critical Issues (14-20 hours):**
1. Replace emoji with Material Symbols (accessibility)
2. Fix read-only field contrast (WCAG AA)
3. Enforce 48px touch targets
4. Implement mobile responsive patterns

**Design System Compliance:**
- Color palette: ✓ Consistent
- Spacing: ✓ 8px grid
- Typography: ✓ Scales correctly
- Components: ✓ Reuses existing patterns

---

**End of Plan - Ready for Implementation**
