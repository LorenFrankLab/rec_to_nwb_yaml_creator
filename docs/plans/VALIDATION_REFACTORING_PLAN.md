# Validation System Refactoring Plan

**Created:** 2025-10-26
**Status:** In Progress
**Branch:** `modern`
**Related Task:** Phase 3, Week 1-2: Promote validation utilities → pure validation system

---

## Executive Summary

Refactor the current validation system from a monolithic "validate on submit" approach to a **layered, event-driven architecture** that provides:

1. **Instant feedback** while typing (quick checks, debounced)
2. **Field-scoped validation** on blur (full validation for that field)
3. **Global validation** on demand (Validate All button or before export)

All while maintaining **backward compatibility**, **deterministic behavior**, and **100% test coverage**.

---

## Current State Analysis

### Existing Code Structure

```
src/utils/validation.js (158 LOC)
├── jsonschemaValidation(formContent)
│   └── Uses AJV with JSON Schema
│   └── Returns: { valid, isValid, jsonSchemaErrorMessages, jsonSchemaErrors, jsonSchemaErrorIds, errors }
│
└── rulesValidation(jsonFileContent)
    └── Custom business logic
    └── Returns: { isFormValid, formErrors, formErrorIds, errors }
```

### Current Usage Pattern

```javascript
// In App.js (line 491-510)
const validation = jsonschemaValidation(form);
const { isFormValid, formErrors } = rulesValidation(form);

if (!validation.isValid) {
  // Show each AJV error
  validation.errors.forEach(error => showErrorMessage(error));
} else if (!isFormValid) {
  // Show custom rule errors
  formErrors.forEach(error => displayErrorOnUI(error.id, error.message));
}
```

### Problems with Current Approach

1. **No instant feedback** - users only see errors after clicking "Generate YAML"
2. **All-or-nothing validation** - can't validate individual fields
3. **Inconsistent error format** - AJV errors vs. custom errors have different structures
4. **DOM coupling** - error display logic directly manipulates DOM via `querySelector`
5. **No accessibility** - errors not properly announced to screen readers
6. **Hard to test** - validation mixed with error display logic

---

## Target Architecture

### New Directory Structure

```
src/validation/
├── index.js                   # Public API: validate(model)
├── schemaValidation.js        # AJV schema validation
├── rulesValidation.js         # Custom business logic
├── paths.js                   # Path normalization utilities
├── quickChecks.js             # Instant feedback checks
└── __tests__/
    ├── schemaValidation.test.js
    ├── rulesValidation.test.js
    ├── paths.test.js
    ├── quickChecks.test.js
    └── integration.test.js
```

### Unified Issue Type

```typescript
interface Issue {
  path: string;           // Normalized path: "subject.weight", "cameras[0].id"
  code: string;           // Error code: "required", "pattern", "duplicate_channels"
  severity: "error" | "warning";
  message: string;        // User-friendly message
  instancePath?: string;  // Original AJV path (for debugging)
  schemaPath?: string;    // Original AJV schema path (for debugging)
}
```

### Three-Layer Validation

```
Layer 1: Quick Checks (onChange, debounced 250ms)
├── Runs: Simple synchronous checks (required, format, enum, type)
├── Purpose: Instant hints while typing
└── Display: Subtle text below input (NOT role="alert")

Layer 2: Field Validation (onBlur)
├── Runs: Full validation for that field's subtree
├── Purpose: Comprehensive field-level feedback
└── Display: Error text with role="alert", aria-describedby

Layer 3: Global Validation (onDemand)
├── Runs: Full schema + rules validation
├── Purpose: Pre-export validation, cross-field checks
└── Display: Summary panel + focus first error
```

---

## Implementation Phases

### Phase 1: Validation Architecture Setup (TDD)

**Goal:** Refactor existing validation with unified Issue[] return type

#### Step 1.1: Write Tests FIRST

Create `src/validation/__tests__/integration.test.js`:

```javascript
describe('Unified Validation API', () => {
  it('should return empty array for valid model', () => {
    const model = createTestYaml();
    const issues = validate(model);
    expect(issues).toEqual([]);
  });

  it('should return sorted issues for invalid model', () => {
    const model = { ...createTestYaml(), experimenter: '' };
    const issues = validate(model);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'experimenter',
      code: 'pattern',
      severity: 'error',
      message: expect.stringContaining('cannot be empty')
    });
  });

  it('should combine schema and rules validation issues', () => {
    const model = {
      ...createTestYaml(),
      experimenter: '',  // Schema violation
      tasks: [{ camera_ids: [0] }],  // Rules violation (no cameras)
      cameras: undefined
    };
    const issues = validate(model);

    expect(issues.length).toBeGreaterThan(1);
    expect(issues.some(i => i.code === 'pattern')).toBe(true);
    expect(issues.some(i => i.code === 'missing_camera')).toBe(true);
  });

  it('should sort issues deterministically (path + code)', () => {
    const model = { /* multiple errors */ };
    const issues1 = validate(model);
    const issues2 = validate(model);

    expect(issues1).toEqual(issues2);
  });
});
```

#### Step 1.2: Create Directory Structure

```bash
mkdir -p src/validation/__tests__
```

#### Step 1.3: Move and Refactor schemaValidation.js

**Test file:** `src/validation/__tests__/schemaValidation.test.js`

```javascript
describe('schemaValidation()', () => {
  it('should return empty array for valid model', () => {
    const model = createTestYaml();
    const issues = schemaValidation(model);
    expect(issues).toEqual([]);
  });

  it('should return Issue[] for AJV errors', () => {
    const model = { ...createTestYaml(), experimenter: '' };
    const issues = schemaValidation(model);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'experimenter',
      code: 'pattern',
      severity: 'error',
      message: expect.any(String),
      instancePath: '/experimenter',
      schemaPath: expect.any(String)
    });
  });

  it('should normalize AJV paths to dot notation', () => {
    const model = { ...createTestYaml(), subject: { weight: -1 } };
    const issues = schemaValidation(model);

    expect(issues[0].path).toBe('subject.weight');
    expect(issues[0].instancePath).toBe('/subject/weight');
  });

  it('should handle array paths correctly', () => {
    const model = { ...createTestYaml(), cameras: [{ id: null }] };
    const issues = schemaValidation(model);

    expect(issues[0].path).toBe('cameras[0].id');
    expect(issues[0].instancePath).toBe('/cameras/0/id');
  });
});
```

**Implementation:** `src/validation/schemaValidation.js`

```javascript
import addFormats from 'ajv-formats';
import JsonSchemaFile from '../nwb_schema.json';
import { normalizeAjvPath } from './paths';
const Ajv = require('ajv');

/**
 * Validates model against NWB JSON schema using AJV
 *
 * @param {object} model - The form data to validate
 * @returns {Issue[]} Array of validation issues
 */
export const schemaValidation = (model) => {
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(JsonSchemaFile);

  validate(model);

  if (!validate.errors) {
    return [];
  }

  return validate.errors.map(error => ({
    path: normalizeAjvPath(error.instancePath),
    code: error.keyword,
    severity: 'error',
    message: sanitizeMessage(error.message, error.instancePath),
    instancePath: error.instancePath,
    schemaPath: error.schemaPath
  }));
};

function sanitizeMessage(message, instancePath) {
  if (message === 'must match pattern "^.+$"') {
    const fieldName = instancePath.split('/').filter(x => x).join('.');
    return `${fieldName} cannot be empty nor all whitespace`;
  }
  if (instancePath === '/subject/date_of_birth') {
    return 'Date of birth needs to comply with ISO 8601 format';
  }
  return message;
}
```

#### Step 1.4: Create paths.js Utility

**Test file:** `src/validation/__tests__/paths.test.js`

```javascript
describe('normalizeAjvPath()', () => {
  it('should convert root paths', () => {
    expect(normalizeAjvPath('/experimenter')).toBe('experimenter');
  });

  it('should convert nested paths', () => {
    expect(normalizeAjvPath('/subject/weight')).toBe('subject.weight');
  });

  it('should convert array paths', () => {
    expect(normalizeAjvPath('/cameras/0/id')).toBe('cameras[0].id');
    expect(normalizeAjvPath('/cameras/0/manufacturer')).toBe('cameras[0].manufacturer');
  });

  it('should handle complex nested arrays', () => {
    expect(normalizeAjvPath('/electrode_groups/0/targeted_x')).toBe('electrode_groups[0].targeted_x');
  });

  it('should handle empty path', () => {
    expect(normalizeAjvPath('')).toBe('');
  });
});
```

**Implementation:** `src/validation/paths.js`

```javascript
/**
 * Converts AJV instancePath to normalized dot notation
 *
 * Examples:
 *   /experimenter → experimenter
 *   /subject/weight → subject.weight
 *   /cameras/0/id → cameras[0].id
 *
 * @param {string} ajvPath - AJV instancePath (slash-separated)
 * @returns {string} Normalized path (dot notation with array brackets)
 */
export function normalizeAjvPath(ajvPath) {
  if (!ajvPath || ajvPath === '/') return '';

  const parts = ajvPath.split('/').filter(x => x);

  return parts.map((part, index) => {
    // Check if this part is a number (array index)
    if (/^\d+$/.test(part) && index > 0) {
      return `[${part}]`;
    }
    // First part or named property
    if (index === 0) return part;
    // Add dot before named property (but not before array index)
    return `.${part}`;
  }).join('').replace(/\.\[/g, '[');
}
```

#### Step 1.5: Refactor rulesValidation.js

**Test file:** `src/validation/__tests__/rulesValidation.test.js`

```javascript
describe('rulesValidation()', () => {
  it('should return empty array for valid model', () => {
    const model = createTestYaml();
    const issues = rulesValidation(model);
    expect(issues).toEqual([]);
  });

  it('should detect tasks without cameras', () => {
    const model = {
      ...createTestYaml(),
      tasks: [{ camera_ids: [0] }],
      cameras: undefined
    };
    const issues = rulesValidation(model);

    expect(issues).toContainEqual(expect.objectContaining({
      path: 'tasks',
      code: 'missing_camera',
      severity: 'error'
    }));
  });

  it('should detect associated_video_files without cameras', () => {
    const model = {
      ...createTestYaml(),
      associated_video_files: [{ camera_id: 0 }],
      cameras: undefined
    };
    const issues = rulesValidation(model);

    expect(issues).toContainEqual(expect.objectContaining({
      path: 'associated_video_files',
      code: 'missing_camera',
      severity: 'error'
    }));
  });

  it('should detect partial optogenetics configuration', () => {
    const model = {
      ...createTestYaml(),
      opto_excitation_source: [{ /* ... */ }],
      optical_fiber: undefined,
      virus_injection: undefined
    };
    const issues = rulesValidation(model);

    expect(issues).toContainEqual(expect.objectContaining({
      path: 'optogenetics',
      code: 'partial_configuration',
      severity: 'error'
    }));
  });

  it('should detect duplicate channel mappings', () => {
    const model = {
      ...createTestYaml(),
      ntrode_electrode_group_channel_map: [{
        ntrode_id: 1,
        map: { 0: 5, 1: 5, 2: 6, 3: 7 }  // Duplicate: 5
      }]
    };
    const issues = rulesValidation(model);

    expect(issues).toContainEqual(expect.objectContaining({
      path: 'ntrode_electrode_group_channel_map[1]',
      code: 'duplicate_channels',
      severity: 'error'
    }));
  });
});
```

**Implementation:** `src/validation/rulesValidation.js`

```javascript
/**
 * Custom business logic validation rules
 *
 * @param {object} model - The form data to validate
 * @returns {Issue[]} Array of validation issues
 */
export const rulesValidation = (model) => {
  const issues = [];

  // Rule 1: Tasks with camera_ids require cameras
  if (!model.cameras && model.tasks?.length > 0) {
    issues.push({
      path: 'tasks',
      code: 'missing_camera',
      severity: 'error',
      message: 'Tasks have camera_ids, but no cameras are defined'
    });
  }

  // Rule 2: Associated video files with camera_ids require cameras
  if (!model.cameras && model.associated_video_files?.length > 0) {
    issues.push({
      path: 'associated_video_files',
      code: 'missing_camera',
      severity: 'error',
      message: 'Associated video files have camera_ids, but no cameras are defined'
    });
  }

  // Rule 3: Optogenetics all-or-nothing
  const hasOptoSource = model.opto_excitation_source?.length > 0;
  const hasOpticalFiber = model.optical_fiber?.length > 0;
  const hasVirusInjection = model.virus_injection?.length > 0;
  const optoFieldsPresent = [hasOptoSource, hasOpticalFiber, hasVirusInjection].filter(Boolean).length;

  if (optoFieldsPresent > 0 && optoFieldsPresent < 3) {
    issues.push({
      path: 'optogenetics',
      code: 'partial_configuration',
      severity: 'error',
      message:
        `Partial optogenetics configuration detected. All fields required: ` +
        `opto_excitation_source${hasOptoSource ? ' ✓' : ' ✗'}, ` +
        `optical_fiber${hasOpticalFiber ? ' ✓' : ' ✗'}, ` +
        `virus_injection${hasVirusInjection ? ' ✓' : ' ✗'}`
    });
  }

  // Rule 4: No duplicate channel mappings
  if (model.ntrode_electrode_group_channel_map?.length > 0) {
    model.ntrode_electrode_group_channel_map.forEach((ntrode, index) => {
      if (ntrode.map && typeof ntrode.map === 'object') {
        const channelValues = Object.values(ntrode.map);
        const uniqueValues = new Set(channelValues);

        if (channelValues.length !== uniqueValues.size) {
          const duplicates = channelValues.filter(
            (value, i) => channelValues.indexOf(value) !== i
          );
          const uniqueDuplicates = [...new Set(duplicates)];

          issues.push({
            path: `ntrode_electrode_group_channel_map[${ntrode.ntrode_id}]`,
            code: 'duplicate_channels',
            severity: 'error',
            message:
              `Ntrode ${ntrode.ntrode_id} has duplicate channel mappings. ` +
              `Physical channel(s) ${uniqueDuplicates.join(', ')} are mapped ` +
              `to multiple logical channels.`
          });
        }
      }
    });
  }

  return issues;
};
```

#### Step 1.6: Create Unified validate() Function

**Implementation:** `src/validation/index.js`

```javascript
import { schemaValidation } from './schemaValidation';
import { rulesValidation } from './rulesValidation';

/**
 * Unified validation function combining schema and rules validation
 *
 * @param {object} model - The form data to validate
 * @returns {Issue[]} Sorted array of all validation issues
 */
export function validate(model) {
  const schemaIssues = schemaValidation(model);
  const rulesIssues = rulesValidation(model);

  const allIssues = [...schemaIssues, ...rulesIssues];

  // Sort deterministically: path first, then code
  return allIssues.sort((a, b) => {
    if (a.path !== b.path) {
      return a.path.localeCompare(b.path);
    }
    return a.code.localeCompare(b.code);
  });
}

/**
 * Validates a specific field path and returns only issues for that subtree
 *
 * @param {object} model - The form data to validate
 * @param {string} fieldPath - Dot notation path (e.g., "subject.weight")
 * @returns {Issue[]} Issues for that field and its children
 */
export function validateField(model, fieldPath) {
  const allIssues = validate(model);

  // Filter to issues that start with fieldPath
  return allIssues.filter(issue =>
    issue.path === fieldPath || issue.path.startsWith(fieldPath + '.')
  );
}

// Re-export for backward compatibility
export { schemaValidation, rulesValidation };
```

#### Step 1.7: Update Imports in App.js

```javascript
// Old imports
import { jsonschemaValidation, rulesValidation } from './utils/validation';

// New imports
import { validate, validateField } from './validation';

// Update usage (line 491-493)
const issues = validate(form);
const hasErrors = issues.some(i => i.severity === 'error');

if (hasErrors) {
  // Display errors (to be refactored in Phase 2)
  issues.forEach(issue => {
    // ... error display logic
  });
}
```

#### Step 1.8: Maintain Backward Compatibility

Keep `src/utils/validation.js` as a thin wrapper:

```javascript
/**
 * @deprecated Use src/validation/index.js instead
 * This file maintains backward compatibility with existing code
 */
import { schemaValidation, rulesValidation } from '../validation';

// Legacy format converter
function issuesToLegacyFormat(issues) {
  return {
    valid: issues.length === 0,
    isValid: issues.length === 0,
    jsonSchemaErrorMessages: issues.map(i => i.message),
    jsonSchemaErrors: issues.length > 0 ? issues : null,
    jsonSchemaErrorIds: [...new Set(issues.map(i => i.path.split(/[.\[]/).0))],
    errors: issues.length > 0 ? issues : null
  };
}

export function jsonschemaValidation(formContent) {
  const issues = schemaValidation(formContent);
  return issuesToLegacyFormat(issues);
}

export function rulesValidation(formContent) {
  const issues = rulesValidation(formContent);
  return {
    isFormValid: issues.length === 0,
    formErrors: issues.map(i => i.message),
    formErrorIds: issues.map(i => i.path.split(/[.\[]/)[ 0]),
    errors: issues
  };
}
```

---

### Phase 2: Quick Checks Layer (Instant Feedback)

**Goal:** Add lightweight synchronous checks for instant hints

#### Step 2.1: Write Tests FIRST

`src/validation/__tests__/quickChecks.test.js`:

```javascript
describe('quickChecks()', () => {
  it('should return null for valid required field', () => {
    const hint = quickChecks.required('experimenter', 'John Doe');
    expect(hint).toBeNull();
  });

  it('should return hint for empty required field', () => {
    const hint = quickChecks.required('experimenter', '');
    expect(hint).toMatchObject({
      severity: 'hint',
      message: 'This field is required'
    });
  });

  it('should return hint for invalid date format', () => {
    const hint = quickChecks.dateFormat('session_start_time', '2023-13-45');
    expect(hint).toMatchObject({
      severity: 'hint',
      message: expect.stringContaining('ISO 8601')
    });
  });

  it('should return null for valid enum value', () => {
    const hint = quickChecks.enum('subject.sex', 'M', ['M', 'F', 'U']);
    expect(hint).toBeNull();
  });

  it('should return hint for invalid enum value', () => {
    const hint = quickChecks.enum('subject.sex', 'X', ['M', 'F', 'U']);
    expect(hint).toMatchObject({
      severity: 'hint',
      message: expect.stringContaining('Must be one of')
    });
  });
});
```

#### Step 2.2: Implement quickChecks.js

`src/validation/quickChecks.js`:

```javascript
/**
 * Lightweight synchronous checks for instant feedback
 * These run on debounced onChange (250-400ms)
 *
 * Returns null if valid, or a hint object if invalid:
 * { severity: 'hint', message: string }
 */

export const quickChecks = {
  required(path, value) {
    if (!value || value.trim() === '') {
      return { severity: 'hint', message: 'This field is required' };
    }
    return null;
  },

  dateFormat(path, value) {
    if (!value) return null;

    const iso8601Pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    if (!iso8601Pattern.test(value)) {
      return {
        severity: 'hint',
        message: 'Date must be in ISO 8601 format (YYYY-MM-DDTHH:MM:SS)'
      };
    }
    return null;
  },

  enum(path, value, validValues) {
    if (!value) return null;

    if (!validValues.includes(value)) {
      return {
        severity: 'hint',
        message: `Must be one of: ${validValues.join(', ')}`
      };
    }
    return null;
  },

  numberRange(path, value, min, max) {
    const num = parseFloat(value);
    if (isNaN(num)) return null;

    if (min !== undefined && num < min) {
      return { severity: 'hint', message: `Must be at least ${min}` };
    }
    if (max !== undefined && num > max) {
      return { severity: 'hint', message: `Must be at most ${max}` };
    }
    return null;
  }
};
```

#### Step 2.3: Create useQuickChecks Hook

`src/hooks/useQuickChecks.js`:

```javascript
import { useState, useCallback } from 'react';
import { quickChecks } from '../validation/quickChecks';
import { useDebouncedCallback } from 'use-debounce';

/**
 * Hook for instant validation hints (debounced onChange)
 *
 * @param {string} path - Field path (dot notation)
 * @param {any} value - Current field value
 * @param {object} checkConfig - Quick check configuration
 * @returns {object} { hint, isChecking }
 */
export function useQuickChecks(path, value, checkConfig = {}) {
  const [hint, setHint] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const runChecks = useCallback(() => {
    if (!checkConfig) {
      setHint(null);
      return;
    }

    // Run configured checks
    if (checkConfig.required) {
      const result = quickChecks.required(path, value);
      if (result) {
        setHint(result);
        setIsChecking(false);
        return;
      }
    }

    if (checkConfig.dateFormat) {
      const result = quickChecks.dateFormat(path, value);
      if (result) {
        setHint(result);
        setIsChecking(false);
        return;
      }
    }

    if (checkConfig.enum) {
      const result = quickChecks.enum(path, value, checkConfig.enum);
      if (result) {
        setHint(result);
        setIsChecking(false);
        return;
      }
    }

    // All checks passed
    setHint(null);
    setIsChecking(false);
  }, [path, value, checkConfig]);

  const debouncedCheck = useDebouncedCallback(() => {
    runChecks();
  }, 250);

  // Trigger check when value changes
  React.useEffect(() => {
    if (value) {
      setIsChecking(true);
      debouncedCheck();
    } else {
      setHint(null);
      setIsChecking(false);
    }
  }, [value, debouncedCheck]);

  return { hint, isChecking };
}
```

---

### Phase 3: Field-Scoped Validation (onBlur)

**Goal:** Add comprehensive validation on blur

#### Step 3.1: Create useFieldValidation Hook

`src/hooks/useFieldValidation.js`:

```javascript
import { useState, useCallback } from 'react';
import { validateField } from '../validation';

/**
 * Hook for field-scoped validation (onBlur)
 *
 * @param {object} model - Full form model
 * @param {string} path - Field path (dot notation)
 * @returns {object} { errors, validateOnBlur }
 */
export function useFieldValidation(model, path) {
  const [errors, setErrors] = useState([]);

  const validateOnBlur = useCallback(() => {
    const issues = validateField(model, path);
    const fieldErrors = issues.filter(i => i.severity === 'error');
    setErrors(fieldErrors);
  }, [model, path]);

  return { errors, validateOnBlur };
}
```

---

### Phase 4: Full-Form Validation (onDemand)

**Goal:** Implement "Validate All" workflow

#### Step 4.1: Create Validation Context

`src/contexts/ValidationContext.js`:

```javascript
import React, { createContext, useContext, useState, useCallback } from 'react';
import { validate } from '../validation';

const ValidationContext = createContext(null);

export function ValidationProvider({ children }) {
  const [globalIssues, setGlobalIssues] = useState([]);
  const [fieldIssues, setFieldIssues] = useState({});

  const validateAll = useCallback((model) => {
    const issues = validate(model);
    setGlobalIssues(issues);

    // Group issues by field path
    const grouped = issues.reduce((acc, issue) => {
      if (!acc[issue.path]) acc[issue.path] = [];
      acc[issue.path].push(issue);
      return acc;
    }, {});
    setFieldIssues(grouped);

    return issues;
  }, []);

  const clearValidation = useCallback(() => {
    setGlobalIssues([]);
    setFieldIssues({});
  }, []);

  return (
    <ValidationContext.Provider value={{
      globalIssues,
      fieldIssues,
      validateAll,
      clearValidation
    }}>
      {children}
    </ValidationContext.Provider>
  );
}

export function useValidation() {
  const context = useContext(ValidationContext);
  if (!context) {
    throw new Error('useValidation must be used within ValidationProvider');
  }
  return context;
}
```

---

## Exit Criteria

- [ ] All existing tests pass (1310+)
- [ ] New validation tests added (50+ tests)
- [ ] Golden YAML output unchanged
- [ ] Issue[] format standardized
- [ ] Backward compatibility maintained
- [ ] Code review approval
- [ ] Documentation updated

---

## Timeline Estimate

- **Phase 1 (Architecture):** 8-10 hours
- **Phase 2 (Quick Checks):** 4-6 hours
- **Phase 3 (Field Validation):** 4-6 hours
- **Phase 4 (Global Validation):** 4-6 hours
- **Testing & Polish:** 4-6 hours

**Total:** 24-34 hours (3-4 days)

---

## Risks & Mitigation

### Risk 1: Breaking Existing Validation

**Mitigation:**

- Maintain backward compatibility wrapper in `src/utils/validation.js`
- Run full test suite after each change
- Verify golden YAML unchanged

### Risk 2: Performance Regression

**Mitigation:**

- Profile validation performance before/after
- Use debouncing for onChange checks
- Lazy load validation only when needed

### Risk 3: Accessibility Issues

**Mitigation:**

- Use `aria-describedby` for error associations
- Use `role="alert"` for field errors (not hints)
- Test with screen reader
- Ensure keyboard navigation works

---

## References

- [TASKS.md](../TASKS.md) - Overall refactoring tasks
- [COMPREHENSIVE_REFACTORING_PLAN.md](COMPREHENSIVE_REFACTORING_PLAN.md) - Overall project plan
- Current validation code: `src/utils/validation.js`
- Current error display: `src/utils/errorDisplay.js`
- Existing tests: `src/__tests__/unit/app/App-validation-system.test.jsx`
