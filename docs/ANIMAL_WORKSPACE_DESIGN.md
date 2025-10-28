# Animal Workspace Architecture Design

**Status:** DRAFT - Ready for Review
**Created:** 2025-10-27
**Purpose:** Define multi-animal, multi-day data model before M3 implementation

---

## Table of Contents

1. [Overview](#overview)
2. [Problem Statement](#problem-statement)
3. [Data Model](#data-model)
4. [Storage Strategy](#storage-strategy)
5. [YAML Export Flow](#yaml-export-flow)
6. [UI Workflow](#ui-workflow)
7. [Batch Operations](#batch-operations)
8. [Migration Path](#migration-path)
9. [Testing Strategy](#testing-strategy)
10. [Open Questions](#open-questions)

---

## Overview

The Animal Workspace extends the current single-session YAML editor into a multi-animal, multi-day workspace manager. This enables neuroscientists to efficiently manage chronic recording experiments that span:

- **Multiple animals** (1-20 subjects per experiment)
- **Multiple days** (30-200+ recording sessions per animal)
- **Shared metadata** (probe configuration, experimenters, institution)
- **Probe reconfigurations** (detect and propagate device changes)

### Design Principles

1. **YAML independence preserved** - Each exported YAML file is self-contained (matches current format)
2. **UI-level aggregation only** - Workspace is a management layer, not a data format change
3. **Backward compatible** - Current single-session workflow still works
4. **Scientific rigor maintained** - No loss of metadata precision or validation

---

## Problem Statement

### Current Workflow Pain Points

**Single-Session Focus:**
- Users create one YAML file at a time
- Repeated entry of shared metadata (experimenter, institution, probe configuration)
- No visibility across recording sessions
- Manual tracking of probe adjustments between days

**Example: 60-day chronic recording experiment**
- 1 animal × 60 days = **60 YAML files**
- Each file contains ~80% identical metadata (subject, devices, electrode groups)
- Probe adjustment on day 15 requires **manual update to days 16-60**
- No batch validation or export

### User Stories

**US1: Bulk Session Creation**
> As a neuroscientist, I want to create metadata for a 30-day experiment in one operation, so I don't spend hours duplicating the same information.

**US2: Probe Reconfiguration Tracking**
> As an experimenter, when I adjust probe positions on day 15, I want to automatically apply those changes to all future days, so my metadata stays consistent.

**US3: Cross-Day Validation**
> As a lab manager, I want to validate all sessions at once and identify which days have incomplete metadata, so I can fix errors before NWB conversion.

**US4: Batch Export**
> As a data analyst, I want to export YAMLs for a date range (days 10-20) in one click, so I can process data pipelines efficiently.

---

## Data Model

### Hierarchy

```
Workspace (localStorage)
  ├─ Animals
  │   ├─ Animal: "remy" (rat subject)
  │   │   ├─ Shared Metadata (subject, devices, cameras, experimenters)
  │   │   ├─ Default Template (probe configuration, institution)
  │   │   ├─ Version History (probe reconfigurations by date)
  │   │   └─ Days: ["remy-2023-06-01", "remy-2023-06-02", ...]
  │   └─ Animal: "bean"
  │       └─ ...
  └─ Days
      ├─ Day: "remy-2023-06-01"
      │   ├─ Session-Specific Data (session_id, tasks, epochs)
      │   ├─ Draft State (incomplete, validated, exported)
      │   ├─ Merged Metadata (Animal defaults + Day overrides)
      │   └─ Export Timestamp
      └─ Day: "remy-2023-06-02"
          └─ ...
```

### TypeScript Data Model

```typescript
/**
 * Workspace - Top-level container (persisted to localStorage)
 */
interface Workspace {
  version: string;          // Schema version (e.g., "1.0.0")
  lastModified: string;     // ISO timestamp
  animals: Record<AnimalId, Animal>;
  days: Record<DayId, Day>;
  settings: WorkspaceSettings;
}

type AnimalId = string;     // e.g., "remy", "bean"
type DayId = string;        // e.g., "remy-2023-06-22"

/**
 * Animal - Shared metadata across all recording days
 */
interface Animal {
  id: AnimalId;

  // Subject metadata (constant across days)
  subject: {
    subject_id: string;           // e.g., "remy"
    species: string;              // e.g., "Rattus norvegicus"
    sex: "M" | "F" | "U" | "O";
    genotype: string;
    date_of_birth: string;        // ISO datetime
    description: string;
    weight?: number;              // Optional: may change daily
    age?: string;                 // Optional: computed from DOB
  };

  // Hardware configuration (may change with reconfigurations)
  devices: {
    data_acq_device: DataAcqDevice[];
    device: { name: string[] };
    electrode_groups: ElectrodeGroup[];
    ntrode_electrode_group_channel_map: NtrodeMap[];
  };

  // Shared experimental setup
  cameras: Camera[];
  experimenters: {
    experimenter_name: string[];
    lab: string;
    institution: string;
  };

  // Optogenetics (if applicable)
  optogenetics?: {
    opto_excitation_source: OptoSource[];
    optical_fiber: OpticalFiber[];
    virus_injection: VirusInjection[];
    optogenetic_stimulation_software: string;
  };

  // Workspace metadata
  days: DayId[];                  // Ordered list of day IDs
  created: string;                // ISO timestamp
  lastModified: string;

  // Probe reconfiguration tracking
  configurationHistory: ConfigurationSnapshot[];
}

/**
 * Probe configuration snapshot (for tracking changes over time)
 */
interface ConfigurationSnapshot {
  date: string;                   // Date this config became active (YYYY-MM-DD)
  version: number;                // Sequential version number
  description: string;            // e.g., "Lowered CA1 tetrodes by 40um"
  devices: {
    electrode_groups: ElectrodeGroup[];
    ntrode_electrode_group_channel_map: NtrodeMap[];
  };
  appliedToDays: DayId[];        // Days that use this configuration
}

/**
 * Day - Session-specific metadata
 */
interface Day {
  id: DayId;                      // e.g., "remy-2023-06-22"
  animalId: AnimalId;

  // Date/time metadata
  date: string;                   // YYYY-MM-DD
  experimentDate: string;         // mmddYYYY (for filename)
  sessionStartTime?: string;      // ISO datetime

  // Session-specific data
  session: {
    session_id: string;           // e.g., "remy_20230622"
    session_description: string;
    experiment_description?: string; // Optional override of animal default
  };

  // Behavioral protocol
  tasks: Task[];
  behavioral_events: BehavioralEvent[];

  // Data files
  associated_files: AssociatedFile[];
  associated_video_files: AssociatedVideoFile[];
  fs_gui_yamls?: FsGuiYaml[];

  // Technical parameters
  technical: {
    times_period_multiplier: number;
    raw_data_to_volts: number;
    default_header_file_path: string;
    units?: {
      analog: string;
      behavioral_events: string;
    };
  };

  // Device overrides (if different from animal default)
  deviceOverrides?: {
    electrode_groups?: ElectrodeGroup[];
    ntrode_electrode_group_channel_map?: NtrodeMap[];
    cameras?: Camera[];
  };

  // Workspace metadata
  state: {
    draft: boolean;               // false = validated and ready to export
    validated: boolean;           // Passed validation pipeline
    exported: boolean;            // YAML file generated
    exportedAt?: string;          // ISO timestamp of export
    validationErrors?: ValidationIssue[];
  };

  created: string;
  lastModified: string;
  configurationVersion: number;   // Links to Animal.configurationHistory
}

/**
 * Workspace settings
 */
interface WorkspaceSettings {
  defaultLab: string;
  defaultInstitution: string;
  defaultExperimenters: string[];
  autoSaveInterval: number;       // milliseconds (default: 30000)
  shadowExportEnabled: boolean;   // Safety check against legacy exporter
}

// Additional interfaces match existing schema (ElectrodeGroup, Task, Camera, etc.)
```

### Metadata Inheritance Model

Each Day's exported YAML is generated by **merging**:

1. **Animal defaults** (subject, devices, cameras, experimenters)
2. **Day-specific data** (session, tasks, epochs, files)
3. **Device overrides** (if probe was reconfigured)

```javascript
function generateDayYaml(animal, day) {
  // Get appropriate configuration version
  const config = animal.configurationHistory.find(
    c => c.version === day.configurationVersion
  );

  return {
    // From Animal
    experimenter_name: animal.experimenters.experimenter_name,
    lab: animal.experimenters.lab,
    institution: animal.experimenters.institution,
    subject: animal.subject,
    cameras: day.deviceOverrides?.cameras || animal.cameras,
    electrode_groups: day.deviceOverrides?.electrode_groups || config.devices.electrode_groups,
    ntrode_electrode_group_channel_map: day.deviceOverrides?.ntrode_electrode_group_channel_map || config.devices.ntrode_electrode_group_channel_map,
    data_acq_device: animal.devices.data_acq_device,
    device: animal.devices.device,

    // Optogenetics (if present)
    ...(animal.optogenetics || {}),

    // From Day
    experiment_description: day.session.experiment_description || '',
    session_description: day.session.session_description,
    session_id: day.session.session_id,
    tasks: day.tasks,
    behavioral_events: day.behavioral_events,
    associated_files: day.associated_files,
    associated_video_files: day.associated_video_files,
    times_period_multiplier: day.technical.times_period_multiplier,
    raw_data_to_volts: day.technical.raw_data_to_volts,
    default_header_file_path: day.technical.default_header_file_path,
    units: day.technical.units,

    // Computed
    keywords: [], // Could be auto-generated from tasks
  };
}
```

### Critical Design Decision: Embedded vs. Referenced

**Question:** Should days embed full device configuration, or reference animal's configuration?

**Decision:** **Reference with version tracking**

**Rationale:**
- Most days use identical probe configuration (reduces duplication)
- Probe changes are infrequent but significant (versioning tracks history)
- Device overrides allow per-day customization when needed
- Easier to detect and propagate configuration changes

**Example:**
```javascript
// Animal has 2 configuration versions
animal.configurationHistory = [
  {
    version: 1,
    date: "2023-06-01",
    description: "Initial implant",
    devices: { electrode_groups: [...8 tetrodes...], ntrode_map: [...] },
    appliedToDays: ["remy-2023-06-01", ..., "remy-2023-06-14"]
  },
  {
    version: 2,
    date: "2023-06-15",
    description: "Lowered CA1 tetrodes by 40um",
    devices: { electrode_groups: [...8 tetrodes, updated coords...], ntrode_map: [...] },
    appliedToDays: ["remy-2023-06-15", ..., "remy-2023-07-30"]
  }
];

// Day references version
day.configurationVersion = 2; // Uses second configuration
```

---

## Storage Strategy

### Phase 1: localStorage (Recommended)

**Implementation:**

```javascript
// src/utils/workspaceStorage.js

const STORAGE_KEY = 'nwb-workspace-v1';
const MAX_SIZE_MB = 5;

/**
 * Saves workspace to localStorage with compression
 */
export function saveWorkspace(workspace) {
  const json = JSON.stringify(workspace);
  const sizeKB = new Blob([json]).size / 1024;

  if (sizeKB > MAX_SIZE_MB * 1024) {
    throw new Error(`Workspace too large (${sizeKB.toFixed(0)}KB > ${MAX_SIZE_MB}MB). Consider archiving old animals.`);
  }

  localStorage.setItem(STORAGE_KEY, json);
  return { saved: true, sizeKB };
}

/**
 * Loads workspace from localStorage
 */
export function loadWorkspace() {
  const json = localStorage.getItem(STORAGE_KEY);
  if (!json) return null;

  const workspace = JSON.parse(json);

  // Version migration if needed
  if (workspace.version !== CURRENT_VERSION) {
    return migrateWorkspace(workspace);
  }

  return workspace;
}

/**
 * Auto-save hook (debounced)
 */
export function useWorkspaceAutoSave(workspace, intervalMs = 30000) {
  useEffect(() => {
    const timer = setTimeout(() => {
      saveWorkspace(workspace);
    }, intervalMs);

    return () => clearTimeout(timer);
  }, [workspace, intervalMs]);
}
```

**Capacity Analysis:**

| Item | Size | Count | Total |
|------|------|-------|-------|
| Animal metadata | ~10 KB | 10 animals | 100 KB |
| Day metadata | ~5 KB | 10 animals × 50 days | 2.5 MB |
| Configuration history | ~8 KB | 10 animals × 3 versions | 240 KB |
| **Total** | | | **~2.8 MB** |

**Margin:** 5 MB limit supports ~18 animals with 50 days each (or 90 days for 10 animals).

**Pros:**
- ✅ No backend required (works offline)
- ✅ Instant save/load (< 50ms)
- ✅ Browser-native (no dependencies)
- ✅ Auto-persists across sessions

**Cons:**
- ❌ Browser-specific (not shareable)
- ❌ Cleared on cache wipe (needs export/import)
- ❌ Size limit (~5-10 MB depending on browser)

**Mitigation:**
- Add "Export Workspace" → JSON file backup
- Add "Import Workspace" → Restore from JSON
- Warning when approaching size limit
- Archive old animals (move to separate JSON file)

### Phase 2: File System (Future Enhancement)

**Potential Electron Integration:**

```javascript
// Future: Electron main process
import { watch } from 'fs/promises';

// Watch directory for .metadata.yml files
async function watchWorkspaceDirectory(path) {
  const watcher = watch(path);

  for await (const event of watcher) {
    if (event.filename.endsWith('.metadata.yml')) {
      const yaml = await readFile(path + '/' + event.filename, 'utf8');
      const data = decodeYaml(yaml);

      // Auto-import into workspace
      workspace.importDay(data);
    }
  }
}
```

**Benefits:**
- Unlimited storage
- Shareable via network drives
- Direct integration with data directories
- External editing possible

**Complexity:**
- Requires Electron desktop app
- File sync conflicts
- OS-specific file watching

**Decision:** Defer to Phase 2 (post-M12) after localStorage proves workflow.

---

## YAML Export Flow

### Single-Day Export (Primary Use Case)

```javascript
/**
 * Exports a single day as YAML file
 *
 * @param {Animal} animal - Animal metadata
 * @param {Day} day - Day to export
 * @returns {string} YAML content
 */
export function exportDayYaml(animal, day) {
  // 1. Validate day is complete
  const { ok, issues } = validateDay(animal, day);
  if (!ok) {
    throw new ValidationError('Cannot export incomplete day', issues);
  }

  // 2. Merge animal + day metadata
  const merged = mergeDayMetadata(animal, day);

  // 3. Generate YAML (existing logic)
  const yaml = encodeYaml(merged);

  // 4. Shadow export comparison (safety check)
  if (FLAGS.shadowExportStrict) {
    const { equal, diff } = shadowCompare(merged);
    if (!equal) {
      throw new Error(`Shadow export mismatch:\n${diff}`);
    }
  }

  // 5. Generate deterministic filename
  const filename = formatDeterministicFilename(merged);
  // Example: "06222023_remy_metadata.yml"

  // 6. Trigger browser download
  downloadFile(filename, yaml);

  // 7. Update day state
  day.state.exported = true;
  day.state.exportedAt = new Date().toISOString();

  return yaml;
}

/**
 * Merges animal defaults with day-specific data
 */
function mergeDayMetadata(animal, day) {
  const config = animal.configurationHistory.find(
    c => c.version === day.configurationVersion
  ) || animal.configurationHistory[0];

  return {
    // Animal metadata
    experimenter_name: animal.experimenters.experimenter_name,
    lab: animal.experimenters.lab,
    institution: animal.experimenters.institution,
    subject: {
      ...animal.subject,
      weight: day.session.weight || animal.subject.weight, // Day override
    },

    // Devices (with override support)
    data_acq_device: animal.devices.data_acq_device,
    device: animal.devices.device,
    cameras: day.deviceOverrides?.cameras || animal.cameras,
    electrode_groups: day.deviceOverrides?.electrode_groups || config.devices.electrode_groups,
    ntrode_electrode_group_channel_map: day.deviceOverrides?.ntrode_electrode_group_channel_map || config.devices.ntrode_electrode_group_channel_map,

    // Optogenetics (if present)
    ...(animal.optogenetics && {
      opto_excitation_source: animal.optogenetics.opto_excitation_source,
      optical_fiber: animal.optogenetics.optical_fiber,
      virus_injection: animal.optogenetics.virus_injection,
      optogenetic_stimulation_software: animal.optogenetics.optogenetic_stimulation_software,
    }),

    // Day-specific data
    experiment_description: day.session.experiment_description || '',
    session_description: day.session.session_description,
    session_id: day.session.session_id,
    keywords: [], // Could auto-generate
    tasks: day.tasks,
    behavioral_events: day.behavioral_events,
    associated_files: day.associated_files,
    associated_video_files: day.associated_video_files,
    fs_gui_yamls: day.fs_gui_yamls || [],

    // Technical
    times_period_multiplier: day.technical.times_period_multiplier,
    raw_data_to_volts: day.technical.raw_data_to_volts,
    default_header_file_path: day.technical.default_header_file_path,
    units: day.technical.units || {},
  };
}
```

### Batch Export

```javascript
/**
 * Exports multiple days as ZIP archive
 */
export async function exportDaysAsZip(animal, dayIds, options = {}) {
  const { validateFirst = true, includeInvalid = false } = options;

  const results = [];
  const zip = new JSZip(); // Using jszip library

  for (const dayId of dayIds) {
    const day = workspace.days[dayId];

    // Skip invalid days unless explicitly included
    if (validateFirst) {
      const { ok, issues } = validateDay(animal, day);
      if (!ok && !includeInvalid) {
        results.push({ dayId, skipped: true, reason: 'Validation failed', issues });
        continue;
      }
    }

    try {
      const yaml = exportDayYaml(animal, day);
      const filename = formatDeterministicFilename(mergeDayMetadata(animal, day));

      zip.file(filename, yaml);
      results.push({ dayId, success: true, filename });
    } catch (error) {
      results.push({ dayId, error: error.message });
    }
  }

  // Generate ZIP
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipFilename = `${animal.id}_sessions_${new Date().toISOString().split('T')[0]}.zip`;

  downloadFile(zipFilename, zipBlob);

  return {
    exported: results.filter(r => r.success).length,
    skipped: results.filter(r => r.skipped).length,
    errors: results.filter(r => r.error).length,
    details: results,
  };
}
```

### Critical: YAML Format Unchanged

**Guarantee:** Each exported YAML file is **structurally identical** to current single-session format.

**Verification:**
```javascript
// Test: Exported day YAML matches legacy single-session YAML
describe('YAML Export Parity', () => {
  it('workspace day export === legacy single session', () => {
    const animal = createTestAnimal();
    const day = createTestDay(animal.id);

    // Export via workspace
    const workspaceYaml = exportDayYaml(animal, day);

    // Export via legacy (merged data)
    const mergedData = mergeDayMetadata(animal, day);
    const legacyYaml = encodeYaml(mergedData);

    expect(workspaceYaml).toBe(legacyYaml);
  });
});
```

---

## UI Workflow

### View Hierarchy

```
AppRouter (hash-based)
  ├─ #/ → WorkspaceHome
  ├─ #/animal/:animalId → AnimalWorkspace
  ├─ #/animal/:animalId/day/:dayId → DayEditor
  └─ #/animal/:animalId/validation → ValidationSummary
```

### 1. Workspace Home View

**Purpose:** Animal selection and workspace management

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ NWB Metadata Workspace                          │
├─────────────────────────────────────────────────┤
│ [+ New Animal] [Import Animal] [Export Workspace] │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────────┐  ┌─────────────────┐      │
│  │ remy            │  │ bean            │      │
│  │ Rat, M          │  │ Rat, F          │      │
│  │ 45 days         │  │ 23 days         │      │
│  │ Last: 2023-07-15│  │ Last: 2023-07-10│      │
│  │ [Open]          │  │ [Open]          │      │
│  └─────────────────┘  └─────────────────┘      │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Interactions:**
- Click animal card → Navigate to Animal Workspace
- "+ New Animal" → Create animal dialog
- "Import Animal" → Upload JSON/YAML to populate animal

**State:**
```javascript
// useStore → workspace slice
const { animals } = useStoreContext();
const animalList = Object.values(animals).sort((a, b) =>
  new Date(b.lastModified) - new Date(a.lastModified)
);
```

### 2. Animal Workspace View

**Purpose:** Day management for a single animal

**URL:** `#/animal/remy`

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ ← Back to Workspace                             │
├─────────────────────────────────────────────────┤
│ Animal: remy (Rattus norvegicus, Male)          │
│ [Edit Animal Info] [Batch Create Days]          │
├─────────────────────────────────────────────────┤
│ Recording Days (45)         [Validate All]      │
│                             [Export Valid]       │
├─────────────────────────────────────────────────┤
│                                                 │
│ Jun 2023                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ 06/01    │ │ 06/02    │ │ 06/03    │        │
│  │ ✅ Valid │ │ ✅ Valid │ │ ⚠️  Draft │        │
│  │ [Edit]   │ │ [Edit]   │ │ [Edit]   │        │
│  │ [Export] │ │ [Export] │ │          │        │
│  └──────────┘ └──────────┘ └──────────┘        │
│                                                 │
│ Jul 2023                                        │
│  ┌──────────┐ ┌──────────┐                     │
│  │ 07/01    │ │ 07/02    │ ...                 │
│  │ ✅ Valid │ │ ❌ Error │                     │
│  │ [Edit]   │ │ [Edit]   │                     │
│  │ [Export] │ │          │                     │
│  └──────────┘ └──────────┘                     │
│                                                 │
│ [+ Add Recording Day]                           │
└─────────────────────────────────────────────────┘
```

**Status Badges:**
- ✅ **Valid** - Passed validation, ready to export
- ⚠️ **Draft** - Incomplete, needs more data
- ❌ **Error** - Validation errors present
- 📄 **Exported** - YAML file generated

**Interactions:**
- Click day card → Navigate to Day Editor
- "Edit" → Open day in editor
- "Export" → Download YAML for that day
- "+ Add Recording Day" → Create new day dialog
- "Batch Create Days" → Date range picker → Create multiple days

**State:**
```javascript
const { animals, days } = useStoreContext();
const animal = animals[animalId];
const animalDays = animal.days.map(dayId => days[dayId]);
const daysByMonth = groupByMonth(animalDays);
```

### 3. Day Editor View

**Purpose:** Edit session-specific metadata (reuses existing form)

**URL:** `#/animal/remy/day/remy-2023-06-22`

**Layout:** Existing stepper interface (Overview → Devices → Epochs → Validation → Export)

**Changes from Current:**
- Pre-populated with animal defaults (subject, devices, cameras)
- "Inherited from Animal" indicators for read-only fields
- "Override" buttons for devices (if probe reconfigured)
- Validation panel shows animal context (probe version)

**Example - Overview Step:**
```
┌─────────────────────────────────────────────────┐
│ Day Editor: remy - 2023-06-22                   │
│ [Overview] [Devices] [Epochs] [Validation] [Export] │
├─────────────────────────────────────────────────┤
│                                                 │
│ Subject Information (inherited from Animal)     │
│  Subject ID: remy          🔒 [Edit Animal]     │
│  Species: Rattus norvegicus 🔒                  │
│  Sex: M                     🔒                  │
│                                                 │
│ Session Information                             │
│  Session ID: [remy_20230622_____________]       │
│  Description: [Day 45 chronic recording__]      │
│                                                 │
│ Experimenters (inherited from Animal)           │
│  Names: Guidera, Jennifer; Comrie, Alison 🔒    │
│  Lab: Frank 🔒                                  │
│  Institution: UCSF 🔒                           │
│                                                 │
│ [← Previous Step]          [Next Step: Devices→] │
└─────────────────────────────────────────────────┘
```

**State:**
```javascript
const { animals, days, workspaceActions } = useStoreContext();
const animal = animals[animalId];
const day = days[dayId];

// Merged view for form
const formData = useMemo(() =>
  mergeDayMetadata(animal, day),
  [animal, day]
);

// Updates go to day, not animal
const handleUpdate = (field, value) => {
  workspaceActions.updateDay(dayId, { [field]: value });
};
```

### 4. Validation Summary View

**Purpose:** Cross-day validation and batch operations

**URL:** `#/animal/remy/validation`

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Validation Summary: remy                        │
├─────────────────────────────────────────────────┤
│ [Validate All Days] [Export Valid Days]         │
│                                                 │
│ Filters: [✓ All] [ ] Draft [ ] Valid [ ] Error │
│                                                 │
├─────────────────────────────────────────────────┤
│ Date       │ Status │ Issues │ Actions          │
├─────────────────────────────────────────────────┤
│ 2023-06-01 │ ✅ Valid│ 0     │ [Edit] [Export]  │
│ 2023-06-02 │ ✅ Valid│ 0     │ [Edit] [Export]  │
│ 2023-06-03 │ ⚠️  Draft│ 3     │ [Edit] [Fix]     │
│ 2023-06-04 │ ❌ Error│ 5     │ [Edit] [Details] │
│ ...        │        │       │                  │
├─────────────────────────────────────────────────┤
│ Summary: 42 valid, 2 draft, 1 error             │
└─────────────────────────────────────────────────┘
```

**Interactions:**
- "Validate All Days" → Run validation pipeline on all days
- "Export Valid Days" → Batch export as ZIP
- "Details" → Show validation errors in modal
- "Fix" → Navigate to day editor, focus on first error

**Validation Pipeline:**
```javascript
async function validateAllDays(animal) {
  const results = [];

  for (const dayId of animal.days) {
    const day = workspace.days[dayId];
    const merged = mergeDayMetadata(animal, day);

    // Run full validation pipeline
    const { ok, issues } = runValidation(merged);

    // Update day state
    day.state.validated = ok;
    day.state.validationErrors = issues;

    results.push({ dayId, ok, issues });
  }

  return results;
}
```

---

## Batch Operations

### 1. Batch Day Creation

**Use Case:** Create 30 days of metadata at once

**Dialog:**
```
┌─────────────────────────────────────────────────┐
│ Batch Create Recording Days                    │
├─────────────────────────────────────────────────┤
│ Animal: remy                                    │
│                                                 │
│ Start Date: [2023-06-01]                        │
│ End Date:   [2023-06-30]                        │
│                                                 │
│ Skip weekends: [✓]                              │
│ Skip dates:    [06/10, 06/11] (comma-separated)│
│                                                 │
│ Session ID Template: {animal}_{date}            │
│ (Available: {animal}, {date}, {day_num})        │
│                                                 │
│ Will create: 26 days                            │
│                                                 │
│ [Cancel]                     [Create Days]      │
└─────────────────────────────────────────────────┘
```

**Implementation:**
```javascript
function batchCreateDays(animalId, startDate, endDate, options) {
  const animal = workspace.animals[animalId];
  const dates = generateDateRange(startDate, endDate, options);

  const created = [];

  for (const date of dates) {
    const dayId = `${animalId}-${date}`;

    const day = {
      id: dayId,
      animalId,
      date,
      experimentDate: formatDateMMDDYYYY(date),
      session: {
        session_id: options.sessionIdTemplate
          .replace('{animal}', animalId)
          .replace('{date}', date.replace(/-/g, ''))
          .replace('{day_num}', created.length + 1),
        session_description: '',
      },
      tasks: [],
      behavioral_events: [],
      associated_files: [],
      associated_video_files: [],
      technical: {
        times_period_multiplier: 1.5,
        raw_data_to_volts: 0.195,
        default_header_file_path: '',
      },
      state: {
        draft: true,
        validated: false,
        exported: false,
      },
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      configurationVersion: animal.configurationHistory.length, // Use latest
    };

    workspace.days[dayId] = day;
    animal.days.push(dayId);
    created.push(dayId);
  }

  return created;
}
```

### 2. Probe Reconfiguration Wizard

**Use Case:** Lowered tetrodes on day 15, apply to all future days

**Trigger:** Detect device changes in Day Editor when saving

```javascript
function detectProbeReconfiguration(animal, day, newDevices) {
  const currentConfig = animal.configurationHistory.find(
    c => c.version === day.configurationVersion
  );

  const changed = !deepEqual(
    currentConfig.devices.electrode_groups,
    newDevices.electrode_groups
  );

  if (changed) {
    // Show wizard
    showProbeReconfigWizard(animal, day, newDevices);
  }
}
```

**Wizard Dialog:**
```
┌─────────────────────────────────────────────────┐
│ Probe Configuration Change Detected             │
├─────────────────────────────────────────────────┤
│ You modified electrode group positions for      │
│ day 2023-06-15.                                 │
│                                                 │
│ Changes:                                        │
│  • CA1 tetrode 1: z=2.0mm → z=1.96mm (-40um)   │
│  • CA1 tetrode 2: z=2.0mm → z=1.96mm (-40um)   │
│  • CA1 tetrode 3: z=2.0mm → z=1.96mm (-40um)   │
│                                                 │
│ Apply to:                                       │
│  ( ) This day only (override)                   │
│  (•) This day and all future days (new config)  │
│  ( ) Specific date range: [___] to [___]        │
│                                                 │
│ Configuration Description:                      │
│  [Lowered CA1 tetrodes by 40um___________]      │
│                                                 │
│ Future days affected: 15                        │
│                                                 │
│ [Cancel]              [Apply Configuration]     │
└─────────────────────────────────────────────────┘
```

**Implementation:**
```javascript
function applyProbeReconfiguration(animal, day, newDevices, scope) {
  // Create new configuration version
  const newVersion = {
    version: animal.configurationHistory.length + 1,
    date: day.date,
    description: scope.description,
    devices: {
      electrode_groups: newDevices.electrode_groups,
      ntrode_electrode_group_channel_map: newDevices.ntrode_electrode_group_channel_map,
    },
    appliedToDays: [],
  };

  animal.configurationHistory.push(newVersion);

  // Apply to affected days
  const affectedDays = animal.days
    .map(id => workspace.days[id])
    .filter(d => {
      if (scope.type === 'this_day_only') return d.id === day.id;
      if (scope.type === 'future_days') return d.date >= day.date;
      if (scope.type === 'date_range') {
        return d.date >= scope.startDate && d.date <= scope.endDate;
      }
    });

  for (const d of affectedDays) {
    d.configurationVersion = newVersion.version;
    newVersion.appliedToDays.push(d.id);
  }

  return newVersion;
}
```

### 3. Batch Export

**Use Case:** Export days 10-20 for analysis

**Dialog:**
```
┌─────────────────────────────────────────────────┐
│ Batch Export                                    │
├─────────────────────────────────────────────────┤
│ Export:                                         │
│  (•) All valid days (42 days)                   │
│  ( ) Date range: [____] to [____]               │
│  ( ) Selected days: [____] (comma-separated)    │
│                                                 │
│ [ ] Include invalid days (will add validation   │
│     errors as comments)                         │
│                                                 │
│ Format:                                         │
│  (•) ZIP archive (recommended)                  │
│  ( ) Individual downloads (slow for >10 days)   │
│                                                 │
│ [Cancel]                          [Export]      │
└─────────────────────────────────────────────────┘
```

**See earlier:** [Batch Export Implementation](#batch-export)

---

## Migration Path

### Phase 1: Single Animal (M3-M8)

**Scope:** Prove multi-day workflow with one animal

**Features:**
- Create animal (manual entry)
- Add/edit/delete days
- Batch day creation
- Validation summary
- Single-day export
- Batch export

**Simplifications:**
- No animal switcher (assume one active animal)
- No probe reconfiguration wizard (add in Phase 2)
- No import from existing YAMLs (add in Phase 2)

**Benefits:**
- Smaller scope (faster to ship)
- Validates core workflow
- Less UI complexity

### Phase 2: Multi-Animal (M9-M10)

**Scope:** Full workspace management

**Features:**
- Workspace home (animal selection)
- Create/import multiple animals
- Animal switcher in navigation
- Probe reconfiguration wizard
- Import from existing YAML files
- Export workspace as JSON backup

### Phase 3: Advanced Features (Post-M12)

**Scope:** Power user features

**Features:**
- File system integration (Electron)
- Templates (reusable task protocols)
- Experiment groups (multi-animal studies)
- Analytics (days per animal, validation trends)
- Cloud sync (optional backend)

---

## Testing Strategy

### Unit Tests

```javascript
// src/state/__tests__/workspace.test.js

describe('Workspace State Management', () => {
  it('creates animal with defaults', () => {
    const workspace = createWorkspace();
    const animal = workspace.createAnimal('remy', { species: 'Rattus norvegicus' });

    expect(animal.id).toBe('remy');
    expect(animal.subject.species).toBe('Rattus norvegicus');
    expect(animal.days).toEqual([]);
    expect(animal.configurationHistory).toHaveLength(1);
  });

  it('adds day to animal', () => {
    const workspace = createWorkspace();
    const animal = workspace.createAnimal('remy');
    const day = workspace.createDay(animal.id, '2023-06-22');

    expect(animal.days).toContain(day.id);
    expect(day.animalId).toBe('remy');
    expect(day.configurationVersion).toBe(1);
  });

  it('merges animal + day metadata correctly', () => {
    const animal = createTestAnimal();
    const day = createTestDay(animal.id);

    const merged = mergeDayMetadata(animal, day);

    expect(merged.subject.subject_id).toBe(animal.subject.subject_id);
    expect(merged.session_id).toBe(day.session.session_id);
    expect(merged.electrode_groups).toBe(animal.configurationHistory[0].devices.electrode_groups);
  });
});
```

### Integration Tests

```javascript
// src/__tests__/integration/workspace-workflow.test.jsx

describe('Animal Workspace Workflow', () => {
  it('creates animal → adds days → exports YAML', async () => {
    const user = userEvent.setup();
    render(<AppRouter />);

    // Create animal
    await user.click(screen.getByText('+ New Animal'));
    await user.type(screen.getByLabelText(/subject id/i), 'remy');
    await user.click(screen.getByText('Create'));

    // Add day
    await user.click(screen.getByText('+ Add Recording Day'));
    await user.type(screen.getByLabelText(/date/i), '2023-06-22');
    await user.click(screen.getByText('Add'));

    // Edit day
    await user.click(screen.getByText('Edit'));
    await user.type(screen.getByLabelText(/session id/i), 'remy_20230622');
    await user.click(screen.getByText('Save'));

    // Export
    await user.click(screen.getByText('Export'));

    // Verify download triggered
    expect(downloadFileSpy).toHaveBeenCalledWith(
      '06222023_remy_metadata.yml',
      expect.stringContaining('subject_id: remy')
    );
  });
});
```

### Baseline Tests

```javascript
// src/__tests__/baselines/workspace-yaml-parity.baseline.test.js

describe('Workspace YAML Parity', () => {
  it('workspace export === legacy export', () => {
    const animal = loadFixture('realistic-animal.json');
    const day = loadFixture('realistic-day.json');

    // Workspace export
    const workspaceYaml = exportDayYaml(animal, day);

    // Legacy export (merged manually)
    const merged = mergeDayMetadata(animal, day);
    const legacyYaml = encodeYaml(merged);

    // Must be byte-for-byte identical
    expect(workspaceYaml).toBe(legacyYaml);
  });

  it('batch export produces valid individual YAMLs', () => {
    const animal = loadFixture('realistic-animal.json');
    const days = loadFixtures('realistic-days/*.json');

    const { exported, details } = exportDaysAsZip(animal, days.map(d => d.id));

    expect(exported).toBe(days.length);

    details.forEach(({ yaml }) => {
      // Each YAML should validate against schema
      const parsed = decodeYaml(yaml);
      const { ok } = validateSchema(parsed);
      expect(ok).toBe(true);
    });
  });
});
```

---

## Open Questions

### 1. Import Strategy for Existing YAMLs

**Question:** User has 50 existing YAML files. How do they import into workspace?

**Options:**

**A. Batch Import from Directory**
```javascript
// Upload multiple .yml files
// → Auto-detect subject_id from each file
// → Group by subject_id into animals
// → Create days from each file
```

**B. Single Import + Clone**
```javascript
// Import one representative YAML
// → Create animal from it
// → Manually add additional days
```

**C. No Import (Start Fresh)**
```javascript
// Workspace is for new experiments only
// Existing YAMLs continue to work via legacy flow
```

**Recommendation:** Option A (batch import), implemented in Phase 2.

### 2. Experiment Description: Animal-level or Day-level?

**Current:** `experiment_description` is a top-level YAML field (same for all days).

**Options:**

**A. Animal-level (Shared)**
- Pro: Most experiments have one description
- Con: Can't change mid-experiment

**B. Day-level (Override)**
- Pro: Flexibility for multi-phase experiments
- Con: Duplication if same description

**Recommendation:** **Animal-level with day override**
```javascript
day.session.experiment_description || animal.experimentDescription
```

### 3. Weight Tracking: Animal Default or Day-specific?

**Observation:** Weight changes daily but usually increases gradually.

**Options:**

**A. Animal Default + Day Override**
```javascript
merged.subject.weight = day.session.weight || animal.subject.weight;
```

**B. Always Day-specific**
```javascript
// Animal has no weight field
merged.subject.weight = day.session.weight;
```

**Recommendation:** Option A (animal default with override). Most users want to enter weight once and override on days when it was measured.

### 4. Camera IDs: Animal-level or Day-level?

**Observation:** Camera setup rarely changes, but camera IDs might change if hardware swapped.

**Recommendation:** **Animal-level with day override** (same as devices).

---

## Summary

This architecture enables efficient multi-animal, multi-day workflows while:

1. ✅ **Preserving YAML format** - Each export is identical to current single-session output
2. ✅ **Reducing duplication** - Shared metadata defined once at animal level
3. ✅ **Tracking changes** - Probe reconfiguration versioning with propagation
4. ✅ **Batch operations** - Validate/export multiple days efficiently
5. ✅ **Maintaining rigor** - Shadow export, validation pipeline, baseline tests

**Next Step:** Review and approve this design before implementing M3 (Extend Store).

---

## Appendix: Example Workspace JSON

```json
{
  "version": "1.0.0",
  "lastModified": "2023-07-15T14:30:00Z",
  "animals": {
    "remy": {
      "id": "remy",
      "subject": {
        "subject_id": "remy",
        "species": "Rattus norvegicus",
        "sex": "M",
        "genotype": "Wild Type",
        "date_of_birth": "2023-01-10T00:00:00Z",
        "description": "Long Evans Rat from Charles River",
        "weight": 485
      },
      "devices": {
        "data_acq_device": [
          { "name": "SpikeGadgets", "system": "SpikeGadgets", "amplifier": "Intan", "adc_circuit": "Intan" }
        ],
        "device": { "name": ["Trodes"] }
      },
      "cameras": [
        { "id": 0, "meters_per_pixel": 0.00085, "manufacturer": "Allied Vision", "model": "Mako G-158" }
      ],
      "experimenters": {
        "experimenter_name": ["Guidera, Jennifer", "Comrie, Alison"],
        "lab": "Frank",
        "institution": "University of California, San Francisco"
      },
      "days": ["remy-2023-06-01", "remy-2023-06-02"],
      "created": "2023-06-01T10:00:00Z",
      "lastModified": "2023-07-15T14:30:00Z",
      "configurationHistory": [
        {
          "version": 1,
          "date": "2023-06-01",
          "description": "Initial 8-tetrode implant",
          "devices": {
            "electrode_groups": [ /* 8 tetrodes */ ],
            "ntrode_electrode_group_channel_map": [ /* 8 maps */ ]
          },
          "appliedToDays": ["remy-2023-06-01", "remy-2023-06-02"]
        }
      ]
    }
  },
  "days": {
    "remy-2023-06-01": {
      "id": "remy-2023-06-01",
      "animalId": "remy",
      "date": "2023-06-01",
      "experimentDate": "06012023",
      "session": {
        "session_id": "remy_20230601",
        "session_description": "Day 1 habituation to W-track"
      },
      "tasks": [
        { "task_name": "habituation", "task_description": "Free exploration", "task_epochs": [1] }
      ],
      "behavioral_events": [],
      "associated_files": [],
      "associated_video_files": [],
      "technical": {
        "times_period_multiplier": 1.5,
        "raw_data_to_volts": 0.195,
        "default_header_file_path": ""
      },
      "state": {
        "draft": false,
        "validated": true,
        "exported": true,
        "exportedAt": "2023-06-01T18:00:00Z"
      },
      "created": "2023-06-01T10:30:00Z",
      "lastModified": "2023-06-01T17:45:00Z",
      "configurationVersion": 1
    }
  },
  "settings": {
    "defaultLab": "Frank",
    "defaultInstitution": "University of California, San Francisco",
    "defaultExperimenters": ["Guidera, Jennifer"],
    "autoSaveInterval": 30000,
    "shadowExportEnabled": true
  }
}
```
