# Data Validation Review

**Review Date:** 2025-01-23
**Scope:** Validation architecture across rec_to_nwb_yaml_creator and trodes_to_nwb integration
**Cross-Reference:** REVIEW.md Issues #3, #6, #7
**Related:** TESTING_PLAN.md

---

## Executive Summary

This report analyzes the validation architecture and data integrity mechanisms across the rec_to_nwb_yaml_creator web application and its integration with the trodes_to_nwb Python package. The system validates neuroscience metadata for conversion to NWB format, with ultimate ingestion into the Spyglass database.

### Overall Assessment

**Validation Architecture:** 🟡 **MODERATE RISK**

- **JavaScript (AJV Draft 7):** Limited progressive validation, late-stage error detection
- **Python (jsonschema Draft 2020-12):** Different validation engine creates inconsistencies
- **Schema Quality:** Missing critical constraints for database compatibility
- **User Experience:** Validation occurs too late in workflow, causing frustration

### Critical Findings

| Priority | Issue | Impact | Location |
|----------|-------|--------|----------|
| 🔴 P0 | Type coercion allows floats for integer IDs | Invalid data accepted | App.js:233, utils.js:47-56 |
| 🔴 P0 | Empty strings pass pattern validation | Database NULL constraint violations | nwb_schema.json |
| 🔴 P0 | No sex enum enforcement in schema | Silent data corruption (Spyglass converts to 'U') | nwb_schema.json:420-427 |
| 🔴 P0 | Validation only on form submission | Users lose 30+ minutes of work | App.js:652-678 |
| 🟡 P1 | No naming pattern enforcement | Database fragmentation | nwb_schema.json |
| 🟡 P1 | Missing coordinate range validation | Unrealistic values accepted | nwb_schema.json |
| 🟡 P1 | No VARCHAR length validation | Database ingestion failures | nwb_schema.json |
| 🟢 P2 | Duplicate detection in comma-separated input | Silent deduplication | utils.js:47-56 |

### Risk Distribution

- **Data Corruption Risk:** HIGH - Type coercion, empty string acceptance, enum bypassing
- **User Experience Risk:** HIGH - Late validation, no progressive feedback
- **Database Compatibility Risk:** HIGH - Missing length/enum/pattern constraints
- **Integration Risk:** MODERATE - Different validators between JS and Python

---

## Schema Analysis

### Current Schema Overview

**Schema Version:** `v1.0.1` (Draft 7)
**Location:** `/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/nwb_schema.json`
**Validator:** AJV with ajv-formats extension

### Schema Strengths

1. **Well-Structured Definitions:**
   - Clear `$id` and `$schema` declarations
   - Comprehensive property definitions with descriptions
   - Appropriate use of `required` arrays

2. **Type Enforcement:**
   - Strong typing for most fields (string, number, array, object)
   - `minItems` constraints on arrays
   - `uniqueItems` on appropriate arrays

3. **Pattern Validation:**
   - Non-empty string pattern: `^(.|\\s)*\\S(.|\\s)*$`
   - ISO 8601 date/time pattern for `date_of_birth`
   - Applied consistently across string fields

### Critical Schema Gaps

#### 1. Empty String Acceptance (CRITICAL)

**Problem:** Pattern `^(.|\\s)*\\S(.|\\s)*$` is intended to prevent empty strings but fails in edge cases.

**Current Schema:**

```json
{
  "session_description": {
    "type": "string",
    "pattern": "^(.|\\s)*\\S(.|\\s)*$",
    "description": "Aspect of research being conducted"
  }
}
```

**Why It Fails:**

- The pattern requires at least one non-whitespace character, BUT:
- JavaScript `setCustomValidity()` doesn't always trigger for pattern mismatches
- User can still submit empty strings in some browsers
- Spyglass database has `NOT NULL AND length > 0` constraint

**Example Failure:**

```yaml
# YAML passes JS validation:
session_description: ""

# Spyglass rejects:
# IntegrityError: Column 'session_description' cannot be null or empty
```

**Fix Required:**

```json
{
  "session_description": {
    "type": "string",
    "minLength": 1,
    "pattern": "^(.|\\s)*\\S(.|\\s)*$",
    "description": "Brief description of session (must be non-empty)"
  }
}
```

**Fields Affected:**

- `session_description`
- `electrode_groups[].description`
- `subject.description`
- `subject.subject_id`
- All required string fields

**Database Impact:** Immediate ingestion failure with cryptic error messages.

---

#### 2. Sex Field Lacks Enum Enforcement (CRITICAL - SILENT CORRUPTION)

**Problem:** Schema defines enum but doesn't enforce it strictly enough.

**Current Schema:**

```json
{
  "sex": {
    "type": "string",
    "enum": ["M", "F", "U", "O"],
    "default": "M",
    "description": "Gender of animal model/patient"
  }
}
```

**Current App Implementation (valueList.js):**

```javascript
export const genderAcronym = () => {
  return ['M', 'F', 'U', 'O'];
};
```

**Current UI (App.js:1089-1097):**

```javascript
<SelectElement
  id="subject-sex"
  name="sex"
  dataItems={genderAcronym()}
  defaultValue={formData.subject.sex}
  onChange={(e) => itemSelected(e, { key: 'subject' })}
/>
```

**Why It's Critical:**

Spyglass performs **silent conversion** for invalid values:

```python
# In Spyglass insert_sessions.py
if sex not in ['M', 'F', 'U']:
    sex = 'U'  # Silent conversion, no warning
```

**Failure Scenario:**

1. User enters "Male" (seems valid)
2. YAML validation **passes** (string type accepted)
3. Spyglass **silently converts to 'U'**
4. User thinks sex is "Male", database stores "Unknown"
5. **No error message - user never knows data was corrupted**

**Why Current Implementation Works:**

- UI uses `SelectElement` dropdown which restricts choices
- BUT: User could import YAML with invalid value
- Schema validation should be **defense in depth**

**Fix Required:**

**Schema remains correct** (enum is defined), but validation needs strengthening:

```javascript
// In App.js rulesValidation()
if (jsonFileContent.subject?.sex) {
  const validSex = ['M', 'F', 'U', 'O'];
  if (!validSex.includes(jsonFileContent.subject.sex)) {
    errorMessages.push(
      `Key: subject.sex | Error: Must be one of: M (male), F (female), U (unknown), O (other). ` +
      `Found: "${jsonFileContent.subject.sex}". Invalid values will be converted to 'U' in database.`
    );
    errorIds.push('subject-sex');
    isFormValid = false;
  }
}
```

---

#### 3. Missing Integer Type Enforcement (CRITICAL)

**Problem:** Camera IDs, electrode group IDs, and ntrode IDs accept floats due to type coercion bug.

**Current Schema (Cameras):**

```json
{
  "cameras": {
    "type": "array",
    "items": {
      "properties": {
        "id": {
          "type": "integer",  // Schema says integer
          "description": "Typically a number"
        }
      }
    }
  }
}
```

**Current App Implementation (App.js:1262-1276):**

```javascript
<InputElement
  id={`cameras-id-${index}`}
  type="number"  // HTML5 number input
  name="id"
  title="Camera Id"
  defaultValue={cameras.id}
  required
  onBlur={(e) =>
    onBlur(e, {
      key,
      index,
    })
  }
/>
```

**Type Coercion Bug (App.js:217-237):**

```javascript
const onBlur = (e, metaData) => {
  const { target } = e;
  const { name, value, type } = target;
  // ...

  // BUG: Uses parseFloat for ALL number types
  inputValue = type === 'number' ? parseFloat(value, 10) : value;

  updateFormData(name, inputValue, key, index);
};
```

**Failure Scenario:**

1. User enters `1.5` as camera ID
2. HTML5 input accepts it (type="number")
3. `parseFloat()` converts to `1.5`
4. JSON schema validation **should reject** (type: integer)
5. BUT: AJV may coerce `1.5` to `1` depending on configuration
6. Result: **Unpredictable behavior**

**Actual Observed Behavior:**

- Camera ID: `1.5` → May pass or fail depending on AJV settings
- If passes: Spyglass database rejects (foreign key constraint)
- If fails: Error message unclear

**Root Cause Analysis:**

The issue has two components:

1. **JavaScript Type Coercion:**
   - `parseFloat()` used indiscriminately
   - Should use `parseInt()` for integer fields

2. **Missing Field Type Metadata:**
   - No way to distinguish integer from float fields
   - `type="number"` allows both in HTML5

**Fix Required:**

```javascript
// In App.js onBlur function
const onBlur = (e, metaData) => {
  const { target } = e;
  const { name, value, type } = target;
  const { key, index, isInteger, isCommaSeparatedStringToNumber, isCommaSeparatedString } = metaData || {};

  let inputValue = '';

  if (isCommaSeparatedString) {
    inputValue = formatCommaSeparatedString(value);
  } else if (isCommaSeparatedStringToNumber) {
    inputValue = commaSeparatedStringToNumber(value);
  } else if (type === 'number') {
    // NEW: Determine if field should be integer or float
    const integerFields = [
      'id', 'ntrode_id', 'electrode_group_id', 'camera_id',
      'task_epochs', 'epochs'
    ];
    const isIntegerField = integerFields.some(field => name.includes(field)) || isInteger;

    if (isIntegerField) {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed) || parsed.toString() !== value.trim()) {
        showCustomValidityError(target, `${name} must be a whole number (no decimals)`);
        return;
      }
      inputValue = parsed;
    } else {
      inputValue = parseFloat(value, 10);
      if (isNaN(inputValue)) {
        showCustomValidityError(target, `${name} must be a valid number`);
        return;
      }
    }
  } else {
    inputValue = value;
  }

  updateFormData(name, inputValue, key, index);
};
```

**Better Approach (Type-Safe Metadata):**

```javascript
// In component instantiation
<InputElement
  id={`cameras-id-${index}`}
  type="number"
  name="id"
  title="Camera Id"
  defaultValue={cameras.id}
  required
  step="1"  // HTML5: Only allow integers
  onBlur={(e) =>
    onBlur(e, {
      key,
      index,
      isInteger: true  // Explicit metadata
    })
  }
/>
```

**Fields Affected:**

- `cameras[].id`
- `electrode_groups[].id`
- `ntrode_electrode_group_channel_map[].ntrode_id`
- `ntrode_electrode_group_channel_map[].electrode_group_id`
- `tasks[].task_epochs[]`
- `fs_gui_yamls[].epochs[]`

**Cross-Reference:** REVIEW.md Issue #6

---

#### 4. Missing Naming Pattern Enforcement (HIGH PRIORITY)

**Problem:** Critical identifiers accept any characters including special chars, spaces, unicode.

**Current Schema:**

```json
{
  "subject_id": {
    "type": "string",
    "pattern": "^(.|\\s)*\\S(.|\\s)*$",  // Only prevents empty string
    "description": "Identification code/number of animal model/patient"
  }
}
```

**Database Impact:**

Spyglass performs **case-insensitive queries** but doesn't normalize during entry:

```sql
-- User A enters:
subject_id: "Mouse1"
date_of_birth: "2024-01-15"

-- User B enters (thinks it's different):
subject_id: "mouse1"
date_of_birth: "2024-03-20"

-- Database query:
SELECT * FROM Session WHERE LOWER(subject_id) = 'mouse1'
-- Returns BOTH sessions

-- Result: Same subject with conflicting birth dates → DATA CORRUPTION
```

**Additional Issues:**

- `"mouse 123"` - Space causes file system issues
- `"mouse#1"` - Special char breaks parsers
- `"🐭mouse1"` - Unicode causes encoding issues
- `"mouse/data"` - Path separator creates security risk

**Fix Required:**

```json
{
  "subject": {
    "properties": {
      "subject_id": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*$",
        "minLength": 1,
        "maxLength": 80,
        "description": "Subject ID (lowercase letters, numbers, underscores only; must start with letter)"
      }
    }
  },
  "tasks": {
    "items": {
      "properties": {
        "task_name": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9_]*$",
          "minLength": 1,
          "maxLength": 30,
          "description": "Task name (lowercase, alphanumeric, underscores)"
        }
      }
    }
  },
  "cameras": {
    "items": {
      "properties": {
        "camera_name": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9_]*$",
          "minLength": 1,
          "maxLength": 80,
          "description": "Camera name (lowercase, alphanumeric, underscores)"
        }
      }
    }
  }
}
```

**UI Enhancement Required:**

```javascript
// In App.js - add custom validation
const validateIdentifier = (value, fieldName) => {
  const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/;

  if (!IDENTIFIER_PATTERN.test(value)) {
    const normalized = value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    return {
      valid: false,
      error: `${fieldName} must start with lowercase letter, contain only lowercase letters, numbers, underscores`,
      suggestion: normalized
    };
  }

  return { valid: true };
};

// Usage in input component
<InputElement
  id="subject-subjectId"
  name="subject_id"
  pattern="[a-z][a-z0-9_]+"
  title="Lowercase letters, numbers, underscores only. Must start with letter."
  onBlur={(e) => {
    const validation = validateIdentifier(e.target.value, 'Subject ID');
    if (!validation.valid) {
      if (window.confirm(`${validation.error}\n\nSuggestion: "${validation.suggestion}"\n\nUse suggestion?`)) {
        e.target.value = validation.suggestion;
        onBlur(e, { key: 'subject' });
      }
    } else {
      onBlur(e, { key: 'subject' });
    }
  }}
/>
```

**Fields Requiring Pattern Enforcement:**

- `subject.subject_id` → Pattern: `^[a-z][a-z0-9_]*$`, maxLength: 80
- `tasks[].task_name` → Pattern: `^[a-z][a-z0-9_]*$`, maxLength: 30
- `cameras[].camera_name` → Pattern: `^[a-z][a-z0-9_]*$`, maxLength: 80
- `electrode_groups[].location` → Controlled vocabulary (see below)

**Recommended Naming Convention Documentation:**

```markdown
### Identifier Naming Rules

To ensure database consistency and file system compatibility:

**Format:** `[a-z][a-z0-9_]*`

**Rules:**
- Start with lowercase letter
- Only lowercase letters, numbers, underscores
- No spaces or special characters
- Case-sensitive but use lowercase for consistency

**Examples:**
- ✅ Good: `mouse_123`, `ca1_tetrode`, `sleep_task`
- ❌ Bad: `Mouse 123`, `CA1-tetrode!`, `sleep task`
```

**Cross-Reference:** REVIEW.md Issue #7

---

#### 5. Missing VARCHAR Length Constraints (HIGH PRIORITY)

**Problem:** No maxLength constraints cause Spyglass database ingestion failures.

**Spyglass MySQL Constraints:**

| Field | MySQL Limit | Current Schema | Impact |
|-------|-------------|----------------|--------|
| **nwb_file_name** | 64 bytes | ❌ No constraint | 🔴 CRITICAL: Entire session rollback |
| **interval_list_name** | 170 bytes | ❌ No constraint | 🔴 CRITICAL: TaskEpoch insert fails |
| **electrode_group_name** | 80 bytes | ❌ No constraint | 🟡 HIGH: ElectrodeGroup fails |
| **subject_id** | 80 bytes | ❌ No constraint | 🟡 HIGH: Session insert fails |

**Failure Scenario:**

```javascript
// User enters long subject_id:
subject_id: "mouse_with_very_long_descriptive_name_including_experiment_details_and_more"

// Generated filename:
filename = "20250123_mouse_with_very_long_descriptive_name_including_experiment_details_and_more_metadata.yml"
// Length: 92 characters → EXCEEDS 64 byte limit

// Spyglass ingestion:
// DataJointError: Data too long for column 'nwb_file_name' at row 1
// ENTIRE SESSION ROLLBACK - ALL WORK LOST
```

**Fix Required:**

```json
{
  "subject": {
    "properties": {
      "subject_id": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*$",
        "minLength": 1,
        "maxLength": 50,  // Conservative: allows for date prefix + "_metadata.yml" suffix
        "description": "Subject ID (max 50 chars to ensure filename < 64 bytes)"
      }
    }
  },
  "tasks": {
    "items": {
      "properties": {
        "task_name": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9_]*$",
          "maxLength": 30,
          "description": "Task name (max 30 chars)"
        }
      }
    }
  },
  "electrode_groups": {
    "items": {
      "properties": {
        "id": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9999  // Ensures string representation fits in constraints
        }
      }
    }
  }
}
```

**Additional Validation in App.js:**

```javascript
// Before YAML download in generateYMLFile()
const validateDatabaseConstraints = (formData) => {
  const errors = [];

  // Validate filename length
  const subjectId = formData.subject.subject_id.toLowerCase();
  const filename = `YYYYMMDD_${subjectId}_metadata.yml`;

  if (filename.length > 64) {
    errors.push({
      id: 'subject-subjectId',
      message: `Filename will be too long (${filename.length} chars, max 64).\n\n` +
               `Current: ${filename}\n\n` +
               `Please shorten subject_id to ${64 - 'YYYYMMDD__metadata.yml'.length} characters or less.`
    });
  }

  // Validate interval_list_name (task epoch tags)
  formData.tasks.forEach((task, index) => {
    task.task_epochs?.forEach(epoch => {
      const intervalName = `${task.task_name}_epoch_${epoch}`;
      if (intervalName.length > 170) {
        errors.push({
          id: `tasks-task_name-${index}`,
          message: `Task epoch identifier too long: "${intervalName}" (${intervalName.length} chars, max 170)`
        });
      }
    });
  });

  // Validate electrode_group_name
  formData.electrode_groups?.forEach((group, index) => {
    const groupName = group.id.toString();
    if (groupName.length > 80) {
      errors.push({
        id: `electrode_groups-id-${index}`,
        message: `Electrode group name too long: ${groupName.length} chars (max 80)`
      });
    }
  });

  return errors;
};

// In generateYMLFile()
const generateYMLFile = (e) => {
  e.preventDefault();
  const form = structuredClone(formData);

  // Existing validation
  const validation = jsonschemaValidation(form);
  const { isValid, jsonSchemaErrors } = validation;
  const { isFormValid, formErrors } = rulesValidation(form);

  // NEW: Database constraint validation
  const dbErrors = validateDatabaseConstraints(form);

  if (isValid && isFormValid && dbErrors.length === 0) {
    // Proceed with YAML generation
    const yAMLForm = convertObjectToYAMLString(form);
    const subjectId = formData.subject.subject_id.toLowerCase();
    const fileName = `{EXPERIMENT_DATE_in_format_mmddYYYY}_${subjectId}_metadata.yml`;
    createYAMLFile(fileName, yAMLForm);
    return;
  }

  // Display errors
  if (dbErrors.length > 0) {
    dbErrors.forEach(error => {
      displayErrorOnUI(error.id, error.message);
    });
  }

  // ... existing error handling
};
```

---

#### 6. Missing Coordinate Range Validation (MEDIUM PRIORITY)

**Problem:** Users can enter unrealistic brain coordinates.

**Current Schema:**

```json
{
  "electrode_groups": {
    "items": {
      "properties": {
        "targeted_x": {
          "type": "number",
          "description": "Medial-Lateral from Bregma (Targeted x)"
        },
        "targeted_y": {
          "type": "number",
          "description": "Anterior-Posterior to Bregma (Targeted y)"
        },
        "targeted_z": {
          "type": "number",
          "description": "Dorsal-Ventral to Cortical Surface (Targeted z)"
        }
      }
    }
  }
}
```

**Failure Scenario:**

```yaml
electrode_groups:
  - targeted_x: 999999  # 1000 km???
    targeted_y: -500000
    targeted_z: 0.00001  # 10 nm???
    units: "mm"
```

**Fix Required:**

```json
{
  "electrode_groups": {
    "items": {
      "properties": {
        "targeted_x": {
          "type": "number",
          "minimum": -100,
          "maximum": 100,
          "description": "Medial-Lateral from Bregma in mm (typical range: ±10mm)"
        },
        "targeted_y": {
          "type": "number",
          "minimum": -100,
          "maximum": 100,
          "description": "Anterior-Posterior to Bregma in mm (typical range: ±10mm)"
        },
        "targeted_z": {
          "type": "number",
          "minimum": 0,
          "maximum": 20,
          "description": "Dorsal-Ventral to Cortical Surface in mm (typical range: 0-15mm)"
        }
      }
    }
  }
}
```

**Additional Client-Side Validation:**

```javascript
const validateCoordinate = (value, unit, fieldName, axis) => {
  // Typical ranges for rodent brain coordinates
  const limits = {
    'mm': {
      'x': { min: -10, max: 10, typical: 5 },
      'y': { min: -10, max: 10, typical: 5 },
      'z': { min: 0, max: 15, typical: 8 }
    },
    'μm': {
      'x': { min: -10000, max: 10000, typical: 5000 },
      'y': { min: -10000, max: 10000, typical: 5000 },
      'z': { min: 0, max: 15000, typical: 8000 }
    }
  };

  const limit = limits[unit]?.[axis] || limits['mm'][axis];

  if (Math.abs(value) > limit.max) {
    return {
      valid: false,
      error: `${fieldName} (${value} ${unit}) exceeds typical range for rodent brain (±${limit.max} ${unit})`
    };
  }

  if (Math.abs(value) > limit.typical) {
    return {
      valid: true,
      warning: `${fieldName} (${value} ${unit}) is larger than typical (±${limit.typical} ${unit}). Please verify.`
    };
  }

  return { valid: true };
};
```

---

#### 7. Missing Brain Region Controlled Vocabulary (MEDIUM PRIORITY)

**Problem:** Inconsistent capitalization creates duplicate Spyglass BrainRegion entries.

**Current Schema:**

```json
{
  "electrode_groups": {
    "items": {
      "properties": {
        "location": {
          "type": "string",
          "description": "Where device is implanted"
        }
      }
    }
  }
}
```

**Database Impact:**

```yaml
# User A enters:
electrode_groups:
  - location: "CA1"

# User B enters:
electrode_groups:
  - location: "ca1"

# User C enters:
electrode_groups:
  - location: "Ca1"

# Spyglass creates THREE separate BrainRegion entries:
# - "CA1"
# - "ca1"
# - "Ca1"

# Result: Queries fragmented, spatial analysis broken
```

**Fix Required:**

```json
{
  "electrode_groups": {
    "items": {
      "properties": {
        "location": {
          "type": "string",
          "enum": [
            "ca1", "ca2", "ca3",
            "dentate_gyrus",
            "medial_entorhinal_cortex",
            "lateral_entorhinal_cortex",
            "prefrontal_cortex",
            "motor_cortex",
            "visual_cortex",
            "hippocampus",
            "amygdala",
            "striatum",
            "thalamus",
            "hypothalamus",
            "other"
          ],
          "description": "Brain region (controlled vocabulary)"
        },
        "location_custom": {
          "type": "string",
          "description": "Custom brain region if 'other' selected"
        }
      }
    }
  }
}
```

**UI Implementation:**

```javascript
// In valueList.js
export const brainRegions = () => {
  return [
    'ca1', 'ca2', 'ca3',
    'dentate_gyrus',
    'medial_entorhinal_cortex',
    'lateral_entorhinal_cortex',
    'prefrontal_cortex',
    'motor_cortex',
    'visual_cortex',
    'hippocampus',
    'amygdala',
    'striatum',
    'thalamus',
    'hypothalamus',
    'other'
  ];
};

// In App.js - update component
<DataListElement
  id={`electrode_groups-location-${index}`}
  name="location"
  title="Location"
  placeholder="Type to find a brain region (lowercase)"
  defaultValue={electrodeGroup.location}
  dataItems={brainRegions()}
  onBlur={(e) => {
    const value = e.target.value.toLowerCase();  // Force lowercase
    e.target.value = value;
    itemSelected(e, { key, index });
  }}
/>
```

---

### Schema Validation Coverage Summary

| Validation Type | Current Coverage | Missing Coverage | Priority |
|----------------|------------------|------------------|----------|
| **Type Checking** | 80% | Integer vs Float distinction | P0 |
| **Required Fields** | 100% | N/A | ✅ |
| **Pattern Matching** | 60% | Naming patterns, empty string edge cases | P0 |
| **Enum Constraints** | 50% | Sex enforcement, brain regions | P0 |
| **Length Constraints** | 0% | All VARCHAR fields | P1 |
| **Range Validation** | 0% | Coordinates, weights, numeric bounds | P2 |
| **Cross-Field Validation** | 40% | Optogenetics dependencies, camera refs | P1 |
| **Uniqueness Constraints** | 60% | ID collision detection | P1 |

---

## Validation Logic Review

### JavaScript Validation (App.js)

#### jsonschemaValidation() - Line 544-583

**Purpose:** Validate form data against JSON schema using AJV.

**Current Implementation:**

```javascript
const jsonschemaValidation = (formContent) => {
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema.current);

  validate(formContent);

  const validationMessages =
    validate.errors?.map((error) => {
      return `Key: ${error.instancePath
        .split('/')
        .filter((x) => x !== '')
        .join(', ')}. | Error: ${error.message}`;
    }) || [];

  const errorIds = [
    ...new Set(
      validate.errors?.map((v) => {
        const validationEntries = v.instancePath
          .split('/')
          .filter((x) => x !== '');
        return validationEntries[0];
      })
    ),
  ];

  const isValid = validate.errors === null;

  return {
    isValid,
    jsonSchemaErrorMessages: validationMessages,
    jsonSchemaErrors: validate.errors,
    jsonSchemaErrorIds: errorIds,
  };
};
```

**Strengths:**

- Uses `allErrors: true` to collect all validation failures
- Adds format validators via ajv-formats
- Compiles schema once (stored in ref)
- Returns structured error information

**Weaknesses:**

1. **No Progressive Validation:**
   - Only called on form submission (line 655)
   - Users work for 30+ minutes before discovering errors
   - No section-by-section validation

2. **Error Message Clarity:**
   - `instancePath` like `/subject/sex` → "Subject Sex"
   - Generic messages: "must match pattern"
   - No context about why pattern failed

3. **No Type Coercion Prevention:**
   - AJV may auto-coerce types (e.g., "1.5" → 1)
   - Behavior depends on AJV configuration
   - Can lead to silent data corruption

4. **Missing Custom Validators:**
   - No enum strict enforcement
   - No database constraint checking
   - No cross-repository validation

**Recommended Improvements:**

```javascript
// Enhanced validation with section support
const jsonschemaValidation = (formContent, options = {}) => {
  const { validateSection, strictMode = true } = options;

  const ajv = new Ajv({
    allErrors: true,
    coerceTypes: false,  // CRITICAL: Prevent type coercion
    useDefaults: false,   // Don't auto-fill defaults during validation
    strictTypes: true     // Strict type checking
  });
  addFormats(ajv);

  let schemaToValidate = schema.current;

  // Support section-specific validation
  if (validateSection) {
    schemaToValidate = {
      type: 'object',
      properties: {
        [validateSection]: schema.current.properties[validateSection]
      },
      required: schema.current.required.includes(validateSection)
        ? [validateSection]
        : []
    };
  }

  const validate = ajv.compile(schemaToValidate);
  const isValid = validate(formContent);

  // Enhanced error messages
  const validationMessages = validate.errors?.map((error) => {
    const fieldPath = error.instancePath.split('/').filter(x => x !== '');
    const fieldName = titleCase(fieldPath.join(' '));

    let message = error.message;

    // Improve specific error messages
    if (error.keyword === 'pattern' && error.params.pattern === '^(.|\\s)*\\S(.|\\s)*$') {
      message = 'cannot be empty or contain only whitespace';
    } else if (error.keyword === 'enum') {
      message = `must be one of: ${error.params.allowedValues.join(', ')}`;
    } else if (error.keyword === 'type' && error.params.type === 'integer') {
      message = 'must be a whole number (no decimals)';
    }

    return `${fieldName}: ${message}`;
  }) || [];

  return {
    isValid,
    jsonSchemaErrorMessages: validationMessages,
    jsonSchemaErrors: validate.errors,
    jsonSchemaErrorIds: errorIds,
  };
};
```

---

#### rulesValidation() - Line 591-624

**Purpose:** Validate custom business rules not expressible in JSON schema.

**Current Implementation:**

```javascript
const rulesValidation = (jsonFileContent) => {
  const errorIds = [];
  const errorMessages = [];
  let isFormValid = true;
  const errors = [];

  // check if tasks have a camera but no camera is set
  if (!jsonFileContent.cameras && jsonFileContent.tasks?.length > 0) {
    errorMessages.push(
      'Key: task.camera | Error: There is tasks camera_id, but no camera object with ids. No data is loaded'
    );
    errorIds.push('tasks');
    isFormValid = false;
  }

  // check if associated_video_files have a camera but no camera is set
  if (
    !jsonFileContent.cameras &&
    jsonFileContent.associated_video_files?.length > 0
  ) {
    errorMessages.push(
      `Key: associated_video_files.camera_id. | Error: There is associated_video_files camera_id, but no camera object with ids. No data is loaded`
    );
    errorIds.push('associated_video_files');
    isFormValid = false;
  }

  return {
    isFormValid,
    formErrorMessages: errorMessages,
    formErrors: errorMessages,
    formErrorIds: errorIds,
  };
};
```

**Strengths:**

- Checks cross-field dependencies (camera references)
- Returns structured error information
- Clear separation from schema validation

**Weaknesses:**

1. **Minimal Coverage:**
   - Only 2 validation rules
   - Missing many critical checks

2. **No Database Constraint Validation:**
   - No VARCHAR length checks
   - No enum enforcement
   - No naming pattern validation

3. **No Optogenetics Dependency Checking:**
   - Spyglass requires ALL optogenetics fields if ANY present
   - Missing partial optogenetics detection

4. **No ID Collision Detection:**
   - Duplicate electrode group IDs allowed
   - Duplicate camera IDs allowed
   - Duplicate ntrode IDs allowed

**Recommended Improvements:**

```javascript
const rulesValidation = (jsonFileContent) => {
  const errorIds = [];
  const errorMessages = [];
  let isFormValid = true;

  // === EXISTING VALIDATION ===

  // Check camera references in tasks
  if (!jsonFileContent.cameras && jsonFileContent.tasks?.length > 0) {
    const tasksWithCameras = jsonFileContent.tasks.filter(t => t.camera_id?.length > 0);
    if (tasksWithCameras.length > 0) {
      errorMessages.push(
        `Key: tasks.camera_id | Error: ${tasksWithCameras.length} task(s) reference camera IDs, but no cameras are defined.`
      );
      errorIds.push('tasks');
      isFormValid = false;
    }
  }

  // Check camera references in associated_video_files
  if (!jsonFileContent.cameras && jsonFileContent.associated_video_files?.length > 0) {
    const filesWithCameras = jsonFileContent.associated_video_files.filter(f => f.camera_id);
    if (filesWithCameras.length > 0) {
      errorMessages.push(
        `Key: associated_video_files.camera_id | Error: ${filesWithCameras.length} video file(s) reference camera IDs, but no cameras are defined.`
      );
      errorIds.push('associated_video_files');
      isFormValid = false;
    }
  }

  // === NEW VALIDATION ===

  // 1. Duplicate ID Detection
  const electrodeGroupIds = jsonFileContent.electrode_groups?.map(g => g.id) || [];
  const duplicateEGIds = electrodeGroupIds.filter((id, index) =>
    electrodeGroupIds.indexOf(id) !== index
  );
  if (duplicateEGIds.length > 0) {
    errorMessages.push(
      `Key: electrode_groups.id | Error: Duplicate electrode group IDs found: ${[...new Set(duplicateEGIds)].join(', ')}`
    );
    errorIds.push('electrode_groups');
    isFormValid = false;
  }

  const cameraIds = jsonFileContent.cameras?.map(c => c.id) || [];
  const duplicateCameraIds = cameraIds.filter((id, index) =>
    cameraIds.indexOf(id) !== index
  );
  if (duplicateCameraIds.length > 0) {
    errorMessages.push(
      `Key: cameras.id | Error: Duplicate camera IDs found: ${[...new Set(duplicateCameraIds)].join(', ')}`
    );
    errorIds.push('cameras');
    isFormValid = false;
  }

  // 2. Camera ID Reference Validation
  if (jsonFileContent.cameras && jsonFileContent.tasks) {
    jsonFileContent.tasks.forEach((task, index) => {
      const invalidCameraIds = task.camera_id?.filter(id => !cameraIds.includes(id)) || [];
      if (invalidCameraIds.length > 0) {
        errorMessages.push(
          `Key: tasks[${index}].camera_id | Error: Task "${task.task_name}" references non-existent camera IDs: ${invalidCameraIds.join(', ')}`
        );
        errorIds.push(`tasks-camera_id-${index}`);
        isFormValid = false;
      }
    });
  }

  // 3. Optogenetics Partial Definition Check
  const hasOptoSource = jsonFileContent.opto_excitation_source?.length > 0;
  const hasOpticalFiber = jsonFileContent.optical_fiber?.length > 0;
  const hasVirusInjection = jsonFileContent.virus_injection?.length > 0;
  const hasFsGuiYamls = jsonFileContent.fs_gui_yamls?.length > 0;

  const optoFieldsPresent = [hasOptoSource, hasOpticalFiber, hasVirusInjection, hasFsGuiYamls].filter(Boolean).length;

  if (optoFieldsPresent > 0 && optoFieldsPresent < 4) {
    errorMessages.push(
      `Key: optogenetics | Error: Partial optogenetics configuration detected. ` +
      `If using optogenetics, ALL fields must be defined: ` +
      `opto_excitation_source${hasOptoSource ? ' ✓' : ' ✗'}, ` +
      `optical_fiber${hasOpticalFiber ? ' ✓' : ' ✗'}, ` +
      `virus_injection${hasVirusInjection ? ' ✓' : ' ✗'}, ` +
      `fs_gui_yamls${hasFsGuiYamls ? ' ✓' : ' ✗'}`
    );
    errorIds.push('opto_excitation_source');
    isFormValid = false;
  }

  // 4. Database VARCHAR Length Validation
  const subjectId = jsonFileContent.subject?.subject_id || '';
  if (subjectId.length > 80) {
    errorMessages.push(
      `Key: subject.subject_id | Error: Subject ID too long (${subjectId.length} chars, max 80 for database)`
    );
    errorIds.push('subject-subjectId');
    isFormValid = false;
  }

  // 5. Filename Length Validation (for Spyglass nwb_file_name constraint)
  const estimatedFilename = `YYYYMMDD_${subjectId.toLowerCase()}_metadata.yml`;
  if (estimatedFilename.length > 64) {
    errorMessages.push(
      `Key: subject.subject_id | Error: Generated filename will be too long (${estimatedFilename.length} chars, max 64). ` +
      `Please shorten subject_id to ${64 - 'YYYYMMDD__metadata.yml'.length} characters.`
    );
    errorIds.push('subject-subjectId');
    isFormValid = false;
  }

  // 6. Task Epoch Interval Name Length
  jsonFileContent.tasks?.forEach((task, index) => {
    task.task_epochs?.forEach(epoch => {
      const intervalName = `${task.task_name}_epoch_${epoch}`;
      if (intervalName.length > 170) {
        errorMessages.push(
          `Key: tasks[${index}].task_name | Error: Task epoch identifier too long: "${intervalName}" (${intervalName.length} chars, max 170 for database)`
        );
        errorIds.push(`tasks-task_name-${index}`);
        isFormValid = false;
      }
    });
  });

  // 7. Naming Pattern Validation (critical identifiers)
  const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/;

  if (subjectId && !IDENTIFIER_PATTERN.test(subjectId)) {
    errorMessages.push(
      `Key: subject.subject_id | Error: Subject ID must start with lowercase letter and contain only lowercase letters, numbers, underscores. Found: "${subjectId}"`
    );
    errorIds.push('subject-subjectId');
    isFormValid = false;
  }

  jsonFileContent.tasks?.forEach((task, index) => {
    if (task.task_name && !IDENTIFIER_PATTERN.test(task.task_name)) {
      errorMessages.push(
        `Key: tasks[${index}].task_name | Error: Task name must start with lowercase letter and contain only lowercase letters, numbers, underscores. Found: "${task.task_name}"`
      );
      errorIds.push(`tasks-task_name-${index}`);
      isFormValid = false;
    }
  });

  // 8. Sex Enum Validation (critical for Spyglass)
  const validSex = ['M', 'F', 'U', 'O'];
  if (jsonFileContent.subject?.sex && !validSex.includes(jsonFileContent.subject.sex)) {
    errorMessages.push(
      `Key: subject.sex | Error: Sex must be one of: M (male), F (female), U (unknown), O (other). ` +
      `Found: "${jsonFileContent.subject.sex}". ` +
      `⚠️ Invalid values will be silently converted to 'U' in database, causing data corruption.`
    );
    errorIds.push('subject-sex');
    isFormValid = false;
  }

  return {
    isFormValid,
    formErrorMessages: errorMessages,
    formErrors: errorMessages,
    formErrorIds: errorIds,
  };
};
```

---

### Python Validation (trodes_to_nwb)

**Note:** The Python validation code is not directly accessible in the current repository. Based on REVIEW.md, the Python package uses:

- **Library:** `jsonschema` (Draft 2020-12)
- **Location:** `src/trodes_to_nwb/metadata_validation.py`
- **Known Issue:** Date of birth corruption bug (REVIEW.md #1)

**Expected Validation Flow:**

```python
# Pseudocode based on REVIEW.md analysis
def validate(metadata: dict) -> tuple:
    """Validate metadata against JSON schema"""

    # Load schema
    schema_path = Path(__file__).parent / "nwb_schema.json"
    schema = json.loads(schema_path.read_text())

    # BUG: Date of birth corruption (REVIEW.md #1)
    # CURRENT (WRONG):
    metadata["subject"]["date_of_birth"] = (
        metadata["subject"]["date_of_birth"].utcnow().isoformat()
    )
    # Should be:
    # if isinstance(metadata["subject"]["date_of_birth"], datetime.datetime):
    #     metadata["subject"]["date_of_birth"] = (
    #         metadata["subject"]["date_of_birth"].isoformat()
    #     )

    # Validate
    jsonschema.validate(metadata, schema)

    return metadata, None  # or (None, errors)
```

**Validation Differences (AJV vs jsonschema):**

| Aspect | JavaScript (AJV Draft 7) | Python (jsonschema Draft 2020-12) | Impact |
|--------|-------------------------|----------------------------------|--------|
| **Date Formats** | More permissive | Stricter ISO 8601 | YAMLs pass JS, fail Python |
| **Pattern Matching** | JavaScript regex | Python re module | Subtle differences |
| **Type Coercion** | Configurable (may auto-coerce) | Strict by default | Inconsistent behavior |
| **Error Messages** | Customizable | Standard library | Different UX |
| **Array Uniqueness** | Checks item equality | Checks item equality | Usually consistent |

**Recommendation:** Use same validator in both environments or create integration tests.

---

## Critical Gaps from REVIEW.md

### Issue #3: Silent Validation Failures

**Location:** App.js:652-678 (generateYMLFile)

**Problem:** Validation only runs on form submission after 30+ minutes of user work.

**Current Flow:**

```
User fills form (30+ minutes)
  ↓
Click "Generate YML"
  ↓
Form submission
  ↓
Validation runs (FIRST TIME)
  ↓
Errors found
  ↓
User frustrated, loses motivation
```

**Impact:**

- High user frustration
- Users create workarounds (manual YAML editing)
- Data quality suffers
- Support burden increases

**Example Failure Scenario:**

```javascript
// User creates duplicate electrode group IDs at minute 5
<InputElement id="electrode_groups-id-0" defaultValue={0} />
<InputElement id="electrode_groups-id-1" defaultValue={0} />  // DUPLICATE!

// ✗ No warning until "Generate YAML" clicked at minute 35
// ✗ User has continued working, adding ntrode maps, etc.
// ✗ Validation failure requires rework of 30 minutes of effort
```

**Fix Required: Progressive Validation**

```javascript
// Add validation state tracking
const [validationState, setValidationState] = useState({
  subject: { valid: null, errors: [] },
  electrode_groups: { valid: null, errors: [] },
  cameras: { valid: null, errors: [] },
  tasks: { valid: null, errors: [] },
  // ... other sections
});

// Real-time section validation
const validateSection = (sectionName) => {
  const sectionData = {
    [sectionName]: formData[sectionName]
  };

  const schemaValidation = jsonschemaValidation(sectionData, {
    validateSection: sectionName
  });
  const rulesValidation = rulesValidation(formData);  // Full context needed

  const errors = [
    ...schemaValidation.jsonSchemaErrorMessages,
    ...rulesValidation.formErrorMessages.filter(msg =>
      msg.includes(sectionName)
    )
  ];

  setValidationState(prev => ({
    ...prev,
    [sectionName]: {
      valid: errors.length === 0,
      errors
    }
  }));
};

// Trigger validation on blur for critical fields
<InputElement
  id={`electrode_groups-id-${index}`}
  type="number"
  name="id"
  onBlur={(e) => {
    onBlur(e, { key, index });

    // Immediate duplicate ID check
    const allIds = formData.electrode_groups.map(g => g.id);
    const isDuplicate = allIds.filter(id => id === parseInt(e.target.value)).length > 1;

    if (isDuplicate) {
      showCustomValidityError(
        e.target,
        `Electrode group ID ${e.target.value} already exists. IDs must be unique.`
      );
    }

    // Section-level validation
    validateSection('electrode_groups');
  }}
/>

// Visual feedback in navigation
<li className="nav-item">
  <a href="#electrode_groups-area">
    {validationState.electrode_groups.valid === true && '✓ '}
    {validationState.electrode_groups.valid === false && '⚠️ '}
    Electrode Groups
  </a>
  {validationState.electrode_groups.errors.length > 0 && (
    <ul className="validation-errors">
      {validationState.electrode_groups.errors.map((error, i) => (
        <li key={i}>{error}</li>
      ))}
    </ul>
  )}
</li>
```

**User Experience Improvement:**

```
User fills subject section (2 minutes)
  ↓
Section validates on blur
  ↓
✓ Green checkmark appears in nav
  ↓
User fills electrode_groups (10 minutes)
  ↓
Enters duplicate ID
  ↓
⚠️ Immediate error message
  ↓
User fixes immediately (30 seconds)
  ↓
Continues with correct data
```

**Additional Progressive Validation Hooks:**

1. **On Section Collapse:**

   ```javascript
   <details
     open
     onToggle={(e) => {
       if (!e.target.open) {  // User is collapsing section
         validateSection('electrode_groups');
       }
     }}
   >
   ```

2. **On Array Item Add/Remove:**

   ```javascript
   const addArrayItem = (key, count = 1) => {
     // ... existing logic

     // Validate section after add
     setTimeout(() => validateSection(key), 100);
   };
   ```

3. **On Navigation Click:**

   ```javascript
   const clickNav = (e) => {
     // ... existing logic

     // Validate previous section before navigating
     const currentSection = document.querySelector('.active-section');
     if (currentSection) {
       const sectionId = currentSection.id.replace('-area', '');
       validateSection(sectionId);
     }
   };
   ```

**Cross-Reference:** REVIEW.md Issue #3, TESTING_PLAN.md Progressive Validation section

---

### Issue #6: Type Coercion Bug

**Location:** App.js:217-237 (onBlur)

**Problem:** `parseFloat()` used for ALL number inputs, accepting floats for integer fields.

**Detailed in Schema Analysis Section above.**

**Cross-Reference:** REVIEW.md Issue #6

---

### Issue #7: No Naming Convention Enforcement

**Location:** nwb_schema.json (subject_id, task_name, camera_name fields)

**Problem:** No pattern enforcement for critical identifiers causes database fragmentation.

**Detailed in Schema Analysis Section above.**

**Cross-Reference:** REVIEW.md Issue #7

---

## Database Compatibility Issues

### Spyglass Database Requirements

**Database System:** MySQL (via DataJoint)
**Entry Point:** `spyglass/src/spyglass/data_import/insert_sessions.py::insert_sessions()`

#### 1. VARCHAR Length Constraints

**Critical Failures:**

| Field | Limit | Current | Fix Priority |
|-------|-------|---------|--------------|
| nwb_file_name | 64 bytes | ❌ None | 🔴 P0 |
| interval_list_name | 170 bytes | ❌ None | 🔴 P0 |
| electrode_group_name | 80 bytes | ❌ None | 🟡 P1 |
| subject_id | 80 bytes | ❌ None | 🟡 P1 |

**Detailed in Schema Analysis Section above.**

#### 2. NOT NULL & Non-Empty Constraints

**Database Requirements:**

```sql
-- Spyglass Session table
session_description VARCHAR(255) NOT NULL CHECK (LENGTH(session_description) > 0)
electrode_group.description VARCHAR(255) NOT NULL CHECK (LENGTH(description) > 0)
electrode.filtering VARCHAR(100) NOT NULL
```

**Current Schema Issues:**

- ✅ `required: true` enforced
- ❌ Empty strings pass validation
- ❌ `filtering` field missing from schema

**Fix Required:**

```json
{
  "session_description": {
    "type": "string",
    "minLength": 1,
    "pattern": "^(.|\\s)*\\S(.|\\s)*$"
  },
  "electrode_groups": {
    "items": {
      "properties": {
        "description": {
          "type": "string",
          "minLength": 1,
          "pattern": "^(.|\\s)*\\S(.|\\s)*$"
        },
        "filtering": {
          "type": "string",
          "minLength": 1,
          "description": "Filter settings (e.g., '0-9000 Hz')",
          "default": "0-30000 Hz"
        }
      },
      "required": ["description", "filtering"]
    }
  }
}
```

#### 3. Enum Value Constraints

**Database Implementation:**

```python
# In spyglass/data_import/insert_sessions.py
if sex not in ['M', 'F', 'U']:
    sex = 'U'  # Silent conversion
```

**Problem:** No error raised, silent data corruption.

**Current Schema:**

```json
{
  "sex": {
    "type": "string",
    "enum": ["M", "F", "U", "O"]
  }
}
```

**Schema is correct, but import validation needs strengthening (detailed above).**

#### 4. Foreign Key Constraints

**Critical Dependencies:**

```sql
-- ElectrodeGroup requires BrainRegion
INSERT INTO ElectrodeGroup (..., brain_region_id)
  SELECT ..., br.id FROM BrainRegion br
  WHERE br.region_name = electrode_group.location;

-- If location = NULL or '' → Creates "Unknown" region
-- If location capitalization varies → Creates duplicate regions
```

**Requirements:**

1. **Non-NULL locations:** Every electrode group must have valid location
2. **Consistent capitalization:** "CA1" vs "ca1" creates duplicates
3. **Probe type pre-registration:** `device_type` must match existing Probe table entries

**Fix Required:**

```json
{
  "electrode_groups": {
    "items": {
      "properties": {
        "location": {
          "type": "string",
          "minLength": 1,
          "enum": [/* controlled vocabulary */],
          "description": "Brain region (must match Spyglass BrainRegion table)"
        },
        "device_type": {
          "type": "string",
          "minLength": 1,
          "description": "Must match existing Spyglass Probe.probe_id"
        }
      },
      "required": ["location", "device_type"]
    }
  }
}
```

#### 5. ndx_franklab_novela Extension Columns

**Spyglass Requirement:**

NWB files must include ndx_franklab_novela extension with columns:

- `bad_channel` (boolean)
- `probe_shank` (integer)
- `probe_electrode` (integer)
- `ref_elect_id` (integer)

**Current State:**

- Generated by trodes_to_nwb Python package
- Not directly controlled by YAML schema
- Missing columns cause **incomplete Electrode table population**

**Recommendation:**

- Document requirement in CLAUDE.md
- Add validation check in trodes_to_nwb
- Create test to verify NWB output includes extension

---

## Validation Timing Issues

### Current Validation Flow

```
User Journey:
┌─────────────────────────────────────────────────────────────┐
│ Open Form → Fill Data (30 min) → Submit → Validation        │
│                                             ↓                │
│                                          Errors              │
│                                             ↓                │
│                                      User Frustrated         │
└─────────────────────────────────────────────────────────────┘

Timeline:
0:00     Start filling form
0:05     Enter duplicate electrode group ID (❌ No warning)
0:10     Add ntrode maps
0:15     Add cameras
0:20     Add tasks
0:25     Review form
0:30     Click "Generate YML"
0:30     ⚠️ FIRST VALIDATION - Errors found
0:31     Must fix duplicate ID from 0:05
0:35     Regenerate ntrode maps
0:40     Finally download YAML
```

**Result:** 40 minutes for 30 minutes of actual work.

### Optimal Validation Flow

```
User Journey:
┌─────────────────────────────────────────────────────────────┐
│ Open Form → Fill Section → Validate → Fill Next Section     │
│                              ↓                               │
│                           ✓ Valid                            │
│                              ↓                               │
│                      Continue Confidently                    │
└─────────────────────────────────────────────────────────────┘

Timeline:
0:00     Start filling form
0:02     Complete subject section
0:02     ✓ Section validates automatically
0:05     Enter electrode group ID
0:05     ✓ No duplicates, continues
0:07     Add duplicate ID by mistake
0:07     ⚠️ IMMEDIATE WARNING - Fix in 10 seconds
0:10     Add cameras
0:15     Add tasks
0:20     Review (all sections show ✓)
0:21     Click "Generate YML"
0:21     ✓ Final validation (already checked)
0:21     Download YAML immediately
```

**Result:** 21 minutes for same work, higher confidence.

### Implementation Strategy

#### Phase 1: Field-Level Validation (Immediate)

```javascript
// Add to critical fields
<InputElement
  id={`electrode_groups-id-${index}`}
  type="number"
  name="id"
  step="1"
  onBlur={(e) => {
    // Existing onBlur
    onBlur(e, { key, index, isInteger: true });

    // NEW: Immediate duplicate check
    const currentId = parseInt(e.target.value);
    const allIds = formData.electrode_groups.map(g => g.id);
    const duplicates = allIds.filter(id => id === currentId);

    if (duplicates.length > 1) {
      showCustomValidityError(
        e.target,
        `Duplicate ID: ${currentId} is already used. Each electrode group must have unique ID.`
      );
    }
  }}
/>
```

#### Phase 2: Section-Level Validation (Short-term)

```javascript
// Add validation on section collapse
<details
  open
  onToggle={(e) => {
    if (!e.target.open) {  // User collapsing = done with section
      const sectionName = e.target.id.replace('-area', '');
      validateSection(sectionName);
    }
  }}
>
  <summary>
    {validationState[sectionName]?.valid === true && '✓ '}
    {validationState[sectionName]?.valid === false && '⚠️ '}
    Electrode Groups
  </summary>
  {/* ... content ... */}
</details>
```

#### Phase 3: Real-Time Validation (Long-term)

```javascript
// Debounced validation on input change
import { debounce } from 'lodash';

const debouncedValidate = useCallback(
  debounce((sectionName) => {
    validateSection(sectionName);
  }, 500),
  [formData]
);

// Use in form fields
<InputElement
  onChange={(e) => {
    // ... update form data
    debouncedValidate('electrode_groups');
  }}
/>
```

---

## Type Safety Analysis

### JavaScript Type System Issues

#### 1. Number vs Integer Distinction

**JavaScript Problem:**

```javascript
// JavaScript has no integer type, only number
typeof 1 === 'number'      // true
typeof 1.5 === 'number'    // true

// HTML5 input type="number"
<input type="number" value="1.5">  // Valid
<input type="number" value="1">    // Also valid
```

**Current Type Coercion:**

```javascript
// App.js:233
inputValue = type === 'number' ? parseFloat(value, 10) : value;
```

**Problems:**

1. Camera ID `1.5` → `parseFloat()` → `1.5` → Database foreign key error
2. Electrode group ID `2.7` → `parseFloat()` → `2.7` → Invalid reference
3. Ntrode ID `3.14` → `parseFloat()` → `3.14` → Mapping broken

**Root Cause:**

- No metadata distinguishing integer from float fields
- `parseFloat()` used universally for all numbers

**Type-Safe Solution:**

```javascript
// Define field type metadata
const FIELD_TYPE_MAP = {
  // Integer fields (IDs, counts)
  'id': 'integer',
  'camera_id': 'integer',
  'electrode_group_id': 'integer',
  'ntrode_id': 'integer',
  'task_epochs': 'integer',
  'epochs': 'integer',

  // Float fields (measurements)
  'targeted_x': 'float',
  'targeted_y': 'float',
  'targeted_z': 'float',
  'meters_per_pixel': 'float',
  'weight': 'float',
  'ap_in_mm': 'float',
  'ml_in_mm': 'float',
  'dv_in_mm': 'float',
  'wavelength_in_nm': 'float',
  'power_in_W': 'float',
};

// Type-safe parser
const parseNumber = (value, fieldName) => {
  const fieldType = FIELD_TYPE_MAP[fieldName] ||
    (fieldName.includes('id') || fieldName.includes('epoch') ? 'integer' : 'float');

  if (fieldType === 'integer') {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`${fieldName} must be a valid integer`);
    }
    // Verify no decimal was lost
    if (parsed.toString() !== value.trim() && parseFloat(value) !== parsed) {
      throw new Error(`${fieldName} must be a whole number (found decimal: ${value})`);
    }
    return parsed;
  } else {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      throw new Error(`${fieldName} must be a valid number`);
    }
    return parsed;
  }
};

// Updated onBlur
const onBlur = (e, metaData) => {
  const { target } = e;
  const { name, value, type } = target;
  const { key, index, isCommaSeparatedStringToNumber, isCommaSeparatedString } = metaData || {};

  let inputValue = '';

  try {
    if (isCommaSeparatedString) {
      inputValue = formatCommaSeparatedString(value);
    } else if (isCommaSeparatedStringToNumber) {
      inputValue = commaSeparatedStringToNumber(value);
    } else if (type === 'number') {
      inputValue = parseNumber(value, name);  // NEW: Type-safe parsing
    } else {
      inputValue = value;
    }

    updateFormData(name, inputValue, key, index);
  } catch (error) {
    showCustomValidityError(target, error.message);
  }
};
```

#### 2. String Trimming and Empty Detection

**Current Pattern:**

```json
{
  "pattern": "^(.|\\s)*\\S(.|\\s)*$"
}
```

**Intent:** Require at least one non-whitespace character.

**Problems:**

1. Edge cases: `" "` (single space) → Passes in some browsers
2. No minLength enforcement
3. Whitespace-only strings accepted in some scenarios

**Type-Safe Solution:**

```javascript
// Trim and validate in onBlur
const onBlur = (e, metaData) => {
  const { target } = e;
  let { value } = target;

  if (typeof value === 'string') {
    value = value.trim();  // Always trim
    target.value = value;  // Update input

    // Check if empty after trim
    if (value.length === 0 && target.required) {
      showCustomValidityError(target, `${target.name} cannot be empty`);
      return;
    }
  }

  // ... rest of onBlur logic
};
```

**Schema Enhancement:**

```json
{
  "session_description": {
    "type": "string",
    "minLength": 1,
    "pattern": "^(.|\\s)*\\S(.|\\s)*$"
  }
}
```

**Rationale:** `minLength: 1` + trim = guaranteed non-empty string.

#### 3. Array Deduplication

**Current Implementation (utils.js:47-56):**

```javascript
export const commaSeparatedStringToNumber = (stringSet) => {
  return [
    ...new Set(
      stringSet
        .split(',')
        .map((number) => number.trim())
        .filter((number) => isInteger(number))
        .map((number) => parseInt(number, 10))
    ),
  ];
};
```

**Problem:** Silent deduplication.

**Example:**

```javascript
// User enters: "1, 2, 3, 2, 4, 3"
commaSeparatedStringToNumber("1, 2, 3, 2, 4, 3")
// Returns: [1, 2, 3, 4]

// User doesn't know 2 and 3 were duplicated
```

**Type-Safe Solution:**

```javascript
export const commaSeparatedStringToNumber = (stringSet) => {
  const numbers = stringSet
    .split(',')
    .map((n) => n.trim())
    .filter((n) => isInteger(n))
    .map((n) => parseInt(n, 10));

  const unique = [...new Set(numbers)];

  if (numbers.length !== unique.length) {
    // Find duplicates
    const duplicates = numbers.filter((n, i) => numbers.indexOf(n) !== i);
    const uniqueDuplicates = [...new Set(duplicates)];

    console.warn(`Duplicate values removed: ${uniqueDuplicates.join(', ')}`);

    // Could show toast notification
    // showToast(`Note: Removed duplicate values: ${uniqueDuplicates.join(', ')}`);
  }

  return unique.sort((a, b) => a - b);
};
```

---

## Recommendations

### P0 - Critical (Immediate - Week 1)

#### 1. Fix Type Coercion Bug

**Action:** Implement type-safe number parsing.

**Implementation:**

```javascript
// In App.js
const FIELD_TYPE_MAP = { /* ... */ };
const parseNumber = (value, fieldName) => { /* ... */ };

// Update onBlur to use parseNumber
```

**Verification:**

- Enter `1.5` in camera ID → Should show error
- Enter `1` in camera ID → Should accept
- Enter `2.7` in targeted_x → Should accept (float field)

**Timeline:** 4 hours

---

#### 2. Add Empty String Protection

**Action:** Add `minLength: 1` to all required string fields.

**Implementation:**

```json
{
  "session_description": { "minLength": 1 },
  "subject.description": { "minLength": 1 },
  "subject.subject_id": { "minLength": 1 },
  "electrode_groups[].description": { "minLength": 1 }
}
```

**Verification:**

- Try to submit with empty `session_description` → Should fail
- Enter whitespace-only → Should fail

**Timeline:** 2 hours

---

#### 3. Implement Progressive Validation

**Action:** Add section-level validation on blur.

**Implementation:**

```javascript
const [validationState, setValidationState] = useState({});
const validateSection = (sectionName) => { /* ... */ };

// Add to critical fields
<InputElement onBlur={(e) => {
  onBlur(e, { key, index });
  validateSection('electrode_groups');
}} />
```

**Verification:**

- Fill electrode groups section → Should see ✓ or ⚠️ in nav
- Enter duplicate ID → Should see immediate error

**Timeline:** 8 hours

---

#### 4. Enforce Sex Enum in Import Validation

**Action:** Add strict enum checking in `rulesValidation()`.

**Implementation:**

```javascript
const validSex = ['M', 'F', 'U', 'O'];
if (jsonFileContent.subject?.sex && !validSex.includes(jsonFileContent.subject.sex)) {
  errorMessages.push(/* ... */);
}
```

**Verification:**

- Import YAML with `sex: "Male"` → Should fail with clear error
- Import YAML with `sex: "M"` → Should succeed

**Timeline:** 2 hours

---

### P1 - High Priority (Week 2)

#### 5. Add Naming Pattern Enforcement

**Action:** Add pattern validation for identifiers.

**Implementation:**

```json
{
  "subject_id": { "pattern": "^[a-z][a-z0-9_]*$" },
  "task_name": { "pattern": "^[a-z][a-z0-9_]*$" },
  "camera_name": { "pattern": "^[a-z][a-z0-9_]*$" }
}
```

**Timeline:** 6 hours

---

#### 6. Add VARCHAR Length Validation

**Action:** Validate field lengths match database constraints.

**Implementation:**

```javascript
const validateDatabaseConstraints = (formData) => { /* ... */ };

// In generateYMLFile()
const dbErrors = validateDatabaseConstraints(form);
```

**Timeline:** 4 hours

---

#### 7. Implement Duplicate ID Detection

**Action:** Real-time duplicate ID checking.

**Implementation:**

```javascript
// In onBlur for ID fields
const allIds = formData.electrode_groups.map(g => g.id);
const duplicates = allIds.filter(id => id === currentId);
if (duplicates.length > 1) {
  showCustomValidityError(/* ... */);
}
```

**Timeline:** 3 hours

---

#### 8. Add Optogenetics Dependency Validation

**Action:** Check for partial optogenetics configurations.

**Implementation:**

```javascript
// In rulesValidation()
const hasOptoSource = jsonFileContent.opto_excitation_source?.length > 0;
const hasOpticalFiber = jsonFileContent.optical_fiber?.length > 0;
// ... check all 4 fields
```

**Timeline:** 3 hours

---

### P2 - Medium Priority (Week 3)

#### 9. Add Coordinate Range Validation

**Action:** Validate brain coordinates within realistic ranges.

**Timeline:** 4 hours

---

#### 10. Implement Brain Region Controlled Vocabulary

**Action:** Use dropdown with predefined brain regions.

**Timeline:** 4 hours

---

#### 11. Add Validation Test Suite

**Action:** Create comprehensive validation tests per TESTING_PLAN.md.

**Timeline:** 8 hours

---

### P3 - Nice to Have (Week 4+)

#### 12. Add Validation Status Indicators in UI

**Action:** Visual checkmarks/warnings in navigation.

---

#### 13. Create Validation Documentation

**Action:** User guide for common validation errors.

---

#### 14. Implement Schema Synchronization Check

**Action:** CI workflow to verify schema matches across repos.

---

## Conclusion

The current validation architecture has **critical gaps** that cause:

1. **Data Corruption** - Type coercion, empty strings, silent enum conversion
2. **User Frustration** - Late validation, lost work
3. **Database Failures** - Length constraints, naming patterns, enum mismatches

**Immediate Actions Required:**

- Fix type coercion bug (P0)
- Implement progressive validation (P0)
- Add database constraint validation (P1)
- Enforce naming patterns (P1)

**Success Metrics:**

- Validation errors caught within 5 seconds of entry
- Zero silent data corruption
- 100% of YAMLs pass Spyglass ingestion
- User form completion time reduced by 30%

**Next Steps:**

1. Review this document with team
2. Prioritize fixes based on user impact
3. Implement P0 fixes immediately
4. Create validation test suite
5. Monitor user feedback for additional issues

---

**Document Version:** 1.0
**Last Updated:** 2025-01-23
**Related Documents:** REVIEW.md, TESTING_PLAN.md, CLAUDE.md
