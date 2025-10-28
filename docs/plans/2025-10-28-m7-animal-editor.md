# M7 Animal Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Implement Animal Editor for configuring electrode groups and channel maps at animal level, enabling guided 2-step workflow with copy/template functionality and progressive disclosure for high-density probes.

**Architecture:** 2-step stepper pattern (ElectrodeGroupsStep → ChannelMapsStep) following established DayEditor patterns. Progressive disclosure for channel maps (summary → customize → CSV) to handle 128+ channel configurations efficiently. Reuses StepNavigation, SaveIndicator, and existing form components.

**Tech Stack:** React 18, Vitest, PropTypes, Material Design CSS, existing workspace store

**Design Document:** `docs/M7_ANIMAL_EDITOR_DESIGN.md`

---

## Prerequisites

- [x] Environment setup complete (`/setup` command run)
- [x] All existing tests passing (2447 tests)
- [x] Design document reviewed and approved
- [x] Working in `modern` branch (no worktree needed)

---

## Phase 1: Core Infrastructure (8-10 hours)

### Task 1.1: Create useAnimalIdFromUrl Hook

**Files:**

- Create: `src/hooks/useAnimalIdFromUrl.js`
- Create: `src/hooks/__tests__/useAnimalIdFromUrl.test.js`

**Step 1: Write the failing test**

Create test file:

```javascript
// src/hooks/__tests__/useAnimalIdFromUrl.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnimalIdFromUrl } from '../useAnimalIdFromUrl';

describe('useAnimalIdFromUrl', () => {
  let originalHash;

  beforeEach(() => {
    originalHash = window.location.hash;
  });

  afterEach(() => {
    window.location.hash = originalHash;
  });

  it('extracts animal ID from #/animal/:id/editor route', () => {
    window.location.hash = '#/animal/remy/editor';
    const { result } = renderHook(() => useAnimalIdFromUrl());
    expect(result.current).toBe('remy');
  });

  it('extracts animal ID with hyphens', () => {
    window.location.hash = '#/animal/bean-whiskey/editor';
    const { result } = renderHook(() => useAnimalIdFromUrl());
    expect(result.current).toBe('bean-whiskey');
  });

  it('returns null for non-animal-editor routes', () => {
    window.location.hash = '#/workspace';
    const { result } = renderHook(() => useAnimalIdFromUrl());
    expect(result.current).toBeNull();
  });

  it('returns null for malformed routes', () => {
    window.location.hash = '#/animal/';
    const { result } = renderHook(() => useAnimalIdFromUrl());
    expect(result.current).toBeNull();
  });

  it('handles URL with query parameters', () => {
    window.location.hash = '#/animal/remy/editor?step=groups';
    const { result } = renderHook(() => useAnimalIdFromUrl());
    expect(result.current).toBe('remy');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/hooks/__tests__/useAnimalIdFromUrl.test.js
```

Expected: FAIL with "Cannot find module '../useAnimalIdFromUrl'"

**Step 3: Write minimal implementation**

```javascript
// src/hooks/useAnimalIdFromUrl.js
import { useState, useEffect } from 'react';

/**
 * Custom hook to extract animal ID from URL hash
 *
 * Parses routes like #/animal/:id/editor to extract the animal ID.
 * Returns null if route doesn't match or ID is invalid.
 *
 * @returns {string|null} Animal ID from URL, or null if not found
 *
 * @example
 * // URL: #/animal/remy/editor
 * const animalId = useAnimalIdFromUrl(); // "remy"
 *
 * @example
 * // URL: #/workspace
 * const animalId = useAnimalIdFromUrl(); // null
 */
export function useAnimalIdFromUrl() {
  const [animalId, setAnimalId] = useState(null);

  useEffect(() => {
    function parseAnimalId() {
      // Get hash without #
      const hash = window.location.hash.slice(1);

      // Strip query parameters
      const path = hash.split('?')[0];

      // Match pattern: /animal/:id/editor
      const match = path.match(/^\/animal\/([^/]+)\/editor$/);

      if (match && match[1]) {
        setAnimalId(match[1]);
      } else {
        setAnimalId(null);
      }
    }

    // Parse on mount
    parseAnimalId();

    // Listen for hash changes
    window.addEventListener('hashchange', parseAnimalId);

    return () => {
      window.removeEventListener('hashchange', parseAnimalId);
    };
  }, []);

  return animalId;
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- src/hooks/__tests__/useAnimalIdFromUrl.test.js
```

Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/hooks/useAnimalIdFromUrl.js src/hooks/__tests__/useAnimalIdFromUrl.test.js
git commit -m "feat(M7): add useAnimalIdFromUrl hook for animal editor routing"
```

---

### Task 1.2: Add Animal Editor Route to Hash Router

**Files:**

- Modify: `src/hooks/useHashRouter.js`
- Modify: `src/hooks/__tests__/useHashRouter.test.js`

**Step 1: Write the failing test**

Add to existing test file:

```javascript
// Add to src/hooks/__tests__/useHashRouter.test.js

it('parses #/animal/:id/editor route', () => {
  window.location.hash = '#/animal/remy/editor';
  const { result } = renderHook(() => useHashRouter());

  expect(result.current.view).toBe('animal-editor');
  expect(result.current.params.animalId).toBe('remy');
});

it('parses animal editor route with query params', () => {
  window.location.hash = '#/animal/bean/editor?step=groups';
  const { result } = renderHook(() => useHashRouter());

  expect(result.current.view).toBe('animal-editor');
  expect(result.current.params.animalId).toBe('bean');
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/hooks/__tests__/useHashRouter.test.js
```

Expected: FAIL (view !== 'animal-editor')

**Step 3: Update hash router implementation**

```javascript
// In src/hooks/useHashRouter.js, update parseHashRoute function

function parseHashRoute(hash) {
  // ... existing code ...

  // Strip query parameters before matching
  const pathWithoutQuery = cleanHash.split('?')[0];

  // Match /animal/:id/editor
  const animalEditorMatch = pathWithoutQuery.match(/^\/animal\/([^/]+)\/editor$/);
  if (animalEditorMatch) {
    return {
      view: 'animal-editor',
      params: { animalId: animalEditorMatch[1] }
    };
  }

  // ... rest of existing route matching ...
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- src/hooks/__tests__/useHashRouter.test.js
```

Expected: PASS (all tests including 2 new)

**Step 5: Commit**

```bash
git add src/hooks/useHashRouter.js src/hooks/__tests__/useHashRouter.test.js
git commit -m "feat(M7): add animal editor route to hash router"
```

---

### Task 1.3: Create AnimalEditor Page Entry Point

**Files:**

- Create: `src/pages/AnimalEditor/index.jsx`

**Step 1: Write the failing test**

```javascript
// src/pages/AnimalEditor/__tests__/index.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StoreContext } from '../../../state/StoreContext';
import AnimalEditor from '../index';

// Mock the stepper component (we'll implement it in next task)
vi.mock('../AnimalEditorStepper', () => ({
  default: () => <div data-testid="animal-editor-stepper">Stepper</div>
}));

describe('AnimalEditor', () => {
  const mockModel = {
    workspace: {
      animals: {
        remy: {
          id: 'remy',
          subject: { subject_id: 'remy' },
          devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] },
          days: []
        }
      },
      days: {}
    }
  };

  const mockActions = {};
  const mockSelectors = {};

  function renderWithStore(component) {
    return render(
      <StoreContext.Provider value={{ model: mockModel, actions: mockActions, selectors: mockSelectors }}>
        {component}
      </StoreContext.Provider>
    );
  }

  it('renders main landmark with proper aria-label', () => {
    renderWithStore(<AnimalEditor />);
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-labelledby', 'animal-editor-heading');
  });

  it('renders stepper component', () => {
    renderWithStore(<AnimalEditor />);
    expect(screen.getByTestId('animal-editor-stepper')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/pages/AnimalEditor/__tests__/index.test.jsx
```

Expected: FAIL with "Cannot find module '../index'"

**Step 3: Write minimal implementation**

```javascript
// src/pages/AnimalEditor/index.jsx
import React from 'react';
import AnimalEditorStepper from './AnimalEditorStepper';

/**
 * AnimalEditor - Entry point for animal-level device configuration
 *
 * Route: #/animal/:id/editor
 *
 * Provides interface for:
 * - Electrode groups configuration (device type, location, coordinates)
 * - Channel maps editing (logical → hardware channel mapping)
 * - Copy/template from existing animals
 *
 * @returns {JSX.Element}
 */
export default function AnimalEditor() {
  return (
    <main
      id="main-content"
      role="main"
      aria-labelledby="animal-editor-heading"
      tabIndex="-1"
    >
      <AnimalEditorStepper />
    </main>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- src/pages/AnimalEditor/__tests__/index.test.jsx
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/pages/AnimalEditor/index.jsx src/pages/AnimalEditor/__tests__/index.test.jsx
git commit -m "feat(M7): add AnimalEditor page entry point"
```

---

### Task 1.4: Create AnimalEditorStepper Container (Basic Structure)

**Files:**

- Create: `src/pages/AnimalEditor/AnimalEditorStepper.jsx`
- Create: `src/pages/AnimalEditor/__tests__/AnimalEditorStepper.test.jsx`

**Step 1: Write the failing test**

```javascript
// src/pages/AnimalEditor/__tests__/AnimalEditorStepper.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StoreContext } from '../../../state/StoreContext';
import AnimalEditorStepper from '../AnimalEditorStepper';

// Mock hooks
vi.mock('../../../hooks/useAnimalIdFromUrl', () => ({
  useAnimalIdFromUrl: () => 'remy'
}));

describe('AnimalEditorStepper', () => {
  const mockModel = {
    workspace: {
      animals: {
        remy: {
          id: 'remy',
          subject: { subject_id: 'remy' },
          devices: {
            electrode_groups: [],
            ntrode_electrode_group_channel_map: []
          },
          days: []
        }
      },
      days: {}
    }
  };

  const mockActions = {
    updateAnimal: vi.fn()
  };

  const mockSelectors = {};

  function renderWithStore(component) {
    return render(
      <StoreContext.Provider value={{ model: mockModel, actions: mockActions, selectors: mockSelectors }}>
        {component}
      </StoreContext.Provider>
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders heading with animal ID', () => {
    renderWithStore(<AnimalEditorStepper />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Animal Editor: remy');
  });

  it('renders step navigation', () => {
    renderWithStore(<AnimalEditorStepper />);
    expect(screen.getByText('Electrode Groups')).toBeInTheDocument();
    expect(screen.getByText('Channel Maps')).toBeInTheDocument();
  });

  it('renders save indicator', () => {
    renderWithStore(<AnimalEditorStepper />);
    // SaveIndicator will be in the DOM
    expect(screen.getByText(/saved|saving/i)).toBeInTheDocument();
  });

  it('starts on step 1 (electrode groups)', () => {
    renderWithStore(<AnimalEditorStepper />);
    expect(screen.getByText('Step 1: Electrode Groups')).toBeInTheDocument();
  });

  it('shows error state when animal not found', () => {
    const emptyModel = { workspace: { animals: {}, days: {} } };
    render(
      <StoreContext.Provider value={{ model: emptyModel, actions: mockActions, selectors: mockSelectors }}>
        <AnimalEditorStepper />
      </StoreContext.Provider>
    );
    expect(screen.getByText(/Animal not found/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/pages/AnimalEditor/__tests__/AnimalEditorStepper.test.jsx
```

Expected: FAIL with "Cannot find module '../AnimalEditorStepper'"

**Step 3: Write minimal implementation**

```javascript
// src/pages/AnimalEditor/AnimalEditorStepper.jsx
import { useState, useCallback, useMemo } from 'react';
import { useStoreContext } from '../../state/StoreContext';
import { useAnimalIdFromUrl } from '../../hooks/useAnimalIdFromUrl';
import StepNavigation from '../DayEditor/StepNavigation';
import SaveIndicator from '../DayEditor/SaveIndicator';
import ErrorState from '../DayEditor/ErrorState';

/**
 * AnimalEditorStepper - Container for multi-step animal configuration
 *
 * Manages 2-step workflow:
 * 1. Electrode Groups - CRUD for electrode groups
 * 2. Channel Maps - Configure channel mappings
 *
 * @returns {JSX.Element}
 */
export default function AnimalEditorStepper() {
  const { model, actions } = useStoreContext();
  const animalId = useAnimalIdFromUrl();
  const [currentStep, setCurrentStep] = useState('groups');
  const [lastSaved, setLastSaved] = useState(null);
  const [saveError, setSaveError] = useState(null);

  // Get animal from store
  const animal = model.workspace?.animals?.[animalId];

  // Error state if animal not found
  if (!animal) {
    return (
      <ErrorState
        title="Animal Not Found"
        message={`Animal with ID "${animalId}" does not exist.`}
        actionLabel="Back to Workspace"
        actionHref="#/workspace"
      />
    );
  }

  // Compute step status (placeholder - will implement validation later)
  const stepStatus = useMemo(() => {
    return {
      groups: 'incomplete',
      channelMaps: 'incomplete'
    };
  }, [animal]);

  // Field update handler (placeholder)
  const handleFieldUpdate = useCallback((fieldPath, value) => {
    // TODO: Implement in next task
  }, [animalId, actions]);

  const steps = [
    { id: 'groups', label: 'Electrode Groups', status: stepStatus.groups },
    { id: 'channelMaps', label: 'Channel Maps', status: stepStatus.channelMaps }
  ];

  return (
    <div className="animal-editor-stepper">
      <header className="editor-header">
        <h1 id="animal-editor-heading">Animal Editor: {animal.id}</h1>
        <SaveIndicator lastSaved={lastSaved} error={saveError} />
      </header>

      <StepNavigation
        steps={steps}
        currentStep={currentStep}
        onStepClick={setCurrentStep}
      />

      {currentStep === 'groups' && (
        <div>Step 1: Electrode Groups (stub)</div>
      )}

      {currentStep === 'channelMaps' && (
        <div>Step 2: Channel Maps (stub)</div>
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- src/pages/AnimalEditor/__tests__/AnimalEditorStepper.test.jsx
```

Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/pages/AnimalEditor/AnimalEditorStepper.jsx src/pages/AnimalEditor/__tests__/AnimalEditorStepper.test.jsx
git commit -m "feat(M7): add AnimalEditorStepper container with basic structure"
```

---

### Task 1.5: Integrate Animal Editor into AppLayout Router

**Files:**

- Modify: `src/layouts/AppLayout.jsx`
- Modify: `src/layouts/__tests__/AppLayout.test.jsx`

**Step 1: Write the failing test**

Add to existing AppLayout test file:

```javascript
// Add to src/layouts/__tests__/AppLayout.test.jsx

it('renders AnimalEditor for #/animal/:id/editor route', () => {
  window.location.hash = '#/animal/remy/editor';

  render(
    <StoreContext.Provider value={{ model: mockModel, actions: mockActions, selectors: mockSelectors }}>
      <AppLayout />
    </StoreContext.Provider>
  );

  expect(screen.getByText(/Animal Editor:/)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/layouts/__tests__/AppLayout.test.jsx
```

Expected: FAIL (AnimalEditor not rendered)

**Step 3: Update AppLayout to include animal editor route**

```javascript
// In src/layouts/AppLayout.jsx

import AnimalEditor from '../pages/AnimalEditor';

// ... inside render function ...

// Add to view rendering logic
{view === 'animal-editor' && <AnimalEditor />}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- src/layouts/__tests__/AppLayout.test.jsx
```

Expected: PASS (all tests including new one)

**Step 5: Commit**

```bash
git add src/layouts/AppLayout.jsx src/layouts/__tests__/AppLayout.test.jsx
git commit -m "feat(M7): integrate animal editor into app router"
```

---

## Phase 2: Step 1 - Electrode Groups (12-14 hours)

### Task 2.1: Create ElectrodeGroupsStep Component (Table View)

**Files:**

- Create: `src/pages/AnimalEditor/ElectrodeGroupsStep.jsx`
- Create: `src/pages/AnimalEditor/__tests__/ElectrodeGroupsStep.test.jsx`

**Step 1: Write the failing test**

```javascript
// src/pages/AnimalEditor/__tests__/ElectrodeGroupsStep.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ElectrodeGroupsStep from '../ElectrodeGroupsStep';

describe('ElectrodeGroupsStep', () => {
  const mockAnimal = {
    id: 'remy',
    devices: {
      electrode_groups: [
        { id: 0, device_type: 'tetrode_12.5', location: 'CA1', targeted_x: 2.6, targeted_y: -3.8, targeted_z: 0, units: 'mm' },
        { id: 1, device_type: 'tetrode_12.5', location: 'CA3', targeted_x: 2.8, targeted_y: -3.6, targeted_z: 0, units: 'mm' }
      ],
      ntrode_electrode_group_channel_map: []
    }
  };

  const mockOnFieldUpdate = vi.fn();

  it('renders table with electrode groups', () => {
    render(<ElectrodeGroupsStep animal={mockAnimal} onFieldUpdate={mockOnFieldUpdate} />);

    expect(screen.getByText('CA1')).toBeInTheDocument();
    expect(screen.getByText('CA3')).toBeInTheDocument();
  });

  it('shows correct device type for each group', () => {
    render(<ElectrodeGroupsStep animal={mockAnimal} onFieldUpdate={mockOnFieldUpdate} />);

    const rows = screen.getAllByText('tetrode_12.5');
    expect(rows).toHaveLength(2);
  });

  it('shows channel count based on device type', () => {
    render(<ElectrodeGroupsStep animal={mockAnimal} onFieldUpdate={mockOnFieldUpdate} />);

    // tetrode_12.5 has 4 channels
    const channelCounts = screen.getAllByText('4');
    expect(channelCounts.length).toBeGreaterThan(0);
  });

  it('shows status badge for each group', () => {
    render(<ElectrodeGroupsStep animal={mockAnimal} onFieldUpdate={mockOnFieldUpdate} />);

    // Both groups should have required fields
    const badges = screen.getAllByText(/✓|⚠|❌/);
    expect(badges.length).toBeGreaterThan(0);
  });

  it('renders "Add Electrode Group" button', () => {
    render(<ElectrodeGroupsStep animal={mockAnimal} onFieldUpdate={mockOnFieldUpdate} />);

    expect(screen.getByText(/Add Electrode Group/)).toBeInTheDocument();
  });

  it('renders "Copy from Animal" button', () => {
    render(<ElectrodeGroupsStep animal={mockAnimal} onFieldUpdate={mockOnFieldUpdate} />);

    expect(screen.getByText(/Copy from Animal/)).toBeInTheDocument();
  });

  it('shows empty state when no electrode groups', () => {
    const emptyAnimal = {
      ...mockAnimal,
      devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] }
    };

    render(<ElectrodeGroupsStep animal={emptyAnimal} onFieldUpdate={mockOnFieldUpdate} />);

    expect(screen.getByText(/No Electrode Groups Configured/)).toBeInTheDocument();
  });

  it('has Edit button for each group', () => {
    render(<ElectrodeGroupsStep animal={mockAnimal} onFieldUpdate={mockOnFieldUpdate} />);

    const editButtons = screen.getAllByText('Edit');
    expect(editButtons).toHaveLength(2);
  });

  it('has Delete button for each group', () => {
    render(<ElectrodeGroupsStep animal={mockAnimal} onFieldUpdate={mockOnFieldUpdate} />);

    const deleteButtons = screen.getAllByText('Delete');
    expect(deleteButtons).toHaveLength(2);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/pages/AnimalEditor/__tests__/ElectrodeGroupsStep.test.jsx
```

Expected: FAIL with "Cannot find module '../ElectrodeGroupsStep'"

**Step 3: Write minimal implementation**

```javascript
// src/pages/AnimalEditor/ElectrodeGroupsStep.jsx
import { useState } from 'react';
import PropTypes from 'prop-types';
import { deviceTypeMap } from '../../ntrode/deviceTypes';

/**
 * ElectrodeGroupsStep - Step 1 of Animal Editor
 *
 * Provides CRUD interface for electrode groups with table view.
 *
 * @param {object} props
 * @param {object} props.animal - Animal record
 * @param {Function} props.onFieldUpdate - Field update callback
 * @returns {JSX.Element}
 */
export default function ElectrodeGroupsStep({ animal, onFieldUpdate }) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);

  const electrodeGroups = animal.devices?.electrode_groups || [];

  // Get channel count for device type
  function getChannelCount(deviceType) {
    const channels = deviceTypeMap(deviceType);
    return channels ? channels.length : 0;
  }

  // Compute status badge
  function getStatus(group) {
    // Has required fields?
    if (group.device_type && group.location) {
      // Has optional fields?
      if (group.targeted_x !== undefined && group.targeted_y !== undefined && group.targeted_z !== undefined) {
        return '✓';
      }
      return '⚠';
    }
    return '❌';
  }

  // Empty state
  if (electrodeGroups.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔌</div>
        <h3>No Electrode Groups Configured</h3>
        <p>
          Electrode groups define your recording hardware: brain regions, device types, and stereotaxic coordinates.
        </p>
        <p className="empty-state-hint">
          After adding electrode groups, you'll configure channel maps to match your Trodes hardware setup.
        </p>
        <button className="button-primary" onClick={() => setShowAddDialog(true)}>
          Add First Electrode Group
        </button>
        <button className="button-secondary" onClick={() => setShowCopyDialog(true)}>
          Copy from Existing Animal
        </button>
      </div>
    );
  }

  // Table view
  return (
    <div className="electrode-groups-step">
      <header className="step-header">
        <h2>Step 1: Electrode Groups</h2>
        <p>Configure the electrode groups for this animal.</p>
      </header>

      <div className="table-actions">
        <button className="button-primary" onClick={() => setShowAddDialog(true)}>
          + Add Electrode Group
        </button>
        <button className="button-secondary" onClick={() => setShowCopyDialog(true)}>
          Copy from Animal
        </button>
      </div>

      <table className="electrode-groups-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Device Type</th>
            <th>Location</th>
            <th>Channels</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {electrodeGroups.map((group) => (
            <tr key={group.id}>
              <td>{group.id}</td>
              <td>{group.device_type}</td>
              <td>{group.location}</td>
              <td>{getChannelCount(group.device_type)}</td>
              <td>
                <span className={`status-badge ${getStatus(group)}`}>
                  {getStatus(group)}
                </span>
              </td>
              <td>
                <button className="button-small" onClick={() => {/* TODO */}}>Edit</button>
                <button className="button-small button-danger" onClick={() => {/* TODO */}}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Dialogs will be implemented in next tasks */}
    </div>
  );
}

ElectrodeGroupsStep.propTypes = {
  animal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    devices: PropTypes.shape({
      electrode_groups: PropTypes.arrayOf(PropTypes.object),
      ntrode_electrode_group_channel_map: PropTypes.arrayOf(PropTypes.object),
    })
  }).isRequired,
  onFieldUpdate: PropTypes.func.isRequired,
};
```

**Step 4: Run test to verify it passes**

```bash
npm test -- src/pages/AnimalEditor/__tests__/ElectrodeGroupsStep.test.jsx
```

Expected: PASS (9 tests)

**Step 5: Commit**

```bash
git add src/pages/AnimalEditor/ElectrodeGroupsStep.jsx src/pages/AnimalEditor/__tests__/ElectrodeGroupsStep.test.jsx
git commit -m "feat(M7): add ElectrodeGroupsStep with table view"
```

---

## CONTINUATION NOTE

This plan is comprehensive but extremely long. For brevity, I'm providing the structure for remaining tasks. The pattern established above (TDD with 5 steps: test → fail → implement → pass → commit) continues throughout.

**Remaining tasks include:**

### Phase 2 (continued)

- Task 2.2: ElectrodeGroupModal (add/edit form)
- Task 2.3: Template Selection Dialog
- Task 2.4: Add Multiple Groups Dialog
- Task 2.5: CRUD Operations Implementation
- Task 2.6: Validation Logic

### Phase 3: Step 2 - Channel Maps

- Task 3.1: ChannelMapsStep with Progressive Disclosure
- Task 3.2: ChannelMapSummary Component
- Task 3.3: ChannelMapEditor Adaptation
- Task 3.4: Bulk Edit Tools
- Task 3.5: CSV Import/Export

### Phase 4: Styling & Polish

- Task 4.1: AnimalEditor.css (Material Design)
- Task 4.2: Responsive Design
- Task 4.3: Accessibility Testing

### Phase 5: Integration & Testing

- Task 5.1: Integration with AnimalWorkspace
- Task 5.2: Integration with DevicesStep
- Task 5.3: End-to-End Workflow Tests
- Task 5.4: Performance Testing (66 groups, 128 channels)

### Phase 6: Documentation & Review

- Task 6.1: Update TASKS.md
- Task 6.2: Update SCRATCHPAD.md
- Task 6.3: Update REFACTOR_CHANGELOG.md
- Task 6.4: Code Review
- Task 6.5: Final Verification

---

**Total Estimated Tasks:** 35-40 tasks
**Total Estimated Time:** 32-40 hours

Would you like me to:

1. Continue writing the complete plan (all 35-40 tasks in detail)?
2. Save this abbreviated version and proceed to execution?
3. Focus on specific phases that need more detail?
