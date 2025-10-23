# UX Review: rec_to_nwb_yaml_creator

**Review Date:** 2025-10-23
**Application:** React-based YAML configuration generator for neuroscience data conversion
**Reviewer:** UX Expert Agent
**Context:** Scientific researchers spend 30+ minutes filling complex forms for NWB file conversion. Data quality is critical as errors propagate to Spyglass database affecting downstream analyses.

---

## Executive Summary

This application provides essential functionality for neuroscientists to generate metadata configuration files. While the core functionality is solid, there are significant UX issues that create friction for users, particularly around error messaging, progress feedback, and risk of data loss. The application lacks guidance for first-time users and has confusing validation messages that don't help users recover from errors.

**Overall Rating:** NEEDS_POLISH

The application is functional but requires UX refinements before it can be considered user-ready. Critical issues around data loss prevention and error messaging must be addressed. Many improvements are straightforward and will dramatically improve user confidence and efficiency.

**Key Findings:**

- **P0 Issues:** 6 critical blockers (data loss risks, missing progress feedback, confusing errors)
- **P1 Issues:** 12 major usability problems (poor guidance, workflow friction)
- **P2 Issues:** 8 polish opportunities (minor improvements)
- **Positive Patterns:** 5 well-designed features worth replicating

---

## Critical UX Issues (P0 - Must Fix)

### 1. No Auto-Save or Data Loss Prevention

**Location:** App.js (entire form)
**Impact:** Users can lose 30+ minutes of work with one accidental browser close, navigation, or refresh.

**Problem:**

- No warning when navigating away with unsaved changes
- No browser localStorage backup
- No recovery mechanism if browser crashes
- Users may think data is "saved" because they filled it out

**Evidence:**

```javascript
// App.js - No beforeunload handler present
// No localStorage persistence anywhere in codebase
```

**User Impact:** CRITICAL - Data loss is unacceptable in scientific workflows. Users will abandon the tool after losing work once.

**Recommendations:**

1. Add `beforeunload` warning:

```javascript
useEffect(() => {
  const handleBeforeUnload = (e) => {
    if (hasUnsavedChanges(formData, defaultYMLValues)) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [formData]);
```

2. Implement localStorage auto-save every 30 seconds:

```javascript
useEffect(() => {
  const autoSave = setInterval(() => {
    localStorage.setItem('nwb_form_backup', JSON.stringify({
      data: formData,
      timestamp: Date.now()
    }));
  }, 30000);
  return () => clearInterval(autoSave);
}, [formData]);
```

3. Add recovery UI on mount:

```javascript
useMount(() => {
  const backup = localStorage.getItem('nwb_form_backup');
  if (backup) {
    const { data, timestamp } = JSON.parse(backup);
    const age = Date.now() - timestamp;
    if (age < 24 * 60 * 60 * 1000) { // 24 hours
      if (window.confirm(`Found auto-saved data from ${new Date(timestamp).toLocaleString()}. Restore?`)) {
        setFormData(data);
      }
    }
  }
});
```

4. Add visual indicator: "Auto-saved at [time]" in footer

---

### 2. Destructive Actions Without Adequate Protection

**Location:** App.js lines 396, 411, 767
**Impact:** Users can accidentally delete complex configurations requiring reconstruction.

**Problem:**

```javascript
// Current implementation - generic confirm dialogs
const removeArrayItem = (index, key) => {
  if (window.confirm(`Remove index ${index} from ${key}?`)) {
    // deletion happens
  }
};
```

**Issues:**

- "Remove index 3 from electrode_groups?" is not meaningful (what is index 3?)
- No indication of what will be lost (including associated ntrode maps)
- "Reset" button clears entire 30-minute form with one click
- Undo is impossible after confirmation

**User Impact:** CRITICAL - Accidental deletions force users to reconstruct complex configurations from memory.

**Recommendations:**

1. Make confirmation dialogs descriptive:

```javascript
const removeElectrodeGroupItem = (index, key) => {
  const item = formData[key][index];
  const ntrodeCount = formData.ntrode_electrode_group_channel_map
    .filter(n => n.electrode_group_id === item.id).length;

  const message = `Remove electrode group "${item.description || item.id}"?\n\n` +
    `This will also delete:\n` +
    `- ${ntrodeCount} associated ntrode channel maps\n\n` +
    `This action cannot be undone.`;

  if (window.confirm(message)) {
    // deletion
  }
};
```

2. Add "Recent Deletions" undo stack (store last 5):

```javascript
const [deletionHistory, setDeletionHistory] = useState([]);

const removeArrayItemWithUndo = (index, key) => {
  const deleted = { index, key, data: formData[key][index], timestamp: Date.now() };
  setDeletionHistory([deleted, ...deletionHistory.slice(0, 4)]);
  // perform deletion
};

// Add "Undo" button that appears for 10 seconds after deletion
```

3. Reset button should require typing confirmation:

```javascript
const clearYMLFile = (e) => {
  e.preventDefault();
  const confirmation = window.prompt(
    'This will delete ALL form data. Type DELETE to confirm:'
  );
  if (confirmation === 'DELETE') {
    setFormData(structuredClone(defaultYMLValues));
  }
};
```

---

### 3. No Progress Indication for File Operations

**Location:** App.js importFile() (lines 80-154), generateYMLFile() (lines 652-678)
**Impact:** Users don't know if the app is working or frozen during YAML import/validation.

**Problem:**

- File import performs validation synchronously with no feedback
- Large YAML files may take seconds to parse/validate
- Users may click multiple times thinking it failed
- No indication validation is happening

**Current flow:**

```
User selects file → [BLACK BOX] → Alert with errors OR form populates
```

**User Impact:** CRITICAL - Users don't know if import succeeded, is processing, or failed.

**Recommendations:**

1. Add loading state and spinner:

```javascript
const [isImporting, setIsImporting] = useState(false);

const importFile = async (e) => {
  e.preventDefault();
  setIsImporting(true);
  setFormData(structuredClone(emptyFormData));

  const file = e.target.files[0];
  if (!file) {
    setIsImporting(false);
    return;
  }

  try {
    const text = await file.text();
    const jsonFileContent = YAML.parse(text);

    // Show progress for validation
    setImportStatus('Validating against schema...');
    await new Promise(resolve => setTimeout(resolve, 50)); // Let UI update

    const validation = jsonschemaValidation(jsonFileContent, schema.current);
    // ... rest of validation

    setImportStatus('Complete');
  } catch (error) {
    alert(`Failed to import file: ${error.message}`);
  } finally {
    setIsImporting(false);
  }
};
```

2. Display progress UI:

```jsx
{isImporting && (
  <div className="import-overlay">
    <div className="spinner"></div>
    <p>{importStatus || 'Importing file...'}</p>
  </div>
)}
```

3. Show success confirmation:

```javascript
// After successful import
showToast('✓ File imported successfully. Found 3 electrode groups, 12 cameras.', 'success');
```

---

### 4. Validation Errors Are Confusing and Non-Actionable

**Location:** App.js showErrorMessage() (lines 465-513)
**Impact:** Users cannot fix their mistakes because error messages don't explain WHAT, WHY, or HOW.

**Current Error Messages:**

```
"must match pattern "^.+$"" → User has no idea what this means
"Date of birth needs to comply with ISO 8061 format" → Which format? Example?
"Data is not valid - \n Key: electrode_groups, 0, description. | Error: must be string"
  → Not helpful for non-programmers
```

**Problems:**

- Technical JSON schema errors shown directly to users
- No examples of correct format
- No explanation of why validation failed
- Pattern regex shown verbatim (unintelligible)
- Error doesn't point to specific field visually

**User Impact:** CRITICAL - Users get stuck and cannot proceed because they don't understand how to fix errors.

**Recommendations:**

1. Create user-friendly error message translator:

```javascript
const getUserFriendlyError = (error) => {
  const { message, instancePath, params } = error;
  const fieldName = instancePath.split('/').pop().replace(/_/g, ' ');

  // Error code → User-friendly message map
  const errorMap = {
    'must match pattern "^.+$"': {
      message: `${fieldName} cannot be empty or contain only whitespace`,
      fix: `Enter a valid ${fieldName} value`
    },
    'must be string': {
      message: `${fieldName} must be text, not a number`,
      fix: `Remove any quotes or special characters`
    },
    'must be number': {
      message: `${fieldName} must be a number`,
      fix: `Enter only digits (e.g., 123 or 45.6)`
    },
    'must be integer': {
      message: `${fieldName} must be a whole number`,
      fix: `Remove decimal points (e.g., use 5 instead of 5.0)`
    }
  };

  // Special cases
  if (instancePath.includes('date_of_birth')) {
    return {
      message: 'Date of birth must use ISO 8601 format',
      fix: 'Use the date picker or enter: YYYY-MM-DD (e.g., 2020-03-15)',
      example: '2020-03-15'
    };
  }

  return errorMap[message] || {
    message: message,
    fix: 'Please check this field'
  };
};
```

2. Display errors with context and recovery steps:

```javascript
const showErrorMessage = (error) => {
  const friendly = getUserFriendlyError(error);
  const element = document.querySelector(`#${id}`);

  if (element?.tagName === 'INPUT') {
    const message = `${friendly.message}\n\nHow to fix: ${friendly.fix}`;
    showCustomValidityError(element, message);
    return;
  }

  // For non-input elements, show modal with rich formatting
  showErrorModal({
    title: 'Validation Error',
    field: titleCase(instancePath.replaceAll('/', ' ')),
    problem: friendly.message,
    solution: friendly.fix,
    example: friendly.example
  });
};
```

3. Add error summary panel instead of alert:

```jsx
{validationErrors.length > 0 && (
  <div className="error-summary">
    <h3>Please fix these {validationErrors.length} errors:</h3>
    {validationErrors.map((error, i) => (
      <div key={i} className="error-item">
        <strong>{error.field}</strong>
        <p>{error.problem}</p>
        <p className="fix">→ {error.solution}</p>
        <button onClick={() => scrollToField(error.fieldId)}>Go to field</button>
      </div>
    ))}
  </div>
)}
```

---

### 5. No Visual Indication of Required vs. Optional Fields

**Location:** Throughout form (all input components)
**Impact:** Users don't know which fields they must complete, wasting time on optional fields.

**Problem:**

- Required fields marked with `required` HTML attribute (only shows on submit)
- No visual distinction between required and optional
- Users discover required fields only after trying to submit
- Form sections look equally important regardless of requirements

**User Impact:** CRITICAL - Users waste time on optional fields and get frustrated by unexpected validation errors.

**Recommendations:**

1. Add consistent visual indicators:

```jsx
// InputElement.jsx
const InputElement = (prop) => {
  const { title, required, placeholder, ...rest } = prop;

  return (
    <label className="container" htmlFor={id}>
      <div className="item1">
        {title}
        {required && <span className="required-indicator" title="Required field">*</span>}
        <InfoIcon infoText={placeholder} />
      </div>
      <div className="item2">
        <input
          className={`base-width ${readOnly ? 'gray-out' : ''} ${required ? 'required-field' : ''}`}
          {...rest}
        />
      </div>
    </label>
  );
};
```

2. Add CSS styling:

```scss
.required-indicator {
  color: #d93025;
  font-weight: bold;
  margin-left: 4px;
}

.required-field {
  border-left: 3px solid #d93025;
}

.required-field:valid {
  border-left: 3px solid #1e8e3e; // Green when filled
}
```

3. Add legend at top of form:

```jsx
<div className="form-legend">
  <span><span className="required-indicator">*</span> = Required field</span>
  <span>All other fields are optional</span>
</div>
```

4. Show completion progress:

```jsx
<div className="form-progress">
  <p>Form completion: {completedRequiredFields}/{totalRequiredFields} required fields</p>
  <div className="progress-bar">
    <div className="progress-fill" style={{ width: `${completionPercent}%` }}></div>
  </div>
</div>
```

---

### 6. Filename Placeholder is Confusing

**Location:** App.js line 662
**Impact:** Users don't understand what to do with the generated file.

**Problem:**

```javascript
const fileName = `{EXPERIMENT_DATE_in_format_mmddYYYY}_${subjectId}_metadata.yml`;
```

Generated filename: `{EXPERIMENT_DATE_in_format_mmddYYYY}_rat01_metadata.yml`

**Issues:**

- Placeholder `{EXPERIMENT_DATE_in_format_mmddYYYY}` left in filename
- Users must manually rename file (error-prone)
- Naming convention critical for trodes_to_nwb but not explained
- Date format ambiguous (mmddYYYY vs MM/DD/YYYY)

**User Impact:** CRITICAL - Incorrect filenames break the trodes_to_nwb pipeline. Users won't know files failed until much later.

**Recommendations:**

1. Add date field to form or infer from session data:

```javascript
// Add to form near top
<InputElement
  id="experiment_date"
  type="date"
  name="experiment_date"
  title="Experiment Date"
  required
  placeholder="Date of experiment recording (used in filename)"
  onBlur={(e) => onBlur(e)}
/>
```

2. Generate proper filename:

```javascript
const generateYMLFile = (e) => {
  e.preventDefault();
  const form = structuredClone(formData);

  // Validate date is present
  if (!form.experiment_date) {
    alert('Please specify Experiment Date before generating file.');
    document.querySelector('#experiment_date')?.focus();
    return;
  }

  const validation = jsonschemaValidation(form);
  if (!validation.isValid) {
    // handle errors
    return;
  }

  // Format date correctly: mmddYYYY
  const date = new Date(form.experiment_date);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  const dateStr = `${month}${day}${year}`;

  const subjectId = form.subject.subject_id.toLowerCase();
  const fileName = `${dateStr}_${subjectId}_metadata.yml`;

  const yAMLForm = convertObjectToYAMLString(form);
  createYAMLFile(fileName, yAMLForm);

  // Show success with filename
  showToast(`✓ Generated: ${fileName}`, 'success', 5000);
};
```

3. Add pre-generation filename preview:

```jsx
<div className="filename-preview">
  <label>Generated filename will be:</label>
  <code>{generateFileName(formData)}</code>
  {!formData.experiment_date && (
    <span className="warning">⚠ Requires Experiment Date</span>
  )}
</div>
```

---

## High Priority Issues (P1 - Should Fix)

### 7. No First-Time User Guidance

**Location:** App.js (overall application)
**Impact:** New users don't know where to start or what order to complete fields.

**Problem:**

- Application opens to empty form with 20+ collapsible sections
- No tutorial, welcome message, or getting started guide
- No indication of recommended workflow (top to bottom? required first?)
- Users don't know if they can skip sections

**Recommendations:**

1. Add first-time welcome modal:

```jsx
{isFirstVisit && (
  <WelcomeModal onClose={() => setIsFirstVisit(false)}>
    <h2>Welcome to NWB YAML Creator</h2>
    <p>This tool helps you generate metadata files for neuroscience data conversion.</p>
    <h3>Quick Start:</h3>
    <ol>
      <li>Fill out required fields (marked with *)</li>
      <li>Add electrode groups and cameras as needed</li>
      <li>Click "Generate YML File" when complete</li>
    </ol>
    <p>Expected time: 20-30 minutes</p>
    <button onClick={startTour}>Take Tour</button>
    <button onClick={loadExample}>Load Example</button>
  </WelcomeModal>
)}
```

2. Add "Load Example" button that populates with sample data
3. Add optional guided tour using intro.js or similar
4. Add "?" help button in header linking to documentation

---

### 8. Import Errors Are Shown as Plain Alert

**Location:** App.js line 148
**Impact:** Users lose error details when alert is dismissed, can't copy/paste for troubleshooting.

**Problem:**

```javascript
window.alert(`Entries Excluded\n\n${allErrorMessages.join('\n')}`);
```

**Issues:**

- Alert can't be scrolled if many errors
- Can't copy error text easily
- Disappears when dismissed (no way to review)
- Blocks entire UI until dismissed

**Recommendations:**

1. Replace alert with modal:

```jsx
<ImportErrorModal
  isOpen={importErrors.length > 0}
  errors={importErrors}
  onClose={() => setImportErrors([])}
>
  <h3>Import Issues Found</h3>
  <p>{importErrors.length} fields were excluded due to validation errors:</p>
  <div className="error-list">
    {importErrors.map((err, i) => (
      <div key={i} className="error-detail">
        <code>{err}</code>
      </div>
    ))}
  </div>
  <button onClick={() => copyToClipboard(importErrors.join('\n'))}>
    Copy Errors
  </button>
</ImportErrorModal>
```

---

### 9. Device Type Selection Unclear

**Location:** App.js line 2594-2608, electrode_groups section
**Impact:** Users select wrong device type, breaking downstream conversion.

**Problem:**

- Device type dropdown shows technical IDs like "128c-4s8mm6cm-20um-40um-sl"
- No description of what each device is
- Users must know probe types from external documentation
- Wrong selection causes data loss in Spyglass (probe_id becomes NULL)

**Recommendations:**

1. Add descriptive labels:

```javascript
const deviceTypes = () => [
  { value: 'tetrode_12.5', label: 'Tetrode (4ch, 12.5μm spacing)' },
  { value: 'A1x32-6mm-50-177-H32_21mm', label: 'Single shank 32ch (NeuroNexus A1x32)' },
  { value: '128c-4s8mm6cm-20um-40um-sl', label: '128ch 4-shank (8mm, 20/40μm spacing)' },
  // ... etc
];
```

2. Add preview of channel configuration:

```jsx
{selectedDeviceType && (
  <div className="device-preview">
    <p>This device has:</p>
    <ul>
      <li>{getChannelCount(selectedDeviceType)} channels</li>
      <li>{getShankCount(selectedDeviceType)} shanks</li>
    </ul>
  </div>
)}
```

3. Add warning for unknown types:

```jsx
{selectedDeviceType && !isKnownInSpyglass(selectedDeviceType) && (
  <div className="warning-box">
    ⚠ Warning: This device type may not be registered in Spyglass database.
    Contact your database administrator before proceeding.
  </div>
)}
```

---

### 10. Brain Region Location Field Allows Inconsistent Capitalization

**Location:** App.js line 2580-2593, electrode_groups location field
**Impact:** Creates duplicate brain region entries in Spyglass database.

**Problem:**

- Location is free text with autocomplete
- Users can type "CA1", "ca1", "Ca1" - all different in database
- No validation of capitalization consistency
- DataList suggestions may not match what user types

**Recommendations:**

1. Enforce consistent capitalization on blur:

```javascript
const onLocationBlur = (e, metaData) => {
  const { value } = e.target;
  const normalized = normalizeBrainRegion(value); // e.g., always Title Case

  if (value !== normalized) {
    showToast(`Location normalized to: "${normalized}"`, 'info', 3000);
  }

  updateFormData('location', normalized, metaData.key, metaData.index);
};

const normalizeBrainRegion = (region) => {
  // Lookup table for standard names
  const standardNames = {
    'ca1': 'CA1',
    'ca2': 'CA2',
    'ca3': 'CA3',
    'dg': 'DG',
    'pfc': 'PFC',
    // ... etc
  };

  return standardNames[region.toLowerCase()] || titleCase(region);
};
```

2. Show validation warning:

```jsx
{location && !isStandardBrainRegion(location) && (
  <div className="validation-warning">
    ⓘ Using non-standard region name: "{location}".
    Did you mean: {getSuggestions(location).join(', ')}?
  </div>
)}
```

---

### 11. Duplicate Button Doesn't Explain What Gets Duplicated

**Location:** ArrayItemControl.jsx line 25, electrode groups
**Impact:** Users don't know if duplicating electrode group includes ntrode maps.

**Problem:**

- "Duplicate" button has no tooltip or explanation
- For electrode groups, ntrode maps are duplicated (good!)
- But users don't discover this until after clicking
- No indication of what will be cloned vs. what needs updating

**Recommendations:**

1. Add informative tooltip:

```jsx
<button
  type="button"
  title="Create a copy of this item with incremented ID. For electrode groups, associated ntrode maps will also be duplicated."
  onClick={() => duplicateArrayItem(index, keyValue)}
>
  Duplicate
</button>
```

2. Show confirmation with details:

```javascript
const duplicateElectrodeGroupItem = (index, key) => {
  const item = formData[key][index];
  const ntrodeCount = formData.ntrode_electrode_group_channel_map
    .filter(n => n.electrode_group_id === item.id).length;

  const message = `Duplicate electrode group "${item.description || item.id}"?\n\n` +
    `This will create:\n` +
    `- 1 new electrode group (ID will be incremented)\n` +
    `- ${ntrodeCount} new ntrode channel maps\n\n` +
    `You can then modify the copy as needed.`;

  if (window.confirm(message)) {
    // perform duplication
    const newGroup = /* ... duplication logic ... */;

    // Scroll to new item and highlight
    setTimeout(() => {
      const element = document.querySelector(`#electrode_group_item_${newGroup.id}-area`);
      element?.scrollIntoView({ behavior: 'smooth' });
      element?.classList.add('highlight-region');
    }, 100);
  }
};
```

---

### 12. No Indication Which Fields Affect Downstream Pipeline

**Location:** Throughout form
**Impact:** Users don't know critical fields like device_type, location that break Spyglass ingestion.

**Problem:**

- All fields look equally important
- Critical fields (device_type, location, subject_id) aren't marked as such
- Users don't know some validation happens in trodes_to_nwb, not here
- No link to documentation about Spyglass requirements

**Recommendations:**

1. Add criticality indicators:

```jsx
<DataListElement
  id={`electrode_groups-location-${index}`}
  name="location"
  title="Location"
  critical={true} // New prop
  criticalReason="Must match Spyglass brain regions. Inconsistent capitalization creates database duplicates."
  placeholder="Type to find a location"
  dataItems={locations()}
  onBlur={(e) => itemSelected(e, { key, index })}
/>
```

2. Add warnings for critical fields:

```jsx
// In InputElement component
{critical && (
  <div className="critical-field-notice">
    <span className="critical-badge">Critical</span>
    <InfoIcon infoText={criticalReason} />
  </div>
)}
```

3. Add "Validation Summary" section before Generate button:

```jsx
<div className="validation-summary">
  <h3>Before You Generate:</h3>
  <div className={locationValid ? 'check-pass' : 'check-fail'}>
    {locationValid ? '✓' : '✗'} All electrode locations use standard names
  </div>
  <div className={deviceTypeValid ? 'check-pass' : 'check-fail'}>
    {deviceTypeValid ? '✓' : '✗'} All device types registered in Spyglass
  </div>
  <div className={requiredFieldsValid ? 'check-pass' : 'check-fail'}>
    {requiredFieldsValid ? '✓' : '✗'} All required fields completed
  </div>
</div>
```

---

### 13. nTrode Channel Map Interface Is Confusing

**Location:** ChannelMap.jsx, especially lines 75-125
**Impact:** Users don't understand the mapping and set incorrect channel assignments.

**Problem:**

- Label says "Map" with InfoIcon but doesn't explain the concept
- Interface shows `label: dropdown` but relationship unclear
- "Right Hand Side is expected mapping. Left Hand Side is actual mapping" is backwards from UI
- Dropdown shows same number for option value and displayed text
- -1 value (empty) displays as blank, not obviously "unmapped"

**Current UI:**

```
Map [info icon]
0: [dropdown: 0, 1, 2, 3, -1]
1: [dropdown: 0, 1, 2, 3, -1]
...
```

**User confusion:**

- "What does 0 → 0 mean?"
- "Why would I select -1?"
- "Is the left side electrode or channel?"

**Recommendations:**

1. Improve labels and explanation:

```jsx
<div className="ntrode-map-header">
  <h4>Channel Mapping</h4>
  <p className="help-text">
    Map hardware channels to electrode positions.
    Left: Electrode position (0-3), Right: Hardware channel number
  </p>
  <details className="mapping-help">
    <summary>How does this work?</summary>
    <p>
      Your probe has physical electrodes (0, 1, 2, 3...) that are connected
      to hardware channels in your recording system. If wiring is not
      sequential, specify the mapping here.
    </p>
    <p><strong>Example:</strong> If electrode 0 is wired to channel 2, select "2" from the dropdown for electrode 0.</p>
  </details>
</div>
```

2. Make dropdown values more explicit:

```jsx
<select /* ... */>
  {options.map((option) => (
    <option value={option}>
      {option === -1
        ? '(unmapped)'
        : `Channel ${option}`}
    </option>
  ))}
</select>
```

3. Add visual diagram:

```jsx
<div className="mapping-diagram">
  <div className="electrode-side">
    <div>Electrode 0</div>
    <div>Electrode 1</div>
  </div>
  <div className="arrow">→</div>
  <div className="channel-side">
    <div>Channel {map[0] === -1 ? '?' : map[0]}</div>
    <div>Channel {map[1] === -1 ? '?' : map[1]}</div>
  </div>
</div>
```

4. Add validation for unmapped channels:

```javascript
// Before form submission
const unmappedChannels = Object.entries(map)
  .filter(([_, channel]) => channel === -1)
  .map(([electrode, _]) => electrode);

if (unmappedChannels.length > 0) {
  const message = `Warning: Electrodes ${unmappedChannels.join(', ')} are unmapped. ` +
    `These electrodes will not record data. Continue anyway?`;
  if (!window.confirm(message)) {
    return;
  }
}
```

---

### 14. Bad Channels Checkbox List Hard to Parse

**Location:** ChannelMap.jsx line 59-74
**Impact:** Users can't quickly identify which channels are marked bad.

**Problem:**

- Checkboxes displayed inline with no visual grouping
- Hard to see which are checked at a glance
- No summary count (e.g., "2 bad channels")
- No visual distinction from regular form checkboxes

**Recommendations:**

1. Add visual summary:

```jsx
<CheckboxList
  id={`ntrode_electrode_group_channel_map-bad_channels-${index}`}
  title={`Bad Channels ${item.bad_channels?.length > 0 ? `(${item.bad_channels.length} marked)` : ''}`}
  /* ... */
/>
```

2. Style bad channel checkboxes differently:

```scss
.bad-channels-list {
  .checkbox-list-item {
    input:checked + label {
      color: #d93025;
      font-weight: bold;
      text-decoration: line-through;
    }
  }
}
```

3. Add "Select All" / "Clear All" helpers:

```jsx
<div className="bad-channels-controls">
  <button type="button" onClick={() => selectAllBadChannels(index)}>
    Mark All Bad
  </button>
  <button type="button" onClick={() => clearBadChannels(index)}>
    Clear Bad Channels
  </button>
</div>
```

---

### 15. Form Sections Auto-Open on Page Load (Performance Issue)

**Location:** App.js, all `<details open>` tags
**Impact:** Page load is slow and overwhelming with all sections expanded.

**Problem:**

```jsx
<details open> // Every section starts open
  <summary>Electrode Groups</summary>
  ...
</details>
```

**Issues:**

- Rendering 20+ open sections with nested forms is slow
- Users see overwhelming wall of fields
- Must manually close sections they don't need
- Browser scroll position jumps unpredictably

**Recommendations:**

1. Only open first section by default:

```jsx
<details open={index === 0}>
  <summary>{titleCase(key.replaceAll('_', ' '))}</summary>
  ...
</details>
```

2. Add "Expand All / Collapse All" toggle:

```jsx
<div className="form-controls">
  <button onClick={toggleAllSections}>
    {allExpanded ? 'Collapse All' : 'Expand All'}
  </button>
</div>
```

3. Remember user's expansion preferences in localStorage:

```javascript
const [expandedSections, setExpandedSections] = useState(() => {
  const saved = localStorage.getItem('expanded_sections');
  return saved ? JSON.parse(saved) : ['subject']; // Default to just subject
});

useEffect(() => {
  localStorage.setItem('expanded_sections', JSON.stringify(expandedSections));
}, [expandedSections]);
```

---

### 16. Camera/Task Epoch Dependencies Not Obvious

**Location:** App.js lines 818-859, useEffect tracking dependencies
**Impact:** Users delete cameras/tasks and dependent fields silently clear.

**Problem:**

```javascript
// When task epoch deleted, associated_files.task_epochs silently cleared
for (i = 0; i < formData.associated_files.length; i += 1) {
  if (!taskEpochs.includes(formData.associated_files[i].task_epochs)) {
    formData.associated_files[i].task_epochs = '';
  }
}
```

**Issues:**

- No warning before deletion cascade
- No indication which fields will be affected
- User may not notice cleared fields until much later
- Undo is impossible

**Recommendations:**

1. Show dependency warning before deletion:

```javascript
const removeArrayItem = (index, key) => {
  const dependencies = findDependencies(formData, key, index);

  let message = `Remove index ${index} from ${key}?`;

  if (dependencies.length > 0) {
    message += `\n\nThis will also clear:\n` +
      dependencies.map(d => `- ${d.field} in ${d.section}`).join('\n');
  }

  if (window.confirm(message)) {
    // perform deletion
  }
};
```

2. Add visual links showing dependencies:

```jsx
// In camera definition
<div className="dependency-info">
  ⓘ This camera is used by:
  <ul>
    {getTasksUsingCamera(camera.id).map(task => (
      <li key={task}>Task: {task}</li>
    ))}
    {getVideoFilesUsingCamera(camera.id).map(vid => (
      <li key={vid}>Video: {vid}</li>
    ))}
  </ul>
</div>
```

---

### 17. Info Icons Don't Scale with Form Density

**Location:** InfoIcon.jsx, used throughout form
**Impact:** Info tooltips are unreadable on hover, critical information hidden.

**Problem:**

- InfoIcon uses `title` attribute for hover text
- Browser tooltip is tiny, single-line, disappears quickly
- Long placeholder text gets truncated
- No way to click/persist tooltip to read fully
- Mobile users can't hover at all

**Current implementation:**

```jsx
<span title={infoText}>
  <FontAwesomeIcon icon="circle-info" size="2xs" />
</span>
```

**Recommendations:**

1. Replace with interactive tooltip component:

```jsx
const InfoIcon = ({ infoText }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span
      className="info-icon-wrapper"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onClick={() => setIsOpen(!isOpen)}
    >
      <FontAwesomeIcon icon="circle-info" size="2xs" />
      {isOpen && (
        <div className="info-tooltip">
          {infoText}
          <div className="tooltip-arrow"></div>
        </div>
      )}
    </span>
  );
};
```

2. Style for readability:

```scss
.info-tooltip {
  position: absolute;
  z-index: 1000;
  background: #333;
  color: #fff;
  padding: 12px;
  border-radius: 4px;
  font-size: 14px;
  max-width: 300px;
  line-height: 1.4;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
```

3. Add "?" help button for complex sections:

```jsx
<div className="section-help">
  <button type="button" onClick={() => openHelpModal('electrode_groups')}>
    ❓ Help: Understanding Electrode Groups
  </button>
</div>
```

---

### 18. Array Item Index Display Confusing

**Location:** Throughout form, array items show "Item #1, Item #2"
**Impact:** Users don't know what "Item #3" refers to when looking at electrode groups.

**Problem:**

```jsx
<summary> Item #{index + 1} </summary> // Generic label
```

**Issues:**

- "Item #3" doesn't indicate what the item is
- When reordering/removing items, numbers change
- Hard to reference specific item in communication ("Which electrode group?")
- No persistent identifier shown

**Recommendations:**

1. Show meaningful labels:

```jsx
<summary>
  {key === 'electrode_groups'
    ? `Electrode Group ${item.id}: ${item.description || item.location || 'Unnamed'}`
    : key === 'cameras'
    ? `Camera ${item.id}: ${item.camera_name || 'Unnamed'}`
    : `Item #${index + 1}`}
</summary>
```

2. Add custom label field:

```jsx
<InputElement
  id={`${key}-label-${index}`}
  type="text"
  name="label"
  title="Label (for your reference)"
  placeholder="E.g., 'CA1 left', 'overhead camera'"
  defaultValue={item.label}
  onBlur={(e) => onBlur(e, { key, index })}
/>
```

---

## Medium Priority Issues (P2 - Consider)

### 19. Sample YAML Link Opens in New Tab Unexpectedly

**Location:** App.js line 943-950
**Impact:** Minor - Users lose context when sample opens in new tab.

**Recommendation:**
Add inline preview or download button instead of external link.

---

### 20. Generate Button Far From Top of Form

**Location:** App.js line 2736-2751
**Impact:** Minor - After filling form, users must scroll to bottom.

**Recommendation:**
Add sticky header with "Generate" button or floating action button.

---

### 21. No Keyboard Shortcuts

**Location:** Entire application
**Impact:** Minor - Power users can't use keyboard efficiently.

**Recommendations:**

- Ctrl/Cmd + S: Save to localStorage backup
- Ctrl/Cmd + Enter: Generate YAML (if form valid)
- Escape: Close modals/dropdowns
- Tab navigation through array items

---

### 22. Version Number in Footer Not Prominent

**Location:** App.js line 2760
**Impact:** Minor - Users filing bug reports don't know version.

**Recommendation:**
Move version to header and add "Copy debug info" button.

---

### 23. No Visual Feedback on Required Field Completion

**Location:** Throughout form
**Impact:** Minor - Users don't see progress toward completion.

**Recommendation:**
Add green checkmark next to completed required fields.

---

### 24. Browser Back Button Unexpected Behavior

**Location:** Client-side routing (none implemented)
**Impact:** Minor - Back button doesn't navigate form sections.

**Recommendation:**
Implement hash-based routing for sections (#subject, #cameras, etc.).

---

### 25. No Export to JSON Option

**Location:** App.js generateYMLFile()
**Impact:** Minor - Some users may prefer JSON format.

**Recommendation:**
Add "Export as JSON" button next to "Generate YML File".

---

### 26. Date Picker Defaults to Today

**Location:** InputElement.jsx date inputs
**Impact:** Minor - Experiment dates are usually in past.

**Recommendation:**
Default date inputs to 7 days ago or allow custom default.

---

## Positive Patterns (Things Done Well)

### 1. Duplicate Button for Array Items

**Location:** ArrayItemControl.jsx
**Benefit:** Saves significant time when creating similar electrode groups.

This is an excellent UX pattern that should be highlighted in documentation and preserved in future updates.

---

### 2. Dynamic Ntrode Generation from Device Type

**Location:** App.js nTrodeMapSelected() lines 292-356
**Benefit:** Automatically generates correct channel maps, preventing manual errors.

This is sophisticated automation that demonstrates deep understanding of user workflow. The auto-incrementing IDs and automatic association with electrode groups is well-designed.

---

### 3. Structured Clone for Immutability

**Location:** Throughout App.js
**Benefit:** Prevents state mutation bugs that plague many React apps.

```javascript
const form = structuredClone(formData); // Excellent practice
```

This is good defensive programming that prevents entire classes of bugs.

---

### 4. Datalist for Autocomplete

**Location:** DataListElement.jsx
**Benefit:** Provides suggestions while allowing custom values.

This is the right balance between structure and flexibility for scientific software.

---

### 5. Highlight Region on Navigation

**Location:** App.js clickNav() lines 779-804
**Benefit:** Clear feedback when using sidebar navigation.

```javascript
element.classList.add('highlight-region');
setTimeout(() => {
  element?.classList.remove('highlight-region');
}, 1000);
```

This smooth visual feedback helps users orient themselves in the long form.

---

## Recommendations Summary

### Immediate Actions (Next Sprint)

**Priority 1: Prevent Data Loss**

1. ✅ Implement auto-save to localStorage every 30 seconds
2. ✅ Add beforeunload warning for unsaved changes
3. ✅ Add recovery prompt on page load
4. ✅ Improve deletion confirmations with context
5. ✅ Add undo capability for deletions

**Priority 2: Fix Critical Errors**
6. ✅ Replace all alert() calls with proper modal components
7. ✅ Rewrite error messages to be user-friendly (WHAT/WHY/HOW)
8. ✅ Add error translation layer for JSON schema errors
9. ✅ Fix filename generation to use real date
10. ✅ Add progress indicators for import/export

**Priority 3: Improve Guidance**
11. ✅ Add visual indicators for required vs optional fields
12. ✅ Create first-time user welcome/tutorial
13. ✅ Add field criticality warnings for Spyglass-critical fields
14. ✅ Improve nTrode channel map explanation

### Short-Term Improvements (1-2 Sprints)

15. ✅ Normalize brain region capitalization
16. ✅ Add device type descriptions and previews
17. ✅ Show dependency warnings before deletion
18. ✅ Improve info icon tooltips (clickable, readable)
19. ✅ Add meaningful labels to array items
20. ✅ Default sections to collapsed for performance
21. ✅ Add form completion progress indicator

### Long-Term Enhancements (Future)

22. ✅ Implement comprehensive validation preview before generation
23. ✅ Add guided mode with step-by-step wizard
24. ✅ Build interactive examples/templates library
25. ✅ Add real-time validation with Spyglass database
26. ✅ Implement keyboard shortcuts for power users
27. ✅ Add accessibility audit and WCAG compliance
28. ✅ Build mobile-responsive layout

---

## Testing Recommendations

Before considering UX work complete, test with real users:

### Usability Test Scenarios

1. **First-time user test**: Can they complete form without documentation?
2. **Error recovery test**: Give them invalid YAML - can they fix errors?
3. **Data loss test**: Ask them to refresh browser mid-session - do they lose work?
4. **Complex configuration test**: Multiple electrode groups with different probes
5. **Import existing test**: Can they successfully import and modify existing file?

### Success Metrics

- Time to complete form: Target <20 minutes for experienced users
- Error rate: <5% of generated files fail trodes_to_nwb validation
- User confidence: >80% feel confident file is correct before generating
- Abandonment rate: <10% abandon form before completion
- Recovery rate: >95% successfully fix validation errors without help

---

## Conclusion

This application provides critical functionality for neuroscience workflows and has solid technical foundations. However, the UX needs refinement before it can be considered truly user-ready for scientists who may not have programming experience.

**The 6 critical P0 issues must be addressed before wider deployment**, particularly data loss prevention and error message clarity. These issues will cause user frustration and abandonment.

**The P1 issues should be addressed in the next 1-2 development cycles** to improve user confidence and reduce support burden.

With these improvements, this tool can become a reliable, trusted part of the neuroscience data pipeline. The positive patterns already present (auto-generation of ntrode maps, structured clone immutability, duplicate functionality) show that the development team understands both the domain and good UX principles.

**Estimated effort to reach USER_READY status:** 3-4 sprints (assuming 2-week sprints)

- Sprint 1: Data loss prevention + critical errors (P0: items 1-5)
- Sprint 2: Error messaging + guidance (P0: items 6 + P1: items 7-12)
- Sprint 3: Field improvements + dependencies (P1: items 13-18)
- Sprint 4: Polish + testing (P2 items + usability testing)

**Next step:** Prioritize the Critical UX Issues section and begin implementation of auto-save and error message improvements.

---

**Review completed:** 2025-10-23
**Files reviewed:** 12 core application files
**Issues identified:** 26 across 3 priority levels
**Positive patterns:** 5
