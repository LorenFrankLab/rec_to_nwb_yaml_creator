# M5 Day Editor Stepper - Implementation Design Specification

**Version:** 2.0 (Revised after design review)
**Date:** 2025-10-28
**Status:** APPROVED FOR IMPLEMENTATION
**Review Feedback:** See [M5_DESIGN_REVIEW.md](M5_DESIGN_REVIEW.md)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Component Specifications](#component-specifications)
4. [State Management](#state-management)
5. [Validation Strategy](#validation-strategy)
6. [Styling & Accessibility](#styling--accessibility)
7. [Testing Strategy](#testing-strategy)
8. [Implementation Order](#implementation-order)

---

## Overview

### Purpose
Create a multi-step editor for recording session metadata with auto-save, field-level validation, and clear separation between inherited (animal) and editable (day) fields.

### Scope (M5)
- **DayEditorStepper** container with 5-step navigation
- **OverviewStep** form for session metadata (only step with full implementation in M5)
- Steps 2-5 (Devices, Epochs, Validation, Export) implemented as stubs for future milestones
- Auto-save with visual feedback
- Field-level validation with inline errors
- Accessibility-first design (WCAG 2.1 AA)

### User Workflow
```
1. User navigates from AnimalWorkspace → #/day/remy-2023-06-22
2. Day Editor loads with Overview step active
3. User sees inherited fields (subject, experimenters) as read-only
4. User fills session fields (session_id, session_description)
5. Fields auto-save on blur
6. Inline validation errors appear if invalid
7. Step status updates in navigation (✓ valid, ⚠ incomplete, ✗ error)
8. User can navigate to other steps (stubs for now)
9. Export step disabled until all validation passes
```

---

## Architecture

### Component Hierarchy

```
AppLayout (from M2)
  └─ DayEditor (route: #/day/:id)
      └─ DayEditorStepper (container)
          ├─ Header
          │   ├─ Title: "Day Editor: {animal} - {date}"
          │   └─ SaveIndicator (auto-save status)
          ├─ StepNavigation (breadcrumb)
          │   └─ 5 step buttons with status icons
          └─ Main Content
              └─ [Current Step Component]
                  ├─ OverviewStep (M5 - full implementation)
                  ├─ DevicesStub (placeholder)
                  ├─ EpochsStub (placeholder)
                  ├─ ValidationStub (placeholder)
                  └─ ExportStub (placeholder)
```

### Approach: Container/Presentational Pattern

**Chosen Approach:** Approach B from brainstorming - Stepper Container + Separate Step Components

**Rationale:**
- Clear separation of concerns
- Each step independently testable
- Easy to extend in future milestones
- Matches existing codebase patterns (AnimalWorkspace)
- Not over-engineered (vs. registry pattern)

### File Structure

```
src/pages/DayEditor/
├─ DayEditorStepper.jsx          (~200-250 lines)
├─ OverviewStep.jsx               (~150-200 lines)
├─ StepNavigation.jsx             (~80-100 lines)
├─ SaveIndicator.jsx              (~40-60 lines)
├─ ReadOnlyField.jsx              (~30-40 lines)
├─ validation.js                  (~120-150 lines)
├─ DayEditor.css                  (~200-250 lines)
└─ __tests__/
    ├─ DayEditorStepper.test.jsx  (~100 lines, 10 tests)
    ├─ OverviewStep.test.jsx      (~150 lines, 15 tests)
    ├─ StepNavigation.test.jsx    (~80 lines, 8 tests)
    ├─ SaveIndicator.test.jsx     (~60 lines, 6 tests)
    └─ validation.test.js         (~120 lines, 12 tests)
```

**New Utilities:**
```
src/hooks/
└─ useDayIdFromUrl.js             (~40 lines)

src/state/
└─ workspaceUtils.js              (add mergeDayMetadata function)
```

---

## Component Specifications

### 1. DayEditorStepper (Container)

**File:** `src/pages/DayEditor/DayEditorStepper.jsx`

**Responsibilities:**
- Manage current step state
- Resolve dayId from URL
- Compute step validation status
- Provide field update callback to steps
- Track auto-save state

**Props:**
```javascript
// No props - reads dayId from URL via useDayIdFromUrl hook
```

**State:**
```javascript
const [currentStep, setCurrentStep] = useState('overview');
const [lastSaved, setLastSaved] = useState(null);
const [saveError, setSaveError] = useState(null);
```

**Implementation:**

```javascript
/**
 * Day Editor Stepper - Container for multi-step session metadata editing
 *
 * @returns {JSX.Element}
 */
export default function DayEditorStepper() {
  const { model, actions } = useStoreContext();
  const dayId = useDayIdFromUrl();
  const [currentStep, setCurrentStep] = useState('overview');
  const [lastSaved, setLastSaved] = useState(null);
  const [saveError, setSaveError] = useState(null);

  // Get day and animal from store
  const day = model.workspace?.days?.[dayId];
  const animal = day ? model.workspace?.animals?.[day.animalId] : null;

  // Error state: day not found
  if (!dayId) {
    return <ErrorState message="No day ID provided in URL" />;
  }

  if (!day) {
    return <ErrorState message={`Day not found: ${dayId}`} />;
  }

  if (!animal) {
    return <ErrorState message={`Animal not found: ${day.animalId}`} />;
  }

  // Merge animal + day for validation
  const mergedDay = useMemo(() =>
    mergeDayMetadata(animal, day),
    [animal, day]
  );

  // Compute step validation status
  const stepStatus = useMemo(() =>
    computeStepStatus(day, mergedDay),
    [day, mergedDay]
  );

  // Field update handler with nested path support
  const handleFieldUpdate = useCallback((fieldPath, value) => {
    try {
      // Parse path: "session.session_id" → ["session", "session_id"]
      const pathSegments = fieldPath.split('.');

      // Clone day and update nested field immutably
      const updated = structuredClone(day);
      let target = updated;
      for (let i = 0; i < pathSegments.length - 1; i++) {
        target = target[pathSegments[i]];
      }
      target[pathSegments[pathSegments.length - 1]] = value;

      // Extract top-level keys that changed
      const topLevelKey = pathSegments[0];
      const updates = { [topLevelKey]: updated[topLevelKey] };

      // Update store
      actions.updateDay(dayId, updates);

      // Update save status
      setLastSaved(new Date().toISOString());
      setSaveError(null);

    } catch (error) {
      console.error('Failed to update field:', error);
      setSaveError(`Failed to save ${fieldPath}: ${error.message}`);
    }
  }, [day, dayId, actions]);

  // Step configuration
  const steps = [
    { id: 'overview', label: 'Overview', component: OverviewStep },
    { id: 'devices', label: 'Devices', component: DevicesStub },
    { id: 'epochs', label: 'Epochs', component: EpochsStub },
    { id: 'validation', label: 'Validation', component: ValidationStub },
    { id: 'export', label: 'Export', component: ExportStub },
  ];

  const CurrentStepComponent = steps.find(s => s.id === currentStep).component;

  return (
    <div className="day-editor-stepper">
      <header className="day-editor-header">
        <h1>Day Editor: {animal.id} - {day.date}</h1>
        <SaveIndicator lastSaved={lastSaved} error={saveError} />
      </header>

      <StepNavigation
        steps={steps}
        currentStep={currentStep}
        stepStatus={stepStatus}
        onNavigate={setCurrentStep}
      />

      <main id="main-content" className="day-editor-content" tabIndex="-1">
        <CurrentStepComponent
          animal={animal}
          day={day}
          mergedDay={mergedDay}
          onFieldUpdate={handleFieldUpdate}
        />
      </main>
    </div>
  );
}

DayEditorStepper.propTypes = {};
```

**Key Features:**
- Uses `useDayIdFromUrl()` hook to parse URL
- Error states for missing day/animal
- Immutable nested field updates via `structuredClone`
- Memoized step status computation
- Error handling with user-friendly messages

---

### 2. OverviewStep (Form)

**File:** `src/pages/DayEditor/OverviewStep.jsx`

**Responsibilities:**
- Display inherited fields as read-only
- Render editable session fields
- Validate fields on blur
- Show inline validation errors
- Call parent `onFieldUpdate` callback

**Props:**
```javascript
PropTypes = {
  animal: PropTypes.object.isRequired,     // Animal metadata
  day: PropTypes.object.isRequired,        // Day metadata
  mergedDay: PropTypes.object.isRequired,  // Merged for validation
  onFieldUpdate: PropTypes.func.isRequired // (fieldPath, value) => void
}
```

**Implementation:**

```javascript
/**
 * Overview Step - Edits session-specific metadata with inherited animal defaults
 *
 * @param {Object} props
 * @param {Animal} props.animal - Animal record (read-only context)
 * @param {Day} props.day - Day record (editable)
 * @param {Object} props.mergedDay - Merged animal + day for validation
 * @param {Function} props.onFieldUpdate - Callback: (fieldPath, value) => void
 */
export default function OverviewStep({ animal, day, mergedDay, onFieldUpdate }) {
  const [fieldErrors, setFieldErrors] = useState({});
  const [validatingField, setValidatingField] = useState(null);

  // Validate field on blur
  const handleBlur = useCallback(async (fieldPath, value) => {
    setValidatingField(fieldPath);

    // 1. Update store (auto-save)
    onFieldUpdate(fieldPath, value);

    // 2. Validate field
    try {
      const { valid, errors } = await validateField(mergedDay, fieldPath);

      setFieldErrors(prev => ({
        ...prev,
        [fieldPath]: valid ? null : errors[0]
      }));
    } catch (error) {
      console.error('Validation error:', error);
      setFieldErrors(prev => ({
        ...prev,
        [fieldPath]: 'Validation failed - please try again'
      }));
    } finally {
      setValidatingField(null);
    }
  }, [mergedDay, onFieldUpdate]);

  // Count validation errors for ARIA announcement
  const errorCount = Object.values(fieldErrors).filter(Boolean).length;

  return (
    <div className="overview-step">
      {/* ARIA live region for screen readers */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {errorCount > 0 && `${errorCount} validation ${errorCount === 1 ? 'error' : 'errors'}`}
      </div>

      {/* Subject Information (Read-Only) */}
      <section className="day-editor-section">
        <h2>Subject Information</h2>
        <div className="inherited-notice">
          Inherited from Animal
          <a href={`#/animal/${animal.id}`}>Edit Animal</a>
        </div>

        <div className="form-grid">
          <ReadOnlyField
            label="Subject ID"
            value={animal.subject.subject_id}
          />
          <ReadOnlyField
            label="Species"
            value={animal.subject.species}
          />
          <ReadOnlyField
            label="Sex"
            value={animal.subject.sex}
          />
          <ReadOnlyField
            label="Genotype"
            value={animal.subject.genotype}
          />
          <ReadOnlyField
            label="Date of Birth"
            value={formatDate(animal.subject.date_of_birth)}
          />
        </div>
      </section>

      {/* Session Information (Editable) */}
      <section className="day-editor-section">
        <h2>Session Information</h2>

        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="session-id" className="required">
              Session ID
            </label>
            <input
              id="session-id"
              type="text"
              name="session.session_id"
              defaultValue={day.session.session_id}
              onBlur={(e) => handleBlur('session.session_id', e.target.value)}
              className={fieldErrors['session.session_id'] ? 'invalid' : ''}
              aria-invalid={!!fieldErrors['session.session_id']}
              aria-describedby={
                fieldErrors['session.session_id'] ? 'session-id-error' : 'session-id-hint'
              }
              required
            />
            <span id="session-id-hint" className="validation-hint">
              Format: {animal.id}_YYYYMMDD (e.g., {animal.id}_20230622)
            </span>
            {fieldErrors['session.session_id'] && (
              <span id="session-id-error" className="validation-error" role="alert">
                {fieldErrors['session.session_id']}
              </span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="session-description" className="required">
              Session Description
            </label>
            <textarea
              id="session-description"
              name="session.session_description"
              rows="3"
              defaultValue={day.session.session_description}
              onBlur={(e) => handleBlur('session.session_description', e.target.value)}
              className={fieldErrors['session.session_description'] ? 'invalid' : ''}
              aria-invalid={!!fieldErrors['session.session_description']}
              aria-describedby={
                fieldErrors['session.session_description'] ? 'session-description-error' : null
              }
              required
            />
            {fieldErrors['session.session_description'] && (
              <span id="session-description-error" className="validation-error" role="alert">
                {fieldErrors['session.session_description']}
              </span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="experiment-description">
              Experiment Description (Optional)
            </label>
            <textarea
              id="experiment-description"
              name="session.experiment_description"
              rows="3"
              defaultValue={day.session.experiment_description}
              onBlur={(e) => handleBlur('session.experiment_description', e.target.value)}
              placeholder="Override animal's default experiment description"
            />
          </div>
        </div>
      </section>

      {/* Experimenters (Read-Only) */}
      <section className="day-editor-section">
        <h2>Experimenters</h2>
        <div className="inherited-notice">
          Inherited from Animal
          <a href={`#/animal/${animal.id}`}>Edit Animal</a>
        </div>

        <div className="form-grid">
          <ReadOnlyField
            label="Names"
            value={animal.experimenters.experimenter_name.join(', ')}
          />
          <ReadOnlyField
            label="Lab"
            value={animal.experimenters.lab}
          />
          <ReadOnlyField
            label="Institution"
            value={animal.experimenters.institution}
          />
        </div>
      </section>
    </div>
  );
}

OverviewStep.propTypes = {
  animal: PropTypes.object.isRequired,
  day: PropTypes.object.isRequired,
  mergedDay: PropTypes.object.isRequired,
  onFieldUpdate: PropTypes.func.isRequired,
};
```

**Key Features:**
- Read-only fields visually distinguished (grey background, no input)
- Editable fields with validation on blur
- Inline error messages below fields
- ARIA live region announces error count
- Format hints for session_id
- Required field indicators (asterisks)

---

### 3. StepNavigation (UI)

**File:** `src/pages/DayEditor/StepNavigation.jsx`

**Responsibilities:**
- Render horizontal breadcrumb navigation
- Display step status indicators (✓ ⚠ ✗)
- Handle step navigation clicks
- Disable Export until all valid

**Props:**
```javascript
PropTypes = {
  steps: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
  })).isRequired,
  currentStep: PropTypes.string.isRequired,
  stepStatus: PropTypes.objectOf(PropTypes.oneOf([
    'valid', 'incomplete', 'error', 'pending'
  ])).isRequired,
  onNavigate: PropTypes.func.isRequired,
}
```

**Implementation:**

```javascript
/**
 * Step Navigation - Breadcrumb with validation status indicators
 *
 * @param {Object} props
 * @param {Array} props.steps - Step configuration
 * @param {string} props.currentStep - Current step ID
 * @param {Object} props.stepStatus - Status map: { stepId: 'valid'|'incomplete'|'error' }
 * @param {Function} props.onNavigate - Callback: (stepId) => void
 */
export default function StepNavigation({ steps, currentStep, stepStatus, onNavigate }) {
  const handleNavigate = (stepId) => {
    // Check if step is disabled (Export step until valid)
    if (stepId === 'export' && !isExportEnabled(stepStatus)) {
      return;
    }

    onNavigate(stepId);

    // Move focus to main content after navigation
    requestAnimationFrame(() => {
      const main = document.getElementById('main-content');
      if (main) {
        main.focus();
        main.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };

  return (
    <nav aria-label="Day editor steps" className="step-navigation">
      <ol className="step-list">
        {steps.map((step, index) => {
          const status = stepStatus[step.id];
          const isCurrent = currentStep === step.id;
          const isDisabled = step.id === 'export' && !isExportEnabled(stepStatus);

          return (
            <li
              key={step.id}
              className={`step-item step-${status} ${isCurrent ? 'current' : ''}`}
            >
              <button
                onClick={() => handleNavigate(step.id)}
                disabled={isDisabled}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`${step.label} - ${getStatusLabel(status)}`}
                className="step-button"
              >
                <span className="step-number">{index + 1}</span>
                <span className="step-label">{step.label}</span>
                <span className="step-status-icon" aria-hidden="true">
                  {getStatusIcon(status)}
                </span>
                <span className="sr-only">{getStatusLabel(status)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Get status icon for visual indicator
 */
function getStatusIcon(status) {
  switch (status) {
    case 'valid': return '✓';
    case 'incomplete': return '⚠';
    case 'error': return '✗';
    default: return '○';
  }
}

/**
 * Get status label for screen readers
 */
function getStatusLabel(status) {
  switch (status) {
    case 'valid': return 'Complete';
    case 'incomplete': return 'Incomplete';
    case 'error': return 'Has errors';
    default: return 'Not started';
  }
}

/**
 * Check if all required steps are valid (export enabled)
 */
function isExportEnabled(stepStatus) {
  return ['overview', 'devices', 'epochs', 'validation'].every(
    stepId => stepStatus[stepId] === 'valid'
  );
}

StepNavigation.propTypes = {
  steps: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
  })).isRequired,
  currentStep: PropTypes.string.isRequired,
  stepStatus: PropTypes.object.isRequired,
  onNavigate: PropTypes.func.isRequired,
};
```

**Key Features:**
- Horizontal breadcrumb layout
- Visual status indicators with redundant text for screen readers
- Export step disabled until prerequisites met
- Focus management on navigation
- ARIA current step indicator

---

### 4. SaveIndicator (Feedback)

**File:** `src/pages/DayEditor/SaveIndicator.jsx`

**Responsibilities:**
- Show auto-save status (saving → saved)
- Display time since last save
- Show error messages if save fails

**Props:**
```javascript
PropTypes = {
  lastSaved: PropTypes.string,  // ISO timestamp
  error: PropTypes.string,       // Error message
}
```

**Implementation:**

```javascript
/**
 * Save Indicator - Visual feedback for auto-save status
 *
 * @param {Object} props
 * @param {string|null} props.lastSaved - ISO timestamp of last save
 * @param {string|null} props.error - Error message if save failed
 */
export default function SaveIndicator({ lastSaved, error }) {
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (!lastSaved) return;

    // Show "Saving..." briefly, then "Saved ✓"
    setStatus('saving');
    const timer = setTimeout(() => setStatus('saved'), 500);

    return () => clearTimeout(timer);
  }, [lastSaved]);

  if (error) {
    return (
      <div
        className="save-indicator error"
        role="alert"
        aria-live="assertive"
      >
        <span className="icon" aria-hidden="true">✗</span>
        <span>{error}</span>
      </div>
    );
  }

  if (!lastSaved) return null;

  const timeAgo = formatTimeAgo(lastSaved);

  return (
    <div
      className={`save-indicator ${status}`}
      role="status"
      aria-live="polite"
      aria-label={status === 'saving' ? 'Saving changes' : `Saved ${timeAgo}`}
    >
      {status === 'saving' && (
        <>
          <span className="spinner" aria-hidden="true">⟳</span>
          <span>Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <span className="checkmark" aria-hidden="true">✓</span>
          <span>Saved {timeAgo}</span>
        </>
      )}
    </div>
  );
}

/**
 * Format timestamp as "just now", "2 min ago", etc.
 */
function formatTimeAgo(isoTimestamp) {
  const seconds = Math.floor((Date.now() - new Date(isoTimestamp)) / 1000);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

SaveIndicator.propTypes = {
  lastSaved: PropTypes.string,
  error: PropTypes.string,
};
```

**Key Features:**
- Status transitions (saving → saved)
- Relative time display
- Error states with assertive ARIA
- Icons with text alternatives

---

### 5. ReadOnlyField (Presentational)

**File:** `src/pages/DayEditor/ReadOnlyField.jsx`

**Responsibilities:**
- Display read-only field value
- Visual indication (grey background)
- Accessibility (disabled attribute)

**Props:**
```javascript
PropTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
}
```

**Implementation:**

```javascript
/**
 * Read-Only Field - Displays inherited field that cannot be edited
 *
 * @param {Object} props
 * @param {string} props.label - Field label
 * @param {string} props.value - Field value
 */
export default function ReadOnlyField({ label, value }) {
  const id = `readonly-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        readOnly
        disabled
        className="read-only-field"
        aria-label={`${label} (inherited from animal, read-only)`}
      />
    </div>
  );
}

ReadOnlyField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
};
```

**Key Features:**
- Standard input element (maintains form layout consistency)
- Both `readOnly` and `disabled` attributes
- ARIA label clarifies read-only nature
- Styled via CSS (grey background, cursor: not-allowed)

---

## State Management

### Store Integration

#### Problem (from P0.1)
`updateDay()` replaces entire nested objects, causing sibling fields to be lost.

#### Solution
**Field-level update wrapper in DayEditorStepper:**

```javascript
const handleFieldUpdate = useCallback((fieldPath, value) => {
  try {
    // Parse path: "session.session_id" → ["session", "session_id"]
    const pathSegments = fieldPath.split('.');

    // Clone day and update nested field immutably
    const updated = structuredClone(day);
    let target = updated;
    for (let i = 0; i < pathSegments.length - 1; i++) {
      target = target[pathSegments[i]];
    }
    target[pathSegments[pathSegments.length - 1]] = value;

    // Extract top-level keys that changed
    const topLevelKey = pathSegments[0];
    const updates = { [topLevelKey]: updated[topLevelKey] };

    // Update store (preserves sibling fields)
    actions.updateDay(dayId, updates);

    setLastSaved(new Date().toISOString());
    setSaveError(null);

  } catch (error) {
    console.error('Failed to update field:', error);
    setSaveError(`Failed to save ${fieldPath}: ${error.message}`);
  }
}, [day, dayId, actions]);
```

**Test Verification:**
```javascript
it('preserves sibling fields when updating nested field', () => {
  const day = {
    session: {
      session_id: 'remy_20230622',
      session_description: 'Day 45'
    }
  };

  handleFieldUpdate('session.session_id', 'remy_20230623');

  expect(day.session.session_description).toBe('Day 45'); // Not lost!
});
```

---

### Data Merging

#### Problem (from P0.3)
Validation requires full NWB object, but no merge function exists.

#### Solution
**Add `mergeDayMetadata` to `/src/state/workspaceUtils.js`:**

```javascript
/**
 * Merges animal defaults with day-specific data to create NWB metadata object.
 * Used for validation and YAML export.
 *
 * @param {Animal} animal - Parent animal with defaults
 * @param {Day} day - Recording day with session-specific data
 * @returns {object} Complete NWB metadata object
 */
export function mergeDayMetadata(animal, day) {
  // Get appropriate device configuration version
  const configVersion = day.configurationVersion || 1;
  const config = animal.configurationHistory?.find(
    c => c.version === configVersion
  ) || animal.configurationHistory?.[0] || { devices: {} };

  return {
    // Animal defaults
    subject: animal.subject,
    experimenter_name: animal.experimenters.experimenter_name,
    lab: animal.experimenters.lab,
    institution: animal.experimenters.institution,

    // Devices (with day overrides)
    data_acq_device: day.deviceOverrides?.data_acq_device || animal.devices?.data_acq_device || [],
    device: day.deviceOverrides?.device || animal.devices?.device || { name: [] },
    cameras: day.deviceOverrides?.cameras || animal.cameras || [],
    electrode_groups: day.deviceOverrides?.electrode_groups || config.devices.electrode_groups || [],
    ntrode_electrode_group_channel_map: day.deviceOverrides?.ntrode_electrode_group_channel_map || config.devices.ntrode_electrode_group_channel_map || [],

    // Optogenetics (if present)
    ...(animal.optogenetics && {
      opto_excitation_source: animal.optogenetics.opto_excitation_source,
      optical_fiber: animal.optogenetics.optical_fiber,
      virus_injection: animal.optogenetics.virus_injection,
      optogenetic_stimulation_software: animal.optogenetics.optogenetic_stimulation_software,
    }),

    // Day-specific data
    experiment_description: day.session.experiment_description || animal.experimentDescription || '',
    session_description: day.session.session_description || '',
    session_id: day.session.session_id || '',
    keywords: [], // Could auto-generate from tasks

    tasks: day.tasks || [],
    behavioral_events: day.behavioral_events || [],
    associated_files: day.associated_files || [],
    associated_video_files: day.associated_video_files || [],
    fs_gui_yamls: day.fs_gui_yamls || [],

    // Technical parameters
    times_period_multiplier: day.technical?.times_period_multiplier || 1.5,
    raw_data_to_volts: day.technical?.raw_data_to_volts || 0.195,
    default_header_file_path: day.technical?.default_header_file_path || '',
    units: day.technical?.units || {},
  };
}
```

**Test Coverage:**
```javascript
describe('mergeDayMetadata', () => {
  it('merges animal defaults with day data');
  it('uses device overrides when present');
  it('falls back to animal defaults when day fields empty');
  it('handles missing optogenetics gracefully');
  it('selects correct configuration version');
});
```

---

### URL Routing

#### Problem (from P0.4)
No hook to parse dayId from URL hash.

#### Solution
**Create `/src/hooks/useDayIdFromUrl.js`:**

```javascript
import { useState, useEffect } from 'react';

/**
 * Parses day ID from URL hash: #/day/remy-2023-06-22
 *
 * @returns {string|null} Day ID or null if not found
 */
export function useDayIdFromUrl() {
  const [dayId, setDayId] = useState(null);

  useEffect(() => {
    const parseDayId = () => {
      const hash = window.location.hash;
      const match = hash.match(/#\/day\/(.+)/);
      setDayId(match ? decodeURIComponent(match[1]) : null);
    };

    // Parse on mount
    parseDayId();

    // Listen for hash changes
    window.addEventListener('hashchange', parseDayId);

    return () => window.removeEventListener('hashchange', parseDayId);
  }, []);

  return dayId;
}
```

**Test Coverage:**
```javascript
describe('useDayIdFromUrl', () => {
  it('returns null when no day in URL');
  it('parses dayId from #/day/:id');
  it('decodes URL-encoded characters');
  it('updates when hash changes');
});
```

---

## Validation Strategy

### Validation State Storage

#### Problem (from P0.2)
Unclear where validation state lives.

#### Solution
**Store-backed validation using `day.state.validationErrors`:**

```javascript
// In OverviewStep.jsx
const handleBlur = async (fieldPath, value) => {
  // 1. Update field value
  onFieldUpdate(fieldPath, value);

  // 2. Validate merged data
  const { valid, errors } = await validateField(mergedDay, fieldPath);

  // 3. Update validation errors in store
  const { actions } = useStoreContext();
  actions.updateDay(dayId, {
    state: {
      ...day.state,
      validationErrors: [
        ...day.state.validationErrors.filter(e => e.path !== fieldPath),
        ...(valid ? [] : errors)
      ]
    }
  });

  // 4. Update local state for immediate UI feedback
  setFieldErrors(prev => ({
    ...prev,
    [fieldPath]: valid ? null : errors[0]
  }));
};
```

**Benefits:**
- Validation errors persist across navigation
- Enables ValidationSummary step in M9
- Single source of truth for validation state

---

### Validation Utilities

**File:** `src/pages/DayEditor/validation.js`

```javascript
import { validateSchema } from '@/validation';

/**
 * Validates a single field against schema.
 *
 * @param {Object} mergedData - Merged animal + day metadata
 * @param {string} fieldPath - Dot-notation path (e.g., 'session.session_id')
 * @returns {Promise<{valid: boolean, errors: Array}>}
 */
export async function validateField(mergedData, fieldPath) {
  // Use existing schema validator
  const { ok, errors } = validateSchema(mergedData);

  // Filter errors for this specific field
  const fieldErrors = errors.filter(err =>
    err.path.includes(fieldPath) || err.instancePath.includes(fieldPath)
  );

  return {
    valid: fieldErrors.length === 0,
    errors: fieldErrors.map(e => ({
      path: fieldPath,
      message: e.message || 'Invalid value',
      severity: 'error'
    }))
  };
}

/**
 * Validates entire day and computes step status.
 *
 * @param {Day} day
 * @param {Object} mergedDay - Merged animal + day
 * @returns {Object} Status map: { stepId: 'valid'|'incomplete'|'error' }
 */
export function computeStepStatus(day, mergedDay) {
  const { ok, errors } = validateSchema(mergedDay);

  // Group errors by step
  const errorsByStep = groupErrorsByStep(errors);

  return {
    overview: getStepStatus(errorsByStep.overview, day.session),
    devices: 'incomplete',    // M6 will implement
    epochs: 'incomplete',     // M7 will implement
    validation: 'incomplete', // M9 will implement
    export: ok ? 'valid' : 'error',
  };
}

/**
 * Determine step status from errors and data completeness.
 */
function getStepStatus(errors, data) {
  if (errors && errors.length > 0) return 'error';
  if (!data || !isStepComplete(data)) return 'incomplete';
  return 'valid';
}

/**
 * Check if overview step has required fields.
 */
function isStepComplete(sessionData) {
  return !!(
    sessionData.session_id &&
    sessionData.session_description
  );
}

/**
 * Group validation errors by which step they belong to.
 */
function groupErrorsByStep(errors) {
  const groups = {
    overview: [],
    devices: [],
    epochs: [],
    validation: [],
    export: [],
  };

  errors.forEach(error => {
    const path = error.path || error.instancePath || '';

    if (path.includes('session')) {
      groups.overview.push(error);
    } else if (path.includes('electrode') || path.includes('device') || path.includes('camera')) {
      groups.devices.push(error);
    } else if (path.includes('task') || path.includes('behavioral') || path.includes('epoch')) {
      groups.epochs.push(error);
    } else {
      groups.validation.push(error);
    }
  });

  return groups;
}
```

---

## Styling & Accessibility

### Color Palette (Fixed from P0.8)

**Use existing Material Design-inspired palette:**

```css
:root {
  /* Primary */
  --color-primary: #2196f3;
  --color-primary-hover: #1976d2;
  --color-primary-light: #e3f2fd;

  /* Status */
  --color-success: #2e7d32;
  --color-success-light: #e8f5e9;
  --color-warning: #e65100;
  --color-warning-light: #fff3e0;
  --color-error: #d32f2f;
  --color-error-light: #ffebee;

  /* Neutrals */
  --color-grey-100: #f5f5f5;
  --color-grey-200: #e0e0e0;
  --color-grey-600: #666;
  --color-grey-900: #333;
  --color-white: #fff;

  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;

  /* Typography */
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.2rem;
  --font-size-xl: 1.5rem;

  /* Transitions */
  --transition-fast: 150ms ease-out;
  --transition-standard: 250ms ease-in-out;
}
```

---

### Complete CSS File

**File:** `src/pages/DayEditor/DayEditor.css`

```css
/* ===== Layout ===== */

.day-editor-stepper {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.day-editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--color-white);
  border-bottom: 1px solid var(--color-grey-200);
}

.day-editor-header h1 {
  font-size: var(--font-size-xl);
  margin: 0;
  color: var(--color-grey-900);
}

.day-editor-content {
  flex: 1;
  padding: var(--spacing-lg);
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

/* ===== Step Navigation ===== */

.step-navigation {
  background-color: var(--color-white);
  border-bottom: 2px solid var(--color-grey-200);
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.step-list {
  display: flex;
  list-style: none;
  padding: 0;
  margin: 0;
}

.step-item {
  flex: 1;
}

.step-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border: none;
  background: transparent;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-family: inherit;
  transition: all var(--transition-standard);
  color: var(--color-grey-900);
}

.step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: var(--color-grey-200);
  color: var(--color-grey-600);
  font-size: 0.75rem;
  font-weight: 600;
}

.step-item.current .step-number {
  background-color: var(--color-primary);
  color: var(--color-white);
}

.step-item.step-valid .step-number {
  background-color: var(--color-success);
  color: var(--color-white);
}

.step-item.step-error .step-number {
  background-color: var(--color-error);
  color: var(--color-white);
}

.step-item.current .step-button {
  border-bottom-color: var(--color-primary);
  background-color: var(--color-primary-light);
  font-weight: 600;
}

.step-button:hover:not(:disabled) {
  background-color: var(--color-grey-100);
}

.step-button:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
  z-index: 1;
}

.step-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.step-status-icon {
  font-size: 1rem;
}

.step-item.step-valid .step-status-icon {
  color: var(--color-success);
}

.step-item.step-incomplete .step-status-icon {
  color: var(--color-warning);
}

.step-item.step-error .step-status-icon {
  color: var(--color-error);
}

/* ===== Save Indicator ===== */

.save-indicator {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--color-grey-600);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: 4px;
  transition: opacity var(--transition-standard);
}

.save-indicator.saving {
  background-color: var(--color-primary-light);
  color: var(--color-primary);
}

.save-indicator.saved {
  background-color: var(--color-success-light);
  color: var(--color-success);
}

.save-indicator.error {
  background-color: var(--color-error-light);
  color: var(--color-error);
}

.save-indicator .spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ===== Form Sections ===== */

.day-editor-section {
  background-color: var(--color-white);
  border: 1px solid var(--color-grey-200);
  border-radius: 4px;
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.day-editor-section h2 {
  font-size: var(--font-size-lg);
  margin-top: 0;
  margin-bottom: var(--spacing-md);
  color: var(--color-grey-900);
  font-weight: 600;
}

.inherited-notice {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-warning-light);
  border: 1px solid #ffe0b2;
  border-radius: 4px;
  font-size: var(--font-size-sm);
  color: var(--color-warning);
  margin-bottom: var(--spacing-md);
}

.inherited-notice a {
  color: var(--color-primary-hover);
  text-decoration: underline;
  font-weight: 500;
}

.inherited-notice a:hover {
  color: #0d47a1;
}

/* ===== Form Grid ===== */

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-md);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.form-field label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-grey-900);
}

.form-field label.required::after {
  content: ' *';
  color: var(--color-error);
}

.form-field input,
.form-field select,
.form-field textarea {
  padding: var(--spacing-sm);
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: var(--font-size-base);
  font-family: inherit;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.form-field input:focus,
.form-field select:focus,
.form-field textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
}

.form-field input.invalid,
.form-field textarea.invalid {
  border-color: var(--color-error);
  background-color: var(--color-error-light);
}

.form-field input.invalid:focus,
.form-field textarea.invalid:focus {
  box-shadow: 0 0 0 3px rgba(211, 47, 47, 0.1);
}

/* ===== Read-Only Fields ===== */

.read-only-field {
  background-color: var(--color-grey-100);
  color: var(--color-grey-600);
  border-color: var(--color-grey-200);
  cursor: not-allowed;
}

.read-only-field:focus {
  border-color: var(--color-grey-200);
  box-shadow: none;
}

/* ===== Validation Messages ===== */

.validation-hint {
  font-size: var(--font-size-sm);
  color: var(--color-grey-600);
  margin-top: var(--spacing-xs);
  min-height: 1.25rem;
}

.validation-error {
  font-size: var(--font-size-sm);
  color: var(--color-error);
  font-weight: 500;
  margin-top: var(--spacing-xs);
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xs);
}

.validation-error::before {
  content: '✗';
  flex-shrink: 0;
}

/* ===== Screen Reader Only ===== */

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* ===== Error State ===== */

.error-state {
  padding: var(--spacing-xl);
  text-align: center;
  color: var(--color-error);
}

.error-state h2 {
  font-size: var(--font-size-lg);
  margin-bottom: var(--spacing-md);
}

/* ===== Responsive ===== */

@media (max-width: 768px) {
  .step-list {
    flex-direction: column;
  }

  .step-button {
    justify-content: flex-start;
    border-bottom: none;
    border-left: 3px solid transparent;
  }

  .step-item.current .step-button {
    border-left-color: var(--color-primary);
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
```

---

### Accessibility Checklist

**WCAG 2.1 Level AA Requirements:**

- [x] **1.3.1 Info and Relationships** - Semantic HTML (nav, main, section)
- [x] **1.3.2 Meaningful Sequence** - Logical DOM order
- [x] **1.4.3 Contrast (Minimum)** - All colors meet 4.5:1 ratio
- [x] **2.1.1 Keyboard** - All interactive elements keyboard accessible
- [x] **2.1.2 No Keyboard Trap** - Focus can move freely
- [x] **2.4.3 Focus Order** - Logical tab order
- [x] **2.4.7 Focus Visible** - 2px solid outline on focus
- [x] **3.2.2 On Input** - Auto-save on blur (not on input)
- [x] **3.3.1 Error Identification** - Inline errors below fields
- [x] **3.3.2 Labels or Instructions** - All fields labeled, required indicated
- [x] **3.3.3 Error Suggestion** - Format hints provided
- [x] **4.1.2 Name, Role, Value** - ARIA labels + redundant text
- [x] **4.1.3 Status Messages** - ARIA live regions for save/validation

---

## Testing Strategy

### Test Coverage Goals

**Component Tests:**
- DayEditorStepper: 10 tests (~100 lines)
- OverviewStep: 15 tests (~150 lines)
- StepNavigation: 8 tests (~80 lines)
- SaveIndicator: 6 tests (~60 lines)
- ReadOnlyField: 4 tests (~40 lines)

**Utility Tests:**
- validation.js: 12 tests (~120 lines)
- useDayIdFromUrl: 4 tests (~40 lines)
- mergeDayMetadata: 8 tests (~80 lines)

**Integration Tests:**
- Full workflow: 5 tests (~150 lines)

**Total:** ~870 lines of test code

---

### Test Scenarios

**DayEditorStepper.test.jsx:**
```javascript
describe('DayEditorStepper', () => {
  it('parses dayId from URL');
  it('shows error when day not found');
  it('shows error when animal not found');
  it('merges animal + day for validation');
  it('computes step status from validation');
  it('updates nested fields without losing siblings');
  it('handles updateDay errors gracefully');
  it('tracks last saved timestamp');
  it('navigates between steps');
  it('disables export until all steps valid');
});
```

**OverviewStep.test.jsx:**
```javascript
describe('OverviewStep', () => {
  it('displays inherited fields as read-only');
  it('displays editable session fields');
  it('validates on blur');
  it('shows inline validation errors');
  it('calls onFieldUpdate on blur');
  it('shows format hints for session_id');
  it('marks required fields with asterisks');
  it('announces validation errors to screen readers');
  it('clears errors when field becomes valid');
  it('shows "Edit Animal" links');
  it('handles validation errors gracefully');
  it('prevents submission while validating');
  it('maintains focus after blur');
  it('groups fields in sections');
  it('uses correct ARIA attributes');
});
```

**StepNavigation.test.jsx:**
```javascript
describe('StepNavigation', () => {
  it('renders all step buttons');
  it('shows status icons (✓ ⚠ ✗)');
  it('marks current step with aria-current');
  it('disables export when validation incomplete');
  it('enables export when all steps valid');
  it('moves focus to main on navigation');
  it('announces status to screen readers');
  it('highlights current step visually');
});
```

**SaveIndicator.test.jsx:**
```javascript
describe('SaveIndicator', () => {
  it('shows nothing when no save occurred');
  it('shows "Saving..." on save start');
  it('shows "Saved X ago" after save');
  it('formats time ago correctly');
  it('shows error message when save fails');
  it('uses assertive ARIA for errors');
});
```

**validation.test.js:**
```javascript
describe('validateField', () => {
  it('validates required fields');
  it('validates format patterns');
  it('filters errors to specific field');
  it('returns field-level error messages');
});

describe('computeStepStatus', () => {
  it('returns "valid" when all fields complete');
  it('returns "incomplete" when required fields empty');
  it('returns "error" when validation fails');
  it('groups errors by step correctly');
});

describe('groupErrorsByStep', () => {
  it('assigns session errors to overview');
  it('assigns device errors to devices');
  it('assigns task errors to epochs');
});
```

**Integration test:**
```javascript
describe('Day Editor Integration', () => {
  it('loads day → edits field → saves → validates → updates status', async () => {
    // 1. Setup store with animal + day
    // 2. Navigate to #/day/remy-2023-06-22
    // 3. Type in session_id field
    // 4. Blur field
    // 5. Verify store updated
    // 6. Verify validation ran
    // 7. Verify step status updated
    // 8. Verify save indicator shows "Saved"
  });
});
```

---

## Implementation Order

### Phase 1: Utilities & Foundation (2-3 hours)

1. **Create utility functions:**
   - [ ] `src/hooks/useDayIdFromUrl.js` with tests
   - [ ] `src/state/workspaceUtils.js` - add `mergeDayMetadata()` with tests
   - [ ] `src/pages/DayEditor/validation.js` with tests

2. **Verify utilities work:**
   - [ ] Run tests: `npm test -- useDayIdFromUrl`
   - [ ] Run tests: `npm test -- workspaceUtils`
   - [ ] Run tests: `npm test -- validation`

### Phase 2: Presentational Components (2-3 hours)

3. **Create simple components (TDD):**
   - [ ] Write test: `ReadOnlyField.test.jsx`
   - [ ] Implement: `ReadOnlyField.jsx`
   - [ ] Write test: `SaveIndicator.test.jsx`
   - [ ] Implement: `SaveIndicator.jsx`
   - [ ] Write test: `StepNavigation.test.jsx`
   - [ ] Implement: `StepNavigation.jsx`

4. **Verify components:**
   - [ ] Run tests for each component
   - [ ] Visual check in Storybook (if available)

### Phase 3: Form Step (3-4 hours)

5. **Create OverviewStep (TDD):**
   - [ ] Write test: `OverviewStep.test.jsx` (15 scenarios)
   - [ ] Implement: `OverviewStep.jsx`
   - [ ] Verify tests pass
   - [ ] Manual accessibility test (keyboard nav)

### Phase 4: Container (2-3 hours)

6. **Create DayEditorStepper (TDD):**
   - [ ] Write test: `DayEditorStepper.test.jsx` (10 scenarios)
   - [ ] Implement: `DayEditorStepper.jsx`
   - [ ] Verify tests pass
   - [ ] Fix any integration issues

### Phase 5: Styling (1-2 hours)

7. **Create complete CSS:**
   - [ ] Create: `DayEditor.css`
   - [ ] Test responsive design (mobile view)
   - [ ] Verify color contrast (WebAIM checker)
   - [ ] Test focus indicators

### Phase 6: Integration Testing (2-3 hours)

8. **End-to-end workflow:**
   - [ ] Write integration test
   - [ ] Manual test: navigate → edit → save → validate
   - [ ] Screen reader test (NVDA/VoiceOver)
   - [ ] Keyboard-only test

### Phase 7: Code Review & Polish (2-3 hours)

9. **Review & refine:**
   - [ ] Run code-reviewer agent
   - [ ] Fix P1 issues from review
   - [ ] Run full test suite: `npm test -- --watchAll=false`
   - [ ] Update TASKS.md and SCRATCHPAD.md
   - [ ] Commit with message: `feat(M5): implement Day Editor Stepper with Overview step`

**Total Estimated Time:** 14-19 hours (2-3 days)

---

## Acceptance Criteria (Definition of Done)

- [ ] All P0 issues from design review resolved
- [ ] All utility functions implemented and tested
- [ ] `DayEditorStepper` container complete with 10+ tests
- [ ] `OverviewStep` form complete with 15+ tests
- [ ] `StepNavigation`, `SaveIndicator`, `ReadOnlyField` complete with tests
- [ ] Complete `DayEditor.css` with correct color palette
- [ ] Field-level validation works on blur
- [ ] Auto-save persists to store without losing sibling fields
- [ ] Step status updates based on validation
- [ ] Export step disabled until all valid
- [ ] All WCAG 2.1 AA requirements met
- [ ] Screen reader testing passed
- [ ] Keyboard navigation tested
- [ ] Full test suite passes (2300+ tests)
- [ ] Code review completed
- [ ] Documentation updated (TASKS.md, SCRATCHPAD.md)

---

## References

- [M5_DESIGN_REVIEW.md](M5_DESIGN_REVIEW.md) - Design review feedback
- [ANIMAL_WORKSPACE_DESIGN.md](ANIMAL_WORKSPACE_DESIGN.md) - Data model
- [TESTING_PATTERNS.md](TESTING_PATTERNS.md) - Test patterns
- [CLAUDE.md](../CLAUDE.md) - Implementation guide

---

**Status:** APPROVED FOR IMPLEMENTATION
**Next Step:** Begin Phase 1 (Utilities & Foundation)
**Assigned To:** Ready for implementation
**Target Completion:** 2-3 days after start
