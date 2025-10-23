# Test Fixtures

This directory contains YAML fixtures for testing the rec_to_nwb_yaml_creator application. All fixtures are modeled after real Frank Lab recording sessions and the trodes_to_nwb sample data.

## Fixture Categories

### Valid Fixtures (`valid/`)

These fixtures should pass all validation checks and represent realistic use cases.

#### `minimal-valid.yml`
- **Purpose**: Minimal valid configuration with only required fields
- **Use case**: Testing baseline validation, minimal form submission
- **Contains**: Only required fields (experimenter_name, lab, institution, data_acq_device, times_period_multiplier, raw_data_to_volts)
- **Expected**: Should pass validation

#### `complete-valid.yml`
- **Purpose**: Complete metadata with common optional fields populated
- **Use case**: Testing full form functionality with all common features
- **Contains**: Subject info, 2 cameras, 2 tasks, 2 electrode groups with channel maps, associated files
- **Brain regions**: CA1, CA3 (realistic hippocampal recording)
- **Device type**: tetrode_12.5
- **Expected**: Should pass validation

#### `realistic-session.yml`
- **Purpose**: Realistic chronic recording session modeling actual Frank Lab experiments
- **Use case**: Integration testing, realistic data validation, trodes_to_nwb compatibility
- **Contains**:
  - 2 experimenters
  - Full subject metadata with age
  - 2 cameras (overhead and side view)
  - 3 tasks (sleep-behavior-sleep paradigm)
  - 8 tetrodes (32 channels) targeting CA1, CA3, and PFC
  - Complete channel mappings with bad channels
  - Associated files and videos
  - Behavioral events
- **Brain regions**: CA1, CA3, PFC (multi-region recording)
- **Session structure**: Pre-sleep → W-track → Post-sleep (typical protocol)
- **Expected**: Should pass validation and convert successfully with trodes_to_nwb

### Invalid Fixtures (`invalid/`)

These fixtures should fail validation for specific reasons. Use to test error handling.

#### `missing-required-fields.yml`
- **Purpose**: Test validation of required fields
- **Missing**: lab, institution, data_acq_device, times_period_multiplier, raw_data_to_volts
- **Only contains**: experimenter_name
- **Expected error**: Missing required properties

#### `invalid-types.yml`
- **Purpose**: Test type validation (strings instead of numbers, etc.)
- **Type errors**:
  - `times_period_multiplier`: string instead of number
  - `raw_data_to_volts`: string instead of number
  - `cameras[0].id`: float (1.5) instead of integer
  - `cameras[0].meters_per_pixel`: string instead of number
  - `electrode_groups[0].id`: string instead of integer
- **Expected error**: Type validation failures

#### `schema-violations.yml`
- **Purpose**: Test schema constraint violations (pattern matching, array constraints, etc.)
- **Violations**:
  - `experimenter_name`: empty array (violates minItems: 1)
  - `lab`: empty string (violates pattern requiring non-whitespace)
  - `institution`: whitespace only (violates pattern)
  - `data_acq_device[0].name`: empty string
  - `cameras[0].meters_per_pixel`: negative value
  - `electrode_groups[0].location`: empty string
  - `ntrode_electrode_group_channel_map[0].electrode_group_id`: references non-existent electrode group
  - `tasks[0].camera_id`: references non-existent camera
- **Expected error**: Schema constraint violations

### Edge Cases (`edge-cases/`)

These fixtures test boundary conditions and unusual but valid inputs.

#### `unicode-strings.yml`
- **Purpose**: Test handling of international characters, emoji, special symbols
- **Contains**:
  - Names with diacritics (Müller, García, Søren)
  - Japanese characters (研究室, カメラ)
  - Greek letters (αβγ, αλφα)
  - Emoji (🧠)
  - Special symbols (•, ★, ™, ®, №)
  - Accented characters (à, é, ï, ô, ü)
- **Expected**: Should pass validation (UTF-8 support required)

#### `boundary-values.yml`
- **Purpose**: Test extreme values and large arrays
- **Contains**:
  - Very short strings (single character lab)
  - Very long strings (500+ character description)
  - Very small numbers (0.000001, 0.0000000001)
  - Very large numbers (999999.999999)
  - Large arrays (16 electrode groups)
  - All channels marked as bad
  - Many epochs (10 epochs in one task)
  - Minimal valid values (weight: "0.001g")
  - Unix epoch date (1970-01-01)
- **Expected**: Should pass validation (tests numeric range handling)

#### `empty-optional-arrays.yml`
- **Purpose**: Test that optional fields can be omitted or empty
- **Contains**:
  - Only required fields
  - All optional arrays explicitly set to empty: `[]`
  - Optional objects omitted entirely
- **Expected**: Should pass validation

## Usage in Tests

```javascript
import fs from 'fs';
import yaml from 'yaml';

// Load a fixture
const fixtureYaml = fs.readFileSync(
  'src/__tests__/fixtures/valid/minimal-valid.yml',
  'utf8'
);
const fixtureData = yaml.parse(fixtureYaml);

// Test validation
expect(fixtureData).toBeValidYaml();
```

## Fixture Design Principles

1. **Based on Real Data**: All valid fixtures model actual Frank Lab recording sessions
2. **Realistic Brain Regions**: Use actual anatomical locations (CA1, CA3, PFC)
3. **Realistic Device Types**: Use actual probe types from trodes_to_nwb (tetrode_12.5)
4. **Realistic Workflows**: Model actual experimental protocols (sleep-behavior-sleep)
5. **Integration Ready**: Valid fixtures should work with trodes_to_nwb without modification
6. **Specific Failures**: Invalid fixtures test one category of error clearly
7. **Edge Cases Isolated**: Each edge case fixture focuses on one boundary condition

## Updating Fixtures

When updating fixtures:

1. **Test with trodes_to_nwb**: Valid fixtures must convert successfully
2. **Verify Spyglass compatibility**: Check brain region naming, device types
3. **Update this README**: Document any new fixtures or changes
4. **Run verification tests**: Ensure custom matchers work correctly

## Schema Version

These fixtures are designed for schema version: `v1.0.1`
Schema location: `src/nwb_schema.json`

Last updated: 2025-10-23
