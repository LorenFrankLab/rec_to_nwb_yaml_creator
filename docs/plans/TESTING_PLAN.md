# Comprehensive Testing Strategy for rec_to_nwb_yaml_creator & trodes_to_nwb

**Created:** 2025-01-23
**Purpose:** Ensure Claude Code changes can be verified before deployment
**Scope:** Both repositories with emphasis on integration testing

---

## Table of Contents

1. [Overview & Philosophy](#overview--philosophy)
2. [Testing Architecture](#testing-architecture)
3. [Current State Analysis](#current-state-analysis)
4. [Unit Testing Strategy](#unit-testing-strategy)
5. [Integration Testing Strategy](#integration-testing-strategy)
6. [End-to-End Testing Strategy](#end-to-end-testing-strategy)
7. [Schema & Validation Testing](#schema--validation-testing)
8. [CI/CD Pipeline](#cicd-pipeline)
9. [Test Data Management](#test-data-management)
10. [Testing Workflows for Claude Code](#testing-workflows-for-claude-code)
11. [Verification Checklists](#verification-checklists)

---

## Overview & Philosophy

### Core Principle: Prevention Over Detection

This testing strategy prioritizes **preventing bad data from entering the NWB ecosystem** over catching errors downstream. Given that:

- Neuroscientists input critical experimental metadata manually
- Data flows to DANDI archive for public consumption
- Errors corrupt scientific datasets permanently
- Users may work 30+ minutes before discovering validation failures

**Our testing must be:**

1. **Fast** - Provide feedback in <5 seconds for unit tests, <30 seconds for integration
2. **Comprehensive** - Cover all code paths where data transformations occur
3. **Deterministic** - No flaky tests; every failure indicates a real problem
4. **User-Centric** - Test from the neuroscientist's perspective, not just code coverage
5. **Integration-Focused** - Emphasize cross-repository contract testing

### Testing Pyramid

```
                    /\
                   /  \
                  / E2E \         10% - Full pipeline tests
                 /--------\
                /          \
               / Integration \    30% - Cross-repo, schema sync
              /--------------\
             /                \
            /   Unit Tests     \  60% - Component, function level
           /--------------------\
```

---

## Testing Architecture

### Tool Selection

#### rec_to_nwb_yaml_creator (JavaScript/React)

**Current Stack:**

- Jest (via `react-scripts test`)
- React Testing Library (included with create-react-app)

**Additions Needed:**

```json
{
  "devDependencies": {
    "@testing-library/user-event": "^14.5.1",
    "@testing-library/jest-dom": "^6.1.5",
    "msw": "^2.0.11",  // Mock Service Worker for file I/O
    "jest-environment-jsdom": "^29.7.0"
  }
}
```

#### trodes_to_nwb (Python)

**Current Stack:**

- pytest
- pytest-cov
- pytest-mock

**Additions Needed:**

```toml
[project.optional-dependencies]
test = [
    "pytest>=7.4.0",
    "pytest-cov>=4.1.0",
    "pytest-mock>=3.11.1",
    "pytest-xdist>=3.3.1",  # Parallel test execution
    "hypothesis>=6.88.0",   # Property-based testing
    "freezegun>=1.2.2",     # Time mocking for date tests
]
```

### Test Organization

```
rec_to_nwb_yaml_creator/
├── src/
│   ├── __tests__/
│   │   ├── unit/
│   │   │   ├── validation/
│   │   │   ├── state/
│   │   │   ├── transforms/
│   │   │   └── ntrode/
│   │   ├── integration/
│   │   │   ├── schema-sync.test.js
│   │   │   ├── device-types.test.js
│   │   │   └── yaml-generation.test.js
│   │   └── e2e/
│   │       ├── full-form-flow.test.js
│   │       └── import-export.test.js
│   └── test-fixtures/
│       ├── sample-yamls/
│       ├── invalid-yamls/
│       └── edge-cases/

trodes_to_nwb/
├── src/trodes_to_nwb/tests/
│   ├── unit/
│   │   ├── test_metadata_validation.py
│   │   ├── test_convert_yaml.py
│   │   └── test_convert_rec_header.py
│   ├── integration/
│   │   ├── test_schema_compliance.py
│   │   ├── test_web_app_integration.py
│   │   └── test_device_metadata_sync.py
│   ├── e2e/
│   │   └── test_full_conversion_pipeline.py
│   └── fixtures/
│       ├── valid_yamls/
│       ├── invalid_yamls/
│       └── sample_rec_files/
```

---

## Current State Analysis

### rec_to_nwb_yaml_creator

**Current Coverage:**

```javascript
// src/App.test.js (8 lines)
it('renders without crashing', () => {
  const div = document.createElement('div');
  ReactDOM.render(<App />, div);
});
```

**Coverage:** ~0% (smoke test only)

**Critical Gaps:**

- ❌ No validation testing
- ❌ No state management testing
- ❌ No form interaction testing
- ❌ No YAML generation testing
- ❌ No import/export testing
- ❌ No electrode group logic testing

### trodes_to_nwb

**Current Coverage:**

- 15 test files
- ~70% code coverage (estimated from pyproject.toml config)

**Strengths:**

- ✅ Good unit test coverage for conversion modules
- ✅ Integration tests for metadata validation
- ✅ Memory usage tests

**Critical Gaps:**

- ❌ No tests for date_of_birth bug (see REVIEW.md)
- ❌ No cross-repository schema validation
- ❌ No device type synchronization tests
- ❌ Limited error message clarity testing

---

## Unit Testing Strategy

### JavaScript Unit Tests

#### 1. Validation Testing

**File:** `src/__tests__/unit/validation/json-schema-validation.test.js`

**Purpose:** Verify JSON schema validation catches all error cases

**Test Categories:**

```javascript
import { jsonschemaValidation } from '../../../App';
import schema from '../../../nwb_schema.json';

describe('JSON Schema Validation', () => {
  describe('Required Fields', () => {
    it('should reject missing experimenter', () => {
      const invalidData = { /* missing experimenter */ };
      const result = jsonschemaValidation(invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('experimenter');
    });

    it('should reject missing session_id', () => {
      // Test each required field individually
    });
  });

  describe('Type Validation', () => {
    it('should reject float camera_id (must be integer)', () => {
      const data = {
        cameras: [{ id: 1.5 }]  // BUG: currently accepts this
      };
      const result = jsonschemaValidation(data);
      expect(result.valid).toBe(false);
    });

    it('should reject string for numeric fields', () => {
      // Test type coercion edge cases
    });
  });

  describe('Pattern Validation', () => {
    it('should enforce date format YYYY-MM-DD', () => {
      const data = {
        session_start_time: '01/23/2025'  // Wrong format
      };
      const result = jsonschemaValidation(data);
      expect(result.valid).toBe(false);
    });
  });

  describe('Custom Rules', () => {
    it('should reject tasks with camera_ids but no cameras defined', () => {
      const data = {
        tasks: [{ camera_id: [1, 2] }],
        cameras: []
      };
      const result = jsonschemaValidation(data);
      expect(result.valid).toBe(false);
    });
  });
});
```

**Coverage Target:** 100% of validation rules in `nwb_schema.json`

#### 2. State Management Testing

**File:** `src/__tests__/unit/state/form-data-updates.test.js`

```javascript
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';

describe('Form State Updates', () => {
  describe('updateFormData', () => {
    it('should update simple field', () => {
      // Test simple key-value updates
    });

    it('should update nested object field', () => {
      const formData = { cameras: [{ id: 0, model: '' }] };
      // Update cameras[0].model
      // Verify immutability with structuredClone
    });

    it('should update nested array item', () => {
      // Test array item updates
    });
  });

  describe('Electrode Group & Ntrode Synchronization', () => {
    it('should remove ntrode maps when electrode group deleted', () => {
      const formData = {
        electrode_groups: [{ id: 0 }, { id: 1 }],
        ntrode_electrode_group_channel_map: [
          { electrode_group_id: 0 },
          { electrode_group_id: 1 }
        ]
      };
      // Remove electrode_groups[0]
      // Verify corresponding ntrode map also removed
    });

    it('should duplicate ntrode maps when electrode group duplicated', () => {
      // Test duplication with ID auto-increment
    });
  });
});
```

#### 3. Transform Functions Testing

**File:** `src/__tests__/unit/transforms/data-transforms.test.js`

```javascript
import {
  commaSeparatedStringToNumber,
  formatCommaSeparatedString,
  isInteger,
  isNumeric
} from '../../../utils';

describe('Data Transforms', () => {
  describe('commaSeparatedStringToNumber', () => {
    it('should parse comma-separated integers', () => {
      expect(commaSeparatedStringToNumber('1, 2, 3')).toEqual([1, 2, 3]);
    });

    it('should filter out non-integers', () => {
      expect(commaSeparatedStringToNumber('1, abc, 2.5, 3')).toEqual([1, 3]);
      // CRITICAL: Currently accepts 2.5, causing type bugs
    });

    it('should deduplicate values', () => {
      expect(commaSeparatedStringToNumber('1, 2, 1, 3')).toEqual([1, 2, 3]);
    });

    it('should handle empty string', () => {
      expect(commaSeparatedStringToNumber('')).toEqual([]);
    });
  });

  describe('Type Validators', () => {
    it('isInteger should reject floats', () => {
      expect(isInteger('1.5')).toBe(false);
      expect(isInteger('1')).toBe(true);
    });

    it('isNumeric should accept floats', () => {
      expect(isNumeric('1.5')).toBe(true);
      expect(isNumeric('-3.14')).toBe(true);
    });
  });
});
```

#### 4. Ntrode Channel Mapping Testing

**File:** `src/__tests__/unit/ntrode/channel-map.test.js`

```javascript
import { deviceTypeMap, getShankCount } from '../../../ntrode/deviceTypes';

describe('Device Type Mapping', () => {
  it('should return correct channel map for tetrode_12.5', () => {
    const result = deviceTypeMap('tetrode_12.5');
    expect(result).toHaveLength(4);
    expect(result[0].map).toEqual({ 0: 0, 1: 1, 2: 2, 3: 3 });
  });

  it('should handle 128-channel probe correctly', () => {
    const result = deviceTypeMap('128c-4s6mm6cm-15um-26um-sl');
    expect(result).toHaveLength(32);  // 32 ntrodes * 4 channels
  });

  it('should reject invalid device types', () => {
    expect(() => deviceTypeMap('nonexistent_probe')).toThrow();
  });
});
```

### Python Unit Tests

#### 1. Metadata Validation Testing

**File:** `src/trodes_to_nwb/tests/unit/test_metadata_validation_comprehensive.py`

```python
import datetime
import pytest
from freezegun import freeze_time
from trodes_to_nwb.metadata_validation import validate

class TestDateOfBirthValidation:
    """Critical tests for date_of_birth bug identified in REVIEW.md"""

    @freeze_time("2025-01-23 15:30:00")
    def test_date_of_birth_not_corrupted(self):
        """CRITICAL: Verify date_of_birth is not overwritten with current time"""
        metadata = {
            "subject": {
                "date_of_birth": datetime.datetime(2023, 6, 15, 0, 0, 0)
            }
        }

        result = validate(metadata)

        # Should preserve original date, NOT current time
        assert result["subject"]["date_of_birth"] == "2023-06-15T00:00:00"
        assert "2025-01-23" not in result["subject"]["date_of_birth"]

    def test_date_of_birth_iso_format(self):
        """Verify datetime is converted to ISO 8601 string"""
        metadata = {
            "subject": {
                "date_of_birth": datetime.datetime(2023, 6, 15)
            }
        }

        result = validate(metadata)
        assert isinstance(result["subject"]["date_of_birth"], str)
        assert result["subject"]["date_of_birth"].startswith("2023-06-15")

class TestSchemaValidation:
    def test_missing_required_fields_rejected(self):
        """Verify schema catches missing required fields"""
        invalid_metadata = {}  # Missing all required fields

        with pytest.raises(jsonschema.ValidationError):
            validate(invalid_metadata)

    def test_type_mismatches_rejected(self):
        """Verify schema enforces type constraints"""
        metadata = {
            "cameras": [{"id": "not_an_integer"}]
        }

        with pytest.raises(jsonschema.ValidationError) as exc_info:
            validate(metadata)

        assert "type" in str(exc_info.value)
```

#### 2. Hardware Channel Mapping Testing

**File:** `src/trodes_to_nwb/tests/unit/test_hardware_channel_validation.py`

```python
import pytest
from trodes_to_nwb.convert_rec_header import (
    make_hw_channel_map,
    validate_yaml_header_electrode_map
)

class TestHardwareChannelMapping:
    def test_duplicate_channel_detection(self):
        """CRITICAL: Detect when same hardware channel mapped twice"""
        metadata = {
            "ntrode_electrode_group_channel_map": [
                {"ntrode_id": 0, "map": {0: 10, 1: 11}},
                {"ntrode_id": 1, "map": {0: 10, 1: 12}}  # Duplicate ch 10
            ]
        }

        with pytest.raises(ValueError, match="duplicate.*channel 10"):
            validate_yaml_header_electrode_map(metadata, spike_config)

    def test_missing_channel_detection(self):
        """Detect when YAML references channels not in hardware"""
        metadata = {
            "ntrode_electrode_group_channel_map": [
                {"map": {0: 999}}  # Channel 999 doesn't exist
            ]
        }

        with pytest.raises(ValueError, match="channel 999 not found"):
            validate_yaml_header_electrode_map(metadata, spike_config)

    def test_reference_electrode_validation(self):
        """Verify reference electrode exists in hardware config"""
        # Test ref electrode validation logic
        pass
```

#### 3. Device Metadata Testing

**File:** `src/trodes_to_nwb/tests/unit/test_device_metadata_loading.py`

```python
from pathlib import Path
import pytest
from trodes_to_nwb.convert_yaml import load_probe_metadata

class TestDeviceMetadata:
    def test_all_device_types_loadable(self):
        """Verify all device types in metadata directory are valid"""
        device_dir = Path(__file__).parent.parent.parent / "device_metadata" / "probe_metadata"

        for yaml_file in device_dir.glob("*.yml"):
            # Should load without errors
            metadata = load_probe_metadata([yaml_file])
            assert metadata is not None
            assert "probe_type" in metadata[0]

    def test_device_type_matches_filename(self):
        """Ensure device_type in YAML matches filename"""
        # e.g., tetrode_12.5.yml should have probe_type: "tetrode_12.5"
        pass

    def test_electrode_coordinates_valid(self):
        """Verify all electrodes have valid x,y,z coordinates"""
        pass
```

---

## Integration Testing Strategy

### Cross-Repository Contract Tests

#### 1. Schema Synchronization Testing

**File (JS):** `src/__tests__/integration/schema-sync.test.js`

```javascript
import fs from 'fs';
import path from 'path';

describe('Schema Synchronization', () => {
  it('nwb_schema.json matches Python package schema', () => {
    const jsSchema = require('../../../nwb_schema.json');

    // Read Python package schema
    const pythonSchemaPath = path.resolve(
      __dirname,
      '../../../../trodes_to_nwb/src/trodes_to_nwb/nwb_schema.json'
    );

    if (!fs.existsSync(pythonSchemaPath)) {
      console.warn('Python package not found, skipping sync test');
      return;
    }

    const pythonSchema = JSON.parse(fs.readFileSync(pythonSchemaPath, 'utf8'));

    // Deep equality check
    expect(jsSchema).toEqual(pythonSchema);
  });

  it('schema version matches between repos', () => {
    const jsSchema = require('../../../nwb_schema.json');
    const pythonSchemaPath = path.resolve(
      __dirname,
      '../../../../trodes_to_nwb/src/trodes_to_nwb/nwb_schema.json'
    );

    if (fs.existsSync(pythonSchemaPath)) {
      const pythonSchema = JSON.parse(fs.readFileSync(pythonSchemaPath, 'utf8'));
      expect(jsSchema.$id || jsSchema.version).toBe(
        pythonSchema.$id || pythonSchema.version
      );
    }
  });
});
```

**File (Python):** `src/trodes_to_nwb/tests/integration/test_schema_compliance.py`

```python
import json
from pathlib import Path
import pytest

class TestSchemaCompliance:
    def test_schema_matches_web_app(self):
        """Verify schema is identical to web app version"""
        our_schema_path = Path(__file__).parent.parent.parent / "nwb_schema.json"
        web_app_schema_path = Path(__file__).parent.parent.parent.parent.parent.parent / \
                              "rec_to_nwb_yaml_creator" / "src" / "nwb_schema.json"

        if not web_app_schema_path.exists():
            pytest.skip("Web app repository not found")

        our_schema = json.loads(our_schema_path.read_text())
        web_schema = json.loads(web_app_schema_path.read_text())

        assert our_schema == web_schema, \
            "Schema mismatch! Update both repos or run schema sync workflow"
```

#### 2. Device Type Synchronization Testing

**File (JS):** `src/__tests__/integration/device-types.test.js`

```javascript
import { deviceTypeMap } from '../../../ntrode/deviceTypes';
import fs from 'fs';
import path from 'path';

describe('Device Type Synchronization', () => {
  it('all device types have corresponding YAML files in Python package', () => {
    const jsDeviceTypes = Object.keys(deviceTypeMap);

    const pythonDeviceDir = path.resolve(
      __dirname,
      '../../../../trodes_to_nwb/src/trodes_to_nwb/device_metadata/probe_metadata'
    );

    if (!fs.existsSync(pythonDeviceDir)) {
      console.warn('Python device metadata not found, skipping test');
      return;
    }

    const pythonDeviceFiles = fs.readdirSync(pythonDeviceDir)
      .filter(f => f.endsWith('.yml'))
      .map(f => f.replace('.yml', ''));

    jsDeviceTypes.forEach(deviceType => {
      expect(pythonDeviceFiles).toContain(deviceType);
    });
  });
});
```

**File (Python):** `src/trodes_to_nwb/tests/integration/test_web_app_integration.py`

```python
import json
from pathlib import Path
import pytest
import yaml

class TestWebAppIntegration:
    def test_all_device_yamls_available_in_web_app(self):
        """Verify web app knows about all device types we support"""
        device_dir = Path(__file__).parent.parent.parent / "device_metadata" / "probe_metadata"
        our_devices = [f.stem for f in device_dir.glob("*.yml")]

        # Try to import web app device types
        web_app_path = Path(__file__).parent.parent.parent.parent.parent.parent / \
                       "rec_to_nwb_yaml_creator" / "src" / "ntrode" / "deviceTypes.js"

        if not web_app_path.exists():
            pytest.skip("Web app not found")

        web_app_code = web_app_path.read_text()

        for device in our_devices:
            assert device in web_app_code, \
                f"Device {device} not found in web app deviceTypes.js"

    def test_web_app_generated_yaml_is_valid(self, tmp_path):
        """Test that YAML generated by web app passes our validation"""
        # Load sample YAML from web app test fixtures
        web_app_sample = Path(__file__).parent.parent.parent.parent.parent.parent / \
                        "rec_to_nwb_yaml_creator" / "src" / "test-fixtures" / \
                        "sample-yamls" / "complete_metadata.yml"

        if not web_app_sample.exists():
            pytest.skip("Web app test fixtures not found")

        from trodes_to_nwb.convert_yaml import load_metadata

        # Should load without errors
        metadata, _ = load_metadata(web_app_sample, [])
        assert metadata is not None
```

#### 3. YAML Round-Trip Testing

**File:** `src/__tests__/integration/yaml-generation.test.js`

```javascript
import { generateYMLFile } from '../../../App';
import yaml from 'yaml';
import Ajv from 'ajv';
import schema from '../../../nwb_schema.json';

describe('YAML Generation & Round-Trip', () => {
  it('generated YAML is valid against schema', () => {
    const formData = {
      // Complete valid form data
      experimenter: ['Doe, John'],
      session_id: '12345',
      // ... all required fields
    };

    const yamlString = generateYMLFile(formData);
    const parsed = yaml.parse(yamlString);

    const ajv = new Ajv();
    const validate = ajv.compile(schema);
    const valid = validate(parsed);

    expect(valid).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('exported then imported YAML preserves data', () => {
    const originalData = {
      // Complete form data
    };

    // Export
    const yamlString = generateYMLFile(originalData);

    // Import (simulate importFile function)
    const imported = yaml.parse(yamlString);

    // Should match original (excluding auto-generated fields)
    expect(imported.experimenter).toEqual(originalData.experimenter);
    // ... test all fields
  });
});
```

---

## End-to-End Testing Strategy

### Full Pipeline Tests

#### JavaScript E2E: Form Workflow

**File:** `src/__tests__/e2e/full-form-flow.test.js`

```javascript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../../App';

describe('Complete Form Workflow', () => {
  it('user can create complete metadata from scratch', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Fill in basic session info
    await user.type(screen.getByLabelText(/experimenter/i), 'Smith, Jane');
    await user.type(screen.getByLabelText(/session.*id/i), 'exp_001');
    await user.type(screen.getByLabelText(/date/i), '2025-01-23');

    // Add electrode group
    await user.click(screen.getByText(/add electrode group/i));

    // Select device type
    const deviceSelect = screen.getByLabelText(/device.*type/i);
    await user.selectOptions(deviceSelect, 'tetrode_12.5');

    // Verify ntrode maps auto-generated
    await waitFor(() => {
      expect(screen.getByText(/channel map/i)).toBeInTheDocument();
    });

    // Validate form
    const validateButton = screen.getByText(/validate/i);
    await user.click(validateButton);

    // Should show success
    await waitFor(() => {
      expect(screen.getByText(/valid/i)).toBeInTheDocument();
    });

    // Download YAML
    const downloadButton = screen.getByText(/download/i);
    await user.click(downloadButton);

    // Verify download triggered (mock file system)
  });

  it('user receives validation errors before losing work', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Fill in partial invalid data
    await user.type(screen.getByLabelText(/experimenter/i), 'Invalid');
    // Leave required fields empty

    // Try to submit
    await user.click(screen.getByText(/download/i));

    // Should show validation errors immediately
    await waitFor(() => {
      expect(screen.getByText(/required/i)).toBeInTheDocument();
    });
  });
});
```

#### Python E2E: Full Conversion Pipeline

**File:** `src/trodes_to_nwb/tests/e2e/test_full_conversion_pipeline.py`

```python
import pytest
from pathlib import Path
import tempfile
from pynwb import NWBHDF5IO
from nwbinspector import inspect_nwb

from trodes_to_nwb.convert import create_nwbs

class TestFullConversionPipeline:
    def test_web_app_yaml_to_nwb_conversion(self, tmp_path):
        """
        CRITICAL E2E TEST: Verify complete pipeline

        1. Start with YAML from web app (test fixture)
        2. Convert to NWB
        3. Validate NWB passes inspection
        4. Verify all metadata preserved
        """
        # Use sample YAML that would come from web app
        test_data_dir = Path(__file__).parent.parent / "fixtures" / "valid_yamls"
        yaml_path = test_data_dir / "web_app_generated.yml"
        rec_dir = Path(__file__).parent.parent / "fixtures" / "sample_rec_files"

        # Run conversion
        nwb_files = create_nwbs(
            data_dir=str(rec_dir),
            animal="test_animal",
            metadata_yml_path=str(yaml_path),
            output_dir=str(tmp_path),
            parallel_instances=1
        )

        assert len(nwb_files) > 0, "No NWB files created"

        # Validate NWB file
        nwb_path = tmp_path / nwb_files[0]
        assert nwb_path.exists()

        # Run NWB Inspector (DANDI validation)
        results = list(inspect_nwb(nwb_path))

        # Should have no critical errors
        critical_errors = [r for r in results if r.severity == "CRITICAL"]
        assert len(critical_errors) == 0, \
            f"NWB file failed DANDI validation: {critical_errors}"

        # Verify metadata preserved
        with NWBHDF5IO(str(nwb_path), 'r') as io:
            nwb = io.read()

            # Check experimenter
            assert nwb.experimenter == ["Smith, Jane"]

            # Check date_of_birth NOT corrupted
            assert nwb.subject.date_of_birth.year == 2023
            assert nwb.subject.date_of_birth != "current_time"

            # Check electrode groups created
            assert len(nwb.electrode_groups) > 0

            # Check devices loaded
            assert len(nwb.devices) > 0

    def test_invalid_yaml_provides_clear_error(self, tmp_path):
        """Verify clear error messages for invalid YAML"""
        invalid_yaml = tmp_path / "invalid.yml"
        invalid_yaml.write_text("""
        experimenter: Missing Required Fields
        # Missing session_id, dates, etc.
        """)

        with pytest.raises(ValueError) as exc_info:
            create_nwbs(
                data_dir="/fake/path",
                animal="test",
                metadata_yml_path=str(invalid_yaml),
                output_dir=str(tmp_path)
            )

        # Error should be user-friendly
        error_msg = str(exc_info.value)
        assert "session_id" in error_msg or "required" in error_msg
```

---

## Schema & Validation Testing

### Validation Behavior Testing

**File (JS):** `src/__tests__/unit/validation/validation-behavior.test.js`

```javascript
import { jsonschemaValidation, rulesValidation } from '../../../App';

describe('Validation Behavior', () => {
  describe('Progressive Validation', () => {
    it('should validate section without blocking other sections', () => {
      const partialData = {
        experimenter: ['Valid, Name'],
        // Other sections incomplete
      };

      // Section-specific validation should be possible
      const result = jsonschemaValidation(partialData, {
        validateSection: 'experimenter'
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('Cross-Field Validation', () => {
    it('should validate tasks reference existing cameras', () => {
      const data = {
        tasks: [{
          task_name: 'Test',
          camera_id: [1, 2]
        }],
        cameras: [{ id: 0 }]  // Missing cameras 1, 2
      };

      const result = rulesValidation(data);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('camera');
    });

    it('should validate associated_video_files reference existing epochs', () => {
      const data = {
        associated_video_files: [{
          task_epochs: [5, 6]  // Non-existent epochs
        }],
        tasks: [{
          task_epochs: [1, 2]
        }]
      };

      const result = rulesValidation(data);
      expect(result.valid).toBe(false);
    });
  });
});
```

### Validation Consistency Testing

**File (Python):** `src/trodes_to_nwb/tests/integration/test_validation_consistency.py`

```python
import json
import pytest
from pathlib import Path
from trodes_to_nwb.metadata_validation import validate as python_validate

class TestValidationConsistency:
    """Verify Python validation matches JavaScript validation"""

    @pytest.fixture
    def sample_yamls(self):
        """Load all sample YAMLs from web app test fixtures"""
        web_app_fixtures = Path(__file__).parent.parent.parent.parent.parent.parent / \
                          "rec_to_nwb_yaml_creator" / "src" / "test-fixtures"

        if not web_app_fixtures.exists():
            pytest.skip("Web app fixtures not found")

        return list(web_app_fixtures.glob("**/*.yml"))

    def test_valid_yamls_pass_both_validators(self, sample_yamls):
        """YAMLs that pass JS validation should pass Python validation"""
        for yaml_path in sample_yamls:
            if "invalid" in yaml_path.name:
                continue

            # Should validate successfully
            result = python_validate(yaml_path)
            assert result is not None

    def test_invalid_yamls_fail_both_validators(self, sample_yamls):
        """YAMLs that fail JS validation should fail Python validation"""
        for yaml_path in sample_yamls:
            if "invalid" not in yaml_path.name:
                continue

            with pytest.raises(Exception):
                python_validate(yaml_path)
```

### Database Ingestion Testing (Spyglass)

**File (Python):** `src/trodes_to_nwb/tests/integration/test_spyglass_ingestion.py`

**Purpose:** Verify NWB files successfully ingest into Spyglass database without errors

**Critical Context:** NWB files from this pipeline are consumed by the [Spyglass](https://github.com/LorenFrankLab/spyglass) database system, which uses DataJoint. The database has strict requirements for data consistency.

```python
import pytest
from pathlib import Path
from pynwb import NWBHDF5IO
import warnings

class TestSpyglassCompatibility:
    """
    Verify NWB files meet Spyglass database requirements

    Critical Database Tables:
    - Session: session_id, session_description, session_start_time
    - ElectrodeGroup: location → BrainRegion, device.probe_type → Probe
    - Electrode: ndx_franklab_novela columns required
    - Probe: probe_type must be pre-registered
    - DataAcquisitionDevice: validated against existing DB entries
    """

    def test_electrode_group_has_valid_location(self, sample_nwb):
        """
        CRITICAL: NULL locations create 'Unknown' brain regions

        Issue: Spyglass auto-creates BrainRegion entries from electrode_group.location
        If location is None/NULL, creates 'Unknown' region breaking spatial queries
        """
        with NWBHDF5IO(sample_nwb, 'r') as io:
            nwb = io.read()

            for group_name, group in nwb.electrode_groups.items():
                assert group.location is not None, \
                    f"Electrode group '{group_name}' has NULL location"
                assert len(group.location.strip()) > 0, \
                    f"Electrode group '{group_name}' has empty location"

                # Validate consistent capitalization
                assert group.location == group.location.strip(), \
                    f"Location has leading/trailing whitespace: '{group.location}'"

    def test_probe_type_is_defined(self, sample_nwb):
        """
        CRITICAL: Undefined probe_type causes ElectrodeGroup.probe_id = NULL

        Issue: Spyglass requires probe_type to match existing Probe.probe_id
        If probe not pre-registered, foreign key becomes NULL → DATA LOSS
        """
        with NWBHDF5IO(sample_nwb, 'r') as io:
            nwb = io.read()

            for device_name, device in nwb.devices.items():
                if hasattr(device, 'probe_type'):
                    assert device.probe_type is not None, \
                        f"Device '{device_name}' has NULL probe_type"

                    # Verify probe_type matches known Spyglass probes
                    # (In production, this would query Spyglass Probe table)
                    known_probes = [
                        'tetrode_12.5',
                        '128c-4s6mm6cm-15um-26um-sl',
                        'A1x32-6mm-50-177-H32_21mm',
                        # ... all registered probes
                    ]

                    assert device.probe_type in known_probes, \
                        f"probe_type '{device.probe_type}' not registered in Spyglass"

    def test_ndx_franklab_novela_columns_present(self, sample_nwb):
        """
        CRITICAL: Missing ndx_franklab_novela columns cause incomplete ingestion

        Required columns: bad_channel, probe_shank, probe_electrode, ref_elect_id
        Missing columns trigger warnings and incomplete Electrode table
        """
        with NWBHDF5IO(sample_nwb, 'r') as io:
            nwb = io.read()

            if nwb.electrodes is None or len(nwb.electrodes) == 0:
                pytest.skip("No electrodes defined")

            required_columns = [
                'bad_channel',
                'probe_shank',
                'probe_electrode',
                'ref_elect_id'
            ]

            electrodes_df = nwb.electrodes.to_dataframe()

            for col in required_columns:
                assert col in electrodes_df.columns, \
                    f"Missing required ndx_franklab_novela column: {col}"

    def test_bad_channel_is_boolean(self, sample_nwb):
        """
        Verify bad_channel column contains boolean values

        Issue: Spyglass stores as "True"/"False" string, but NWB expects boolean
        Type mismatch can cause ingestion failures
        """
        with NWBHDF5IO(sample_nwb, 'r') as io:
            nwb = io.read()

            if nwb.electrodes is None:
                pytest.skip("No electrodes defined")

            electrodes_df = nwb.electrodes.to_dataframe()

            if 'bad_channel' in electrodes_df.columns:
                assert electrodes_df['bad_channel'].dtype == bool, \
                    f"bad_channel should be boolean, got {electrodes_df['bad_channel'].dtype}"

    def test_electrode_group_name_matches_nwb_keys(self, sample_nwb):
        """
        Verify electrode group names in electrodes table match actual group keys

        Issue: Spyglass uses electrode_group_name as foreign key
        Mismatches cause foreign key constraint violations
        """
        with NWBHDF5IO(sample_nwb, 'r') as io:
            nwb = io.read()

            if nwb.electrodes is None:
                pytest.skip("No electrodes defined")

            # Get all electrode group keys
            valid_group_names = set(nwb.electrode_groups.keys())

            electrodes_df = nwb.electrodes.to_dataframe()

            if 'group_name' in electrodes_df.columns:
                actual_group_names = set(electrodes_df['group_name'].unique())

                invalid_names = actual_group_names - valid_group_names
                assert len(invalid_names) == 0, \
                    f"Electrode table references non-existent groups: {invalid_names}"

    def test_brain_region_naming_consistency(self, sample_nwb):
        """
        Verify brain region names follow consistent capitalization

        Issue: 'CA1', 'ca1', 'Ca1' create duplicate BrainRegion entries
        Leads to database fragmentation and broken queries
        """
        with NWBHDF5IO(sample_nwb, 'r') as io:
            nwb = io.read()

            locations = [group.location for group in nwb.electrode_groups.values()]

            # Check for case variations
            location_lower = [loc.lower() for loc in locations]
            unique_lower = set(location_lower)

            if len(location_lower) != len(unique_lower):
                # Find duplicates
                duplicates = {}
                for loc in locations:
                    loc_lower = loc.lower()
                    if loc_lower not in duplicates:
                        duplicates[loc_lower] = []
                    duplicates[loc_lower].append(loc)

                inconsistent = {k: v for k, v in duplicates.items() if len(v) > 1}

                assert len(inconsistent) == 0, \
                    f"Inconsistent brain region capitalization: {inconsistent}"

    def test_session_metadata_complete(self, sample_nwb):
        """
        Verify Session table required fields are populated

        Required: session_id, session_description, session_start_time
        """
        with NWBHDF5IO(sample_nwb, 'r') as io:
            nwb = io.read()

            assert nwb.session_id is not None, "session_id is required"
            assert len(nwb.session_id.strip()) > 0, "session_id cannot be empty"

            assert nwb.session_description is not None, "session_description required"
            assert nwb.session_start_time is not None, "session_start_time required"

            # Verify experimenters list
            assert nwb.experimenter is not None, "experimenter required"
            assert len(nwb.experimenter) > 0, "At least one experimenter required"

@pytest.fixture
def sample_nwb(tmp_path):
    """Generate or load sample NWB file for testing"""
    # Implementation: either generate a test NWB or use fixture
    nwb_path = tmp_path / "test_sample.nwb"
    # ... create sample NWB with all required fields
    return nwb_path
```

**Usage in CI/CD:**

```yaml
# Add to .github/workflows/test.yml
- name: Test Spyglass compatibility
  run: |
    pytest src/trodes_to_nwb/tests/integration/test_spyglass_ingestion.py \
      --verbose \
      --tb=short
```

**Key Validation Points:**

1. **Probe Type Registry** - All probe types must exist in Spyglass Probe table before ingestion
2. **Brain Region Consistency** - Use controlled vocabulary to prevent fragmentation
3. **ndx_franklab_novela Required** - All extension columns must be present
4. **No NULL Locations** - Every electrode group needs a valid brain region
5. **Boolean Type Safety** - `bad_channel` must be boolean, not string

---

## CI/CD Pipeline

### GitHub Actions Workflow

**File:** `.github/workflows/test.yml` (both repositories)

```yaml
name: Comprehensive Test Suite

on:
  push:
    branches: [main, modern]
  pull_request:
    branches: [main]

jobs:
  # Job 1: Schema Synchronization Check
  schema-sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          path: current-repo

      - name: Checkout other repository
        uses: actions/checkout@v4
        with:
          repository: LorenFrankLab/trodes_to_nwb  # or rec_to_nwb_yaml_creator
          path: other-repo

      - name: Compare schemas
        run: |
          diff -u \
            current-repo/src/nwb_schema.json \
            other-repo/src/trodes_to_nwb/nwb_schema.json \
          || (echo "SCHEMA MISMATCH! Update both repositories." && exit 1)

  # Job 2: JavaScript Tests (rec_to_nwb_yaml_creator)
  javascript-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run unit tests
        run: npm test -- --coverage --watchAll=false

      - name: Run integration tests
        run: npm test -- --testPathPattern=integration --watchAll=false

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: javascript

  # Job 3: Python Tests (trodes_to_nwb)
  python-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ['3.10', '3.11', '3.12']

    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: ${{ matrix.python-version }}
          cache: 'pip'

      - name: Install dependencies
        run: |
          pip install -e ".[test,dev]"

      - name: Run linter
        run: |
          ruff check .
          black --check .

      - name: Run type checking
        run: mypy src/trodes_to_nwb

      - name: Run unit tests
        run: |
          pytest src/trodes_to_nwb/tests/unit \
            --cov=src/trodes_to_nwb \
            --cov-report=xml \
            --cov-report=term-missing \
            -v

      - name: Run integration tests
        run: |
          pytest src/trodes_to_nwb/tests/integration \
            --cov=src/trodes_to_nwb \
            --cov-append \
            --cov-report=xml \
            -v

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage.xml
          flags: python-${{ matrix.python-version }}

  # Job 4: End-to-End Tests
  e2e-tests:
    runs-on: ubuntu-latest
    needs: [javascript-tests, python-tests]
    steps:
      - uses: actions/checkout@v4
        with:
          path: rec_to_nwb_yaml_creator

      - uses: actions/checkout@v4
        with:
          repository: LorenFrankLab/trodes_to_nwb
          path: trodes_to_nwb

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install both packages
        run: |
          cd rec_to_nwb_yaml_creator && npm ci && cd ..
          cd trodes_to_nwb && pip install -e ".[test]" && cd ..

      - name: Run E2E tests
        run: |
          cd rec_to_nwb_yaml_creator
          npm test -- --testPathPattern=e2e --watchAll=false
          cd ../trodes_to_nwb
          pytest src/trodes_to_nwb/tests/e2e -v
```

### Pre-commit Hooks

**File:** `.pre-commit-config.yaml` (both repositories)

```yaml
repos:
  - repo: local
    hooks:
      # Run fast unit tests before commit
      - id: unit-tests
        name: Run unit tests
        entry: npm test -- --testPathPattern=unit --watchAll=false --passWithNoTests
        language: system
        pass_filenames: false
        stages: [commit]

      # Validate schema hasn't changed without updating other repo
      - id: schema-check
        name: Check schema synchronization
        entry: bash -c 'if git diff --cached --name-only | grep -q nwb_schema.json; then echo "⚠️  nwb_schema.json changed! Update both repositories."; exit 1; fi'
        language: system
        pass_filenames: false
        stages: [commit]
```

---

## Test Data Management

### Fixture Strategy

#### Shared Test Fixtures

Create a shared test fixtures repository or directory:

```
test-fixtures/
├── valid-yamls/
│   ├── minimal_valid.yml              # Bare minimum required fields
│   ├── complete_metadata.yml          # All fields populated
│   ├── single_electrode_group.yml
│   ├── multiple_electrode_groups.yml
│   ├── with_optogenetics.yml
│   └── with_associated_files.yml
├── invalid-yamls/
│   ├── missing_required_fields.yml
│   ├── wrong_date_format.yml
│   ├── invalid_camera_reference.yml
│   ├── duplicate_ids.yml
│   └── type_mismatches.yml
├── edge-cases/
│   ├── maximum_complexity.yml         # Stress test: many groups, cameras, tasks
│   ├── unicode_characters.yml
│   ├── special_characters_in_names.yml
│   └── boundary_values.yml
└── sample-rec-files/
    ├── minimal.rec                    # Minimal valid .rec file
    ├── with_position.rec
    └── multi_session/
```

### Fixture Generation

**File:** `scripts/generate_test_fixtures.py`

```python
"""Generate comprehensive test fixtures programmatically"""
import yaml
from pathlib import Path
from datetime import datetime, timedelta

def generate_minimal_valid():
    """Bare minimum YAML that passes validation"""
    return {
        "experimenter": ["Doe, John"],
        "experiment_description": "Test experiment",
        "session_description": "Test session",
        "session_id": "test_001",
        "institution": "UCSF",
        "lab": "Frank Lab",
        "session_start_time": datetime.now().isoformat(),
        "timestamps_reference_time": datetime.now().isoformat(),
        "subject": {
            "description": "Test subject",
            "sex": "M",
            "species": "Rattus norvegicus",
            "subject_id": "rat_001",
            "date_of_birth": (datetime.now() - timedelta(days=90)).isoformat(),
            "weight": "300 g"
        },
        "data_acq_device": [{
            "name": "SpikeGadgets",
            "system": "SpikeGadgets",
            "amplifier": "Intan",
            "adc_circuit": "Intan"
        }],
        "cameras": [],
        "tasks": [],
        "associated_video_files": [],
        "associated_files": [],
        "electrode_groups": [],
        "ntrode_electrode_group_channel_map": []
    }

def generate_invalid_fixtures():
    """Generate systematic invalid fixtures for each error type"""
    base = generate_minimal_valid()

    # Missing required field
    missing_experimenter = base.copy()
    del missing_experimenter["experimenter"]

    # Wrong type
    wrong_type = base.copy()
    wrong_type["cameras"] = [{"id": "not_an_int"}]

    # Invalid date format
    wrong_date = base.copy()
    wrong_date["session_start_time"] = "01/23/2025"

    return {
        "missing_required_fields.yml": missing_experimenter,
        "wrong_type.yml": wrong_type,
        "wrong_date_format.yml": wrong_date
    }

if __name__ == "__main__":
    fixtures_dir = Path("test-fixtures")

    # Generate valid fixtures
    (fixtures_dir / "valid-yamls" / "minimal_valid.yml").write_text(
        yaml.dump(generate_minimal_valid())
    )

    # Generate invalid fixtures
    for filename, data in generate_invalid_fixtures().items():
        (fixtures_dir / "invalid-yamls" / filename).write_text(
            yaml.dump(data)
        )
```

---

## Testing Workflows for Claude Code

### Workflow 1: Making a Code Change

When Claude Code modifies code, follow this verification workflow:

```bash
# 1. Run relevant unit tests first
npm test -- --testPathPattern="path/to/changed/component"

# 2. Run integration tests if multiple components changed
npm test -- --testPathPattern=integration

# 3. Run linter
npm run lint

# 4. If validation logic changed, run validation tests
npm test -- --testPathPattern=validation

# 5. For Python changes
pytest src/trodes_to_nwb/tests/unit/test_<changed_module>.py -v

# 6. Run full test suite before committing
npm test -- --watchAll=false --coverage
pytest --cov=src/trodes_to_nwb --cov-report=term-missing
```

### Workflow 2: Fixing a Bug from REVIEW.md

Example: Fixing the date_of_birth bug

```bash
# 1. Write failing test FIRST (TDD)
cat > src/trodes_to_nwb/tests/unit/test_date_of_birth_bug.py << 'EOF'
import datetime
from freezegun import freeze_time
from trodes_to_nwb.metadata_validation import validate

@freeze_time("2025-01-23 15:30:00")
def test_date_of_birth_not_corrupted():
    """Verify date_of_birth preserves original date"""
    metadata = {
        "subject": {
            "date_of_birth": datetime.datetime(2023, 6, 15)
        }
    }

    result = validate(metadata)

    # Should be 2023-06-15, NOT 2025-01-23
    assert "2023-06-15" in result["subject"]["date_of_birth"]
    assert "2025-01-23" not in result["subject"]["date_of_birth"]
EOF

# 2. Verify test FAILS (confirms bug exists)
pytest src/trodes_to_nwb/tests/unit/test_date_of_birth_bug.py -v
# Should see: FAILED - date is corrupted

# 3. Fix the bug in metadata_validation.py
# (Claude makes the fix)

# 4. Verify test PASSES
pytest src/trodes_to_nwb/tests/unit/test_date_of_birth_bug.py -v
# Should see: PASSED

# 5. Run all validation tests to ensure no regressions
pytest src/trodes_to_nwb/tests/unit/test_metadata_validation.py -v

# 6. Run integration tests
pytest src/trodes_to_nwb/tests/integration/ -v
```

### Workflow 3: Adding a New Feature

Example: Adding progressive validation to web app

```bash
# 1. Write tests for new feature
cat > src/__tests__/unit/validation/progressive-validation.test.js << 'EOF'
describe('Progressive Validation', () => {
  it('validates single section without full form', () => {
    const sectionData = { experimenter: ['Valid, Name'] };
    const result = validateSection('experimenter', sectionData);
    expect(result.valid).toBe(true);
  });
});
EOF

# 2. Verify tests fail (feature doesn't exist yet)
npm test -- --testPathPattern=progressive-validation
# Should see: FAILED - validateSection is not defined

# 3. Implement feature
# (Claude adds validateSection function)

# 4. Verify tests pass
npm test -- --testPathPattern=progressive-validation
# Should see: PASSED

# 5. Run integration tests
npm test -- --testPathPattern=integration

# 6. Run E2E tests to verify user workflow
npm test -- --testPathPattern=e2e
```

### Workflow 4: Synchronizing Schema Changes

```bash
# When schema changes in either repo:

# 1. Update schema in BOTH repositories
# rec_to_nwb_yaml_creator/src/nwb_schema.json
# trodes_to_nwb/src/trodes_to_nwb/nwb_schema.json

# 2. Run schema sync test
cd rec_to_nwb_yaml_creator
npm test -- --testPathPattern=schema-sync

# 3. Verify Python validation matches
cd ../trodes_to_nwb
pytest src/trodes_to_nwb/tests/integration/test_schema_compliance.py

# 4. Run validation tests in both repos
cd ../rec_to_nwb_yaml_creator
npm test -- --testPathPattern=validation

cd ../trodes_to_nwb
pytest src/trodes_to_nwb/tests/unit/test_metadata_validation.py

# 5. Commit changes to BOTH repos with same commit message
cd ../rec_to_nwb_yaml_creator
git add src/nwb_schema.json
git commit -m "Update schema: [description of change]"

cd ../trodes_to_nwb
git add src/trodes_to_nwb/nwb_schema.json
git commit -m "Update schema: [description of change]"
```

---

## Verification Checklists

### Pre-Commit Checklist

Before committing any change:

- [ ] All relevant unit tests pass
- [ ] No test coverage decreased
- [ ] Linter passes (no warnings)
- [ ] If schema changed, both repos updated
- [ ] If device type added, both repos updated
- [ ] Integration tests pass
- [ ] Manual smoke test performed (if UI change)

### Pre-PR Checklist

Before creating pull request:

- [ ] All tests pass in CI
- [ ] Code coverage >80% for new code
- [ ] E2E tests pass
- [ ] No flaky tests introduced
- [ ] Test fixtures updated if needed
- [ ] CLAUDE.md updated if architecture changed
- [ ] REVIEW.md consulted for related issues

### Pre-Release Checklist

Before deploying to production:

- [ ] Full test suite passes (both repos)
- [ ] E2E tests pass with real .rec files
- [ ] NWB Inspector validation passes
- [ ] Manual testing with neuroscientist user
- [ ] Schema sync verified
- [ ] Device types sync verified
- [ ] Rollback plan prepared

---

## Coverage Goals

### Target Coverage by Component

#### rec_to_nwb_yaml_creator

| Component | Target Coverage | Priority |
|-----------|----------------|----------|
| Validation (jsonschemaValidation, rulesValidation) | 100% | P0 |
| State Management (updateFormData, updateFormArray) | 95% | P0 |
| Electrode/Ntrode Logic | 95% | P0 |
| Data Transforms (utils.js) | 100% | P0 |
| Form Components | 80% | P1 |
| UI Interactions | 70% | P2 |

#### trodes_to_nwb

| Module | Target Coverage | Priority |
|--------|----------------|----------|
| metadata_validation.py | 100% | P0 |
| convert_yaml.py | 90% | P0 |
| convert_rec_header.py | 90% | P0 |
| convert_ephys.py | 85% | P1 |
| convert_position.py | 85% | P1 |
| convert.py | 80% | P1 |

### Monitoring Coverage

```bash
# JavaScript coverage report
npm test -- --coverage --watchAll=false
# View: coverage/lcov-report/index.html

# Python coverage report
pytest --cov=src/trodes_to_nwb --cov-report=html
# View: htmlcov/index.html
```

---

## Summary: Quick Reference

### Running Tests

```bash
# JavaScript - All tests
npm test -- --watchAll=false --coverage

# JavaScript - Specific test file
npm test -- path/to/test.test.js

# Python - All tests
pytest --cov=src/trodes_to_nwb --cov-report=term-missing -v

# Python - Specific test
pytest src/trodes_to_nwb/tests/unit/test_metadata_validation.py -v

# Python - Integration tests only
pytest src/trodes_to_nwb/tests/integration/ -v
```

### Key Testing Principles

1. **Write tests BEFORE fixing bugs** (TDD) - Ensures test actually catches the bug
2. **Test contracts, not implementation** - Tests should survive refactoring
3. **One assertion concept per test** - Makes failures easier to diagnose
4. **Use descriptive test names** - Should read like documentation
5. **Avoid test interdependencies** - Each test runs independently
6. **Mock external dependencies** - File system, network, time
7. **Test error paths** - Don't just test happy path

### When to Run Which Tests

| Scenario | Tests to Run |
|----------|-------------|
| Changed validation logic | Unit tests (validation) → Integration tests → E2E |
| Changed state management | Unit tests (state) → Integration tests (form workflow) |
| Changed schema | Schema sync → All validation tests (both repos) |
| Added device type | Device sync → Integration tests → E2E |
| Fixed bug from REVIEW.md | Write failing test → Fix → Verify test passes → Related integration tests |
| Before commit | Relevant unit tests → Linter |
| Before PR | All unit tests → All integration tests → E2E |
| Before deploy | Full CI pipeline → Manual verification |

---

This testing plan provides the foundation for confident, rapid development by Claude Code while maintaining data integrity for neuroscientists.
