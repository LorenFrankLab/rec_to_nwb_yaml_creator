# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🔧 Environment Setup - Run FIRST

**Before starting ANY work in this codebase, you MUST set up the contained environment.**

### Quick Start

Run the setup command:
```
/setup
```

This command will:
1. Verify Node.js version matches `.nvmrc` (v20.19.5)
2. Switch to correct version using nvm
3. Install exact dependency versions from `package-lock.json`
4. Verify environment is ready

### Why This Matters

**Global Pollution Prevention:** All dependencies install to project-local `node_modules/`, not global npm cache.

**Reproducibility:** Same Node version + same package versions = identical environment across all machines and sessions.

**Critical for Scientific Infrastructure:** Environment inconsistencies can introduce subtle bugs in YAML generation that corrupt scientific data.

### Manual Setup (if /setup fails)

```bash
# 1. Check .nvmrc exists
cat .nvmrc

# 2. Switch Node version
nvm use

# 3. Install dependencies
npm install

# 4. Verify
node --version  # Should match .nvmrc
npm test -- --version  # Should run without errors
```

### When Environment is Ready

You'll see:
```
✓ Environment ready: Node v20.19.5, dependencies installed
✓ Ready to proceed with development tasks
```

Only after seeing this message should you proceed with code changes.

---

## ⚠️ CRITICAL: This is Scientific Infrastructure

**READ THIS FIRST - MANDATORY FOR ALL CHANGES**

This application is **critical scientific infrastructure** used by neuroscientists to create metadata for experiments that may represent **months or years of research**. The data flows through a pipeline that produces NWB files for public archives (DANDI) and research databases (Spyglass).

### Zero-Tolerance Policy for Regressions

**ANY bug, error, or regression can:**

- Corrupt irreplaceable scientific data
- Invalidate months of experiments
- Block publication of research findings
- Cause silent data loss in public archives
- Fragment database queries across labs

**Therefore, you MUST:**

1. **Always read existing code before modifying** - Use the Read tool to understand context
2. **Write tests BEFORE fixing bugs** (Test-Driven Development) - Verify the test fails, then fix
3. **Never skip verification** - Always run tests and validate output after changes
4. **Use the `verification-before-completion` skill** - Run verification commands before claiming success
5. **Preserve existing behavior** - Only change what's explicitly requested
6. **Document breaking changes** - Update CHANGELOG.md if behavior changes
7. **Use the `systematic-debugging` skill** - Understand root cause before proposing fixes
8. **Request code review** - Use `requesting-code-review` skill for major changes
9. **Test integration points** - Verify YAML output works with trodes_to_nwb
10. **Consider Spyglass impact** - Check database compatibility for metadata changes

### When Making Any Change

```bash
# 0. FIRST: Verify environment is set up
/setup  # Run this command to verify Node version and dependencies

# 1. Read existing code first
Read the file you're about to modify

# 2. Write test that reproduces the bug/verifies the feature
# (See TESTING_PLAN.md for test structure)

# 3. Verify test fails (for bugs) or passes (for features)
npm test -- <test-file>

# 4. Make the minimal change required

# 5. Verify test now passes
npm test -- <test-file>

# 6. Run full test suite
npm test -- --watchAll=false

# 7. Test integration if YAML generation affected
# Generate sample YAML, test with trodes_to_nwb Python package
# Repository: https://github.com/LorenFrankLab/trodes_to_nwb
# Location: /Users/edeno/Documents/GitHub/trodes_to_nwb

# 8. Document the change
# Update CHANGELOG.md, add comments
```

### Critical Repository Locations

**This Repository (Web App):**

- **GitHub:** <https://github.com/LorenFrankLab/rec_to_nwb_yaml_creator>
- **Local:** `/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator`
- **Purpose:** Generate YAML metadata files for NWB conversion

**Python Backend (Consumes YAML files):**

- **GitHub:** <https://github.com/LorenFrankLab/trodes_to_nwb>
- **Local:** `/Users/edeno/Documents/GitHub/trodes_to_nwb`
- **Purpose:** Convert .rec files + YAML → NWB files
- **⚠️ CRITICAL:** Changes to this web app MUST be tested with trodes_to_nwb

**Database System (Final Destination):**

- **GitHub:** <https://github.com/LorenFrankLab/spyglass>
- **Local:** `/Users/edeno/Documents/GitHub/spyglass`
- **Purpose:** Ingest and analyze NWB files in DataJoint database

### Skills You MUST Use

- **Before starting any task:** `using-superpowers` - Find relevant skills
- **When implementing features/fixes:** `test-driven-development` - Write test first
- **When encountering bugs:** `systematic-debugging` - Investigate before fixing
- **Before claiming completion:** `verification-before-completion` - Prove it works
- **For complex features:** `brainstorming` - Design before implementing
- **After implementation:** `requesting-code-review` - Get review before merging

### Example of CORRECT Workflow

```
User: "Fix the date_of_birth bug in metadata validation"

Claude:
1. [Reads REVIEW.md to understand the bug]
2. [Reads trodes_to_nwb/metadata_validation.py to see current code]
3. [Writes test that reproduces the bug]
4. [Runs test, confirms it fails]
5. [Makes minimal fix to metadata_validation.py]
6. [Runs test, confirms it passes]
7. [Runs full test suite]
8. [Generates sample YAML and tests with trodes_to_nwb]
9. [Updates CHANGELOG.md]
10. "Bug fixed. Test added at line X, fix at line Y. Verified with full test suite and integration test."
```

### Example of INCORRECT Workflow (NEVER DO THIS)

```
User: "Fix the date_of_birth bug"

Claude:
1. [Immediately edits file based on assumption]
2. "I've fixed the bug by changing line 64"
   ❌ No test written
   ❌ No verification run
   ❌ No understanding of root cause
   ❌ Could break other functionality
   ❌ No regression protection
```

---

## Project Overview

This is a React-based web application that generates YAML configuration files for the [Rec to NWB](https://github.com/LorenFrankLab/rec_to_nwb) and [trodes to NWB](https://github.com/LorenFrankLab/trodes_to_nwb) neuroscience data conversion tools. The application provides a guided form interface for creating NWB (Neurodata Without Borders) metadata files for electrophysiology experiments.

**Live application:** <https://lorenfranklab.github.io/rec_to_nwb_yaml_creator/>

**Data Impact:** Each YAML file represents a recording session that may be part of:

- Multi-month chronic recording experiments (30-200+ days)
- Multi-year longitudinal studies
- Irreplaceable data (animals, time, resources)
- Published research findings
- Public scientific archives (DANDI)

## Integration with trodes_to_nwb

This application is the **entry point** for the neuroscience data conversion pipeline. The YAML files it generates are consumed by [trodes_to_nwb](https://github.com/LorenFrankLab/trodes_to_nwb), a Python package that converts SpikeGadgets .rec files into NWB 2.0+ format.

### YAML File Consumption Workflow

```
rec_to_nwb_yaml_creator (this app)
    ↓ Generates
{YYYYMMDD}_{animal}.metadata.yml
    ↓ Placed with
.rec files in data directory
    ↓ Consumed by
trodes_to_nwb.convert.create_nwbs()
    ↓ Produces
{animal}{YYYYMMDD}.nwb (DANDI-ready)
    ↓ Ingested by
Spyglass database (DataJoint)
```

**Final Destination:** The NWB files produced by this pipeline are ultimately ingested into the **[Spyglass](https://github.com/LorenFrankLab/spyglass)** database system for analysis and data management. This means data quality and naming consistency are **critical** - errors propagate to the database and affect all downstream analyses.

### Critical Integration Points

1. **Schema Synchronization**: Both repositories share `nwb_schema.json` - changes to the schema must be coordinated across both projects. The schema defines required fields, data types, and validation rules.

2. **Device Type Resolution**: When users select `device_type` in electrode groups, the string identifier (e.g., `"tetrode_12.5"`) must match a file in `trodes_to_nwb/src/trodes_to_nwb/device_metadata/probe_metadata/`. The Python package loads these YAML files to get electrode geometry and channel configurations.

3. **Hardware Channel Mapping**: The `ntrode_electrode_group_channel_map` section created by this app is validated against the actual .rec file hardware configuration during conversion. Mismatches will cause conversion failures.

4. **File Naming Convention**: Generated YAML files follow strict naming: `{EXPERIMENT_DATE_in_format_mmddYYYY}_{subject_id}_metadata.yml`. The Python package's file scanner expects this format to group files by recording session.

5. **Optogenetics Dependencies**: If any optogenetics fields are present (virus_injection, optical_fiber, opto_excitation_source), the Python package requires ALL optogenetics sections to be present. Partial optogenetics metadata will fail validation.

### Schema Validation Differences

This application validates using **AJV (Draft 7)**, while trodes_to_nwb validates using **jsonschema (Draft 2020-12)**. Both validate against the same schema, but validation may differ slightly. If a YAML file passes validation here but fails in trodes_to_nwb, check:

- Date formats (especially `date_of_birth`)
- Array uniqueness constraints
- Required field presence
- Pattern matching on strings

### Spyglass Database Requirements

The NWB files ultimately feed into [Spyglass](https://github.com/LorenFrankLab/spyglass), a DataJoint-based database system. Understanding these downstream requirements is essential for data quality:

**Critical Database Constraints:**

1. **Probe Types Must Be Pre-Registered** - The `device_type` field (e.g., `"tetrode_12.5"`) must match existing entries in the Spyglass `Probe` table. Undefined probe types cause `ElectrodeGroup.probe_id` to become NULL, resulting in **data loss**.

2. **Brain Region Naming Consistency** - The `electrode_group.location` field auto-creates `BrainRegion` entries in Spyglass. Inconsistent capitalization (e.g., "CA1", "ca1", "Ca1") creates duplicate database entries and fragments queries. **Always use consistent capitalization.**

3. **ndx_franklab_novela Extension Required** - Spyglass expects all NWB files to include the ndx_franklab_novela extension columns: `bad_channel`, `probe_shank`, `probe_electrode`, `ref_elect_id`. Missing columns cause incomplete database population.

4. **No NULL Locations** - Every electrode group **must** have a valid `location` string. NULL or empty locations create "Unknown" brain region entries that break spatial queries.

5. **Session Metadata Completeness** - Fields like `session_id`, `session_description`, `session_start_time`, and `experimenter` are required for Spyglass Session table population.

**Validation Best Practices:**

- Validate `device_type` against known Spyglass probe types before allowing selection
- Provide dropdown/autocomplete for brain regions to enforce consistency
- Warn users if required ndx_franklab_novela fields are missing
- Prevent empty or whitespace-only location strings
- Test NWB files can be ingested into Spyglass without errors

See [REVIEW.md](REVIEW.md) for detailed failure scenarios and [TESTING_PLAN.md](TESTING_PLAN.md) for Spyglass compatibility tests.

### Testing Integration

When making changes to this app that affect YAML output:

1. Generate a test YAML file
2. Create a minimal test dataset with matching .rec files
3. Run trodes_to_nwb conversion: `create_nwbs(path="test_data", output_dir="test_output")`
4. Verify NWB file generation succeeds and validates with NWB Inspector
5. **(Recommended)** Test NWB file ingestion into Spyglass database

## Common Commands

### Development

```bash
npm run start          # Start development server (opens browser automatically)
npm run build          # Build production bundle
npm test               # Run tests in watch mode
npm run lint           # Run ESLint with auto-fix
```

### Deployment

```bash
npm run deploy         # Deploy to GitHub Pages (builds and pushes to gh-pages branch)
```

**Important:** The `gh-pages` branch should never be deleted - it serves the live application.

## Architecture

### State Management

The application uses React hooks (`useState`, `useEffect`) for state management with a single centralized form state object (`formData`) in [App.js](src/App.js). State updates flow through wrapper functions:

- `updateFormData()` - Updates single fields (simple key-value or nested object/array items)
- `updateFormArray()` - Updates array fields with checkbox-style multi-selection
- `onBlur()` - Processes input transformations (comma-separated strings, number parsing) on blur events
- `itemSelected()` - Handles dropdown/datalist selections

### Form Data Structure

The form state mirrors the NWB YAML schema structure defined in [nwb_schema.json](src/nwb_schema.json). Default values are centralized in [valueList.js](src/valueList.js):

- `defaultYMLValues` - Initial form state with sensible defaults
- `emptyFormData` - Empty state used for form reset
- `arrayDefaultValues` - Templates for adding new array items

### Dynamic Array Management

Complex array sections (electrode_groups, cameras, tasks, etc.) support dynamic add/remove/duplicate operations:

- `addArrayItem(key, count)` - Adds new items with auto-incrementing IDs
- `removeArrayItem(index, key)` - Removes items with confirmation
- `duplicateArrayItem(index, key)` - Clones items with new IDs
- Special handling for `electrode_groups` via `removeElectrodeGroupItem()` and `duplicateElectrodeGroupItem()` which also manage associated `ntrode_electrode_group_channel_map` entries

### Electrode Group & Ntrode Channel Mapping

The most complex architectural component is the relationship between electrode groups and ntrode channel maps:

1. When a user selects a `device_type` for an electrode group, `nTrodeMapSelected()` auto-generates appropriate ntrode channel map entries
2. Device types are defined in [src/ntrode/deviceTypes.js](src/ntrode/deviceTypes.js), which maps probe types to channel configurations
3. Each ntrode has a `map` object defining channel index mappings (e.g., `{0: 0, 1: 1, 2: 2, 3: 3}`)
4. `ChannelMap.jsx` component renders the UI for editing these mappings
5. When electrode groups are duplicated/removed, associated ntrode maps are automatically managed

### Validation System

Two-layer validation system:

1. **JSON Schema Validation** (`jsonschemaValidation()`) - Uses AJV library to validate against [nwb_schema.json](src/nwb_schema.json)
2. **Custom Rules Validation** (`rulesValidation()`) - Enforces constraints not easily expressed in JSON schema (e.g., tasks must have cameras if camera_ids are specified)

Validation errors are displayed via:

- HTML5 custom validity API for input elements
- `showCustomValidityError()` utility for temporary error messages
- Alert dialogs for complex or element-not-found errors

### File Import/Export

- **Import:** Users can upload existing YAML files via `importFile()`. Invalid fields are excluded with error notifications, valid fields populate the form
- **Export:** `generateYMLFile()` validates form data, converts to YAML using the `yaml` library, and triggers browser download with filename pattern: `{EXPERIMENT_DATE_in_format_mmddYYYY}_{subject_id}_metadata.yml`

### Component Organization

- **Form Elements** ([src/element/](src/element/)) - Reusable form components:
  - `InputElement.jsx` - Basic text/number inputs
  - `SelectElement.jsx` - Dropdowns
  - `DataListElement.jsx` - Auto-complete inputs
  - `CheckboxList.jsx` - Multi-select checkboxes
  - `RadioList.jsx` - Single-select radio buttons
  - `ListElement.jsx` - Dynamic string lists
  - `SelectInputPairElement.jsx` - Combined select+input controls
  - `ArrayItemControl.jsx` - Duplicate/remove buttons for array items

- **Specialized Components:**
  - `ArrayUpdateMenu.jsx` - Add items interface for array sections
  - `ntrode/ChannelMap.jsx` - Channel mapping editor for electrode groups

### Dynamic References & Dependencies

The app tracks dynamic dependencies between form sections via `useEffect`:

- `cameraIdsDefined` - Available camera IDs (used in tasks, associated_video_files, fs_gui_yamls)
- `taskEpochsDefined` - Task epochs from all tasks (used in associated_files, associated_video_files, fs_gui_yamls)
- `dioEventsDefined` - Behavioral event names (used in fs_gui_yamls)

When items are deleted, dependent fields are automatically cleared.

### Optogenetics Support

The application includes comprehensive optogenetics configuration:

- `opto_excitation_source` - Light sources with wavelength, power specifications
- `optical_fiber` - Fiber implant details with stereotaxic coordinates
- `virus_injection` - Viral vector injection details with coordinates
- `fs_gui_yamls` - FsGUI protocol files with epoch assignments and power settings

### Navigation & UX

- Left sidebar navigation auto-generated from form sections
- Click handlers add temporary highlighting to scrolled-to sections
- All `<details>` elements are opened before form submission for validation visibility
- Production detection via `isProduction()` adjusts navigation links for GitHub Pages deployment

## Key Patterns

- **Immutable Updates:** All state updates use `structuredClone()` to avoid mutation
- **ID Management:** Array items with `id` fields auto-increment to avoid collisions
- **Sanitization:** `sanitizeTitle()` cleans strings for use as HTML IDs/keys
- **Type Coercion:** Form values are properly typed on blur (strings, numbers, arrays)
- **Comma-Separated Inputs:** Utilities `commaSeparatedStringToNumber()` and `formatCommaSeparatedString()` handle list inputs

## Device Types and Metadata

### Adding New Device Types

When adding a new probe/device type to support:

1. **Add to valueList.js**: Add the device type string to `deviceTypes()` function in [valueList.js](src/valueList.js)

2. **Add to deviceTypes.js**: Add channel mapping logic in [src/ntrode/deviceTypes.js](src/ntrode/deviceTypes.js):
   - `deviceTypeMap()` - Define the channel array (e.g., `[0,1,2,3]` for tetrode)
   - `getShankCount()` - Define number of shanks for the device

3. **Create device metadata in trodes_to_nwb**: Create a corresponding YAML file in `trodes_to_nwb/src/trodes_to_nwb/device_metadata/probe_metadata/` with:
   - `probe_type` (must match the string from step 1)
   - Electrode geometry (`rel_x`, `rel_y`, `rel_z` coordinates)
   - Contact specifications

4. **Test the integration**: Verify the device type appears in the dropdown, generates correct channel maps, and successfully converts in trodes_to_nwb

### Current Supported Device Types

- `tetrode_12.5` - 4-channel tetrode with 12.5 μm spacing
- `A1x32-6mm-50-177-H32_21mm` - 32-channel single shank
- `128c-4s8mm6cm-20um-40um-sl` - 128-channel, 4 shanks
- `128c-4s6mm6cm-15um-26um-sl` - 128-channel, 4 shanks (alternate spacing)
- `32c-2s8mm6cm-20um-40um-dl` - 32-channel, 2 shanks
- `64c-4s6mm6cm-20um-40um-dl` - 64-channel, 4 shanks
- `64c-3s6mm6cm-20um-40um-sl` - 64-channel, 3 shanks
- `NET-EBL-128ch-single-shank` - 128-channel single shank

## Testing Notes

The codebase has minimal test coverage ([App.test.js](src/App.test.js)). When adding features:

- Test form state updates with complex nested structures
- Validate electrode group & ntrode map synchronization
- Test import of YAML files with various validation scenarios
- Verify dynamic dependencies (cameras, epochs, dio events) update correctly
- **Integration Testing**: Generate YAML and test with trodes_to_nwb to ensure end-to-end compatibility
