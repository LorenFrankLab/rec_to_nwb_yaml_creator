# Refactoring Changelog

**Purpose:** Track all changes made during the refactoring milestones.

**Last Updated:** October 27, 2025

---

## M1 - Extract Pure Utilities (October 27, 2025)

### Summary

Completed YAML utilities extraction and test coverage. Discovered that extraction had already been done in earlier refactoring (Phase 3), with all YAML functions moved to `src/io/yaml.js`. Added missing test coverage for `decodeYaml()` and removed deprecated legacy file.

### Changes

#### Test Coverage

- **Created `src/__tests__/unit/io/yaml-decodeYaml.test.js`** - 23 comprehensive tests
  - Normal operation: simple objects, nested structures, arrays, null values, booleans, numeric types
  - Edge cases: empty strings, whitespace, empty objects, special characters, multiline strings
  - Error handling: malformed YAML, multiple documents, non-string inputs (null, undefined, number, object)
  - Round-trip compatibility: encode -> decode verification
  - Scientific metadata use cases: NWB structures, ISO 8601 datetime preservation, empty arrays

#### Cleanup

- **Removed `src/utils/yamlExport.js`** - Deprecated file no longer used
  - All functionality migrated to `io/yaml.js` in Phase 3
  - Legacy aliases maintained for backwards compatibility

#### Documentation Updates

- **Updated `src/__tests__/unit/app/App-convertObjectToYAMLString.test.jsx`**
  - Changed file location reference from `src/utils/yamlExport.js` to `src/io/yaml.js`
  - Added refactoring history: Phase 1 → Phase 3 → M1
  - Clarified legacy alias `convertObjectToYAMLString` = `encodeYaml`

- **Updated `docs/TASKS.md`**
  - Marked M1 first task as complete
  - Added detail breakdown of YAML utilities and test coverage

- **Updated `docs/SCRATCHPAD.md`**
  - Changed session status to M1
  - Added completed work summary
  - Documented next steps for M1

### Test Results

- **Total Tests:** 2149 passing (up from 2126, +23 new tests)
- **Test Files:** 109 passing
- **New Tests:** 23 (all for `decodeYaml()`)
- **Coverage:** All YAML I/O functions now have comprehensive test coverage

### Existing YAML Test Coverage

- `encodeYaml()` - 8 tests in `App-convertObjectToYAMLString.test.jsx`
- `formatDeterministicFilename()` - 12 tests in `yaml-formatDeterministicFilename.test.js`
- `downloadYamlFile()` - 7 tests in `yaml-memory-leak.test.js`
- `decodeYaml()` - 23 tests in `yaml-decodeYaml.test.js` (NEW)

### Files Changed

```
docs/REFACTOR_CHANGELOG.md                                      - M1 section added
docs/SCRATCHPAD.md                                              - M1 status updated
docs/TASKS.md                                                   - M1 first task marked complete
src/__tests__/unit/app/App-convertObjectToYAMLString.test.jsx  - Documentation updated
src/__tests__/unit/io/yaml-decodeYaml.test.js                  - 285 lines (new test file)
src/utils/yamlExport.js                                         - Deleted (deprecated)
```

### Breaking Changes

**None.** All changes are additive or cleanup:

- Test coverage additions are non-breaking
- Removed file was not imported anywhere
- All existing tests continue to pass

### Next Steps (M1 Continuation)

1. Create `src/utils/schemaValidator.js` using AJV (strict mode)
2. Add shadow export test for YAML parity verification
3. Integrate shadow export with Vitest baseline suite
4. Document regression protocol in CLAUDE.md

---

## M0.5 - Type System Strategy (October 27, 2025)

### Summary

Established JSDoc-first type system strategy with 70% coverage goal, deferring full TypeScript migration to Phase 2 (M13+). This provides incremental type safety without build system disruption.

### Changes

#### Documentation

- **Created `docs/types_migration.md`** - Comprehensive type system migration guide
  - Phase 1: JSDoc annotations with 70% coverage goal
  - Phase 2: Optional TypeScript migration after M7
  - Rationale for JSDoc-first approach (zero build config, incremental adoption)
  - Examples of JSDoc patterns (@param, @returns, @typedef)
  - Priority modules for type coverage
  - Decision log and Q&A section

#### Configuration

- **Created `jsconfig.json`** - JavaScript project configuration
  - Enabled path aliases: `@/*` � `src/*`
  - Set target to ES2020
  - Module resolution configured for node
  - `checkJs: false` initially (enable in Phase 2)

- **Updated `.eslintrc.js`** - Added JSDoc validation rules
  - Installed `eslint-plugin-jsdoc` v51.6.1
  - Added "jsdoc" plugin
  - Configured 8 JSDoc rules (warnings for new code):
    - `jsdoc/require-jsdoc` - Require JSDoc on exported functions
    - `jsdoc/require-param` - Require @param for function parameters
    - `jsdoc/require-param-type` - Require types in @param
    - `jsdoc/require-returns` - Require @returns for return values
    - `jsdoc/require-returns-type` - Require types in @returns
    - `jsdoc/check-types` - Validate type syntax
    - `jsdoc/check-param-names` - Verify parameter names match (error level)
    - `jsdoc/valid-types` - Ensure valid JSDoc type syntax (error level)

#### Testing

- **Created `src/__tests__/unit/docs/types_migration.test.js`** - 7 tests
  - Verifies types_migration.md exists and contains required sections
  - Validates Phase 1 and Phase 2 documentation
  - Checks for coverage goal, ESLint references, rationale, and examples

- **Created `src/__tests__/unit/eslint/jsdoc-config.test.js`** - 4 tests
  - Verifies eslint-plugin-jsdoc in devDependencies
  - Checks .eslintrc.js configuration
  - Validates jsconfig.json exists and has path aliases

#### Dependencies

- **Added to devDependencies:**
  - `eslint-plugin-jsdoc@^51.6.1` (includes 20 sub-packages)

#### Test Results

- **Total Tests:** 2126 passing (up from 2115)
- **New Tests:** 11 (7 documentation + 4 configuration)
- **Snapshots:** 1 updated (schema hash changed due to version field from M0)
- **Coverage:** All tests green 

### Decision Points

1. **Type Strategy:** Selected Option A (JSDoc) over Option B (immediate TypeScript)
   - **Rationale:** Zero build config, incremental adoption, reversibility, scientific infrastructure safety
   - **Coverage Goal:** 70% of exported functions
   - **Priority:** validation (100%), YAML export (100%), schema (100%), state (80%), UI components (50%)

2. **ESLint Rules:** Set to "warn" level for gradual adoption
   - **Rationale:** Allow existing code to remain unchanged while encouraging types in new code
   - **Phase 2:** Promote to "error" level after M7

3. **jsconfig.json:** Disabled `checkJs` initially
   - **Rationale:** Avoid overwhelming warnings from existing code
   - **Phase 2:** Enable after core modules have JSDoc coverage

### Files Changed

```
.eslintrc.js                                       - 13 lines added (JSDoc plugin + rules)
jsconfig.json                                      - 14 lines (new file)
package.json                                       - 1 dependency added
package-lock.json                                  - 20 packages added
docs/types_migration.md                            - 415 lines (new file)
docs/TASKS.md                                      - 6 tasks marked complete, DoD updated
docs/SCRATCHPAD.md                                 - M0.5 status added
src/__tests__/unit/docs/types_migration.test.js   - 48 lines (new test file)
src/__tests__/unit/eslint/jsdoc-config.test.js    - 34 lines (new test file)
src/__tests__/integration/schema-contracts.test.js - 1 snapshot updated
```

### Breaking Changes

**None.** All changes are additive and non-breaking:

- ESLint rules are warnings, not errors
- jsconfig.json is informational (no build impact)
- Existing code continues to work unchanged

### Next Steps (M1)

1. Extract `toYaml()` into `src/utils/yamlExport.js` with JSDoc
2. Create `src/utils/schemaValidator.js` with JSDoc
3. Add shadow export test for YAML parity
4. Begin applying JSDoc to validation utilities

### Notes

- **Schema Hash Mismatch:** Expected due to `version: "1.0.1"` field added in M0. Will sync with trodes_to_nwb in future release.
- **ESLint Warnings:** May see warnings when running `npm run lint` on new/modified code. This is intentional to encourage JSDoc adoption.
- **IDE Support:** VS Code and WebStorm will now provide type hints and autocomplete for JSDoc-annotated code.

---

## M0 - Repository Audit & Safety Setup (October 27, 2025)

### Summary

Completed repository audit, added feature flags, and implemented schema version validation. No behavior changes.

### Changes

#### Feature Flags

- Created `src/featureFlags.js` with 22 flags
- Added comprehensive test suite (41 tests passing)
- All new feature flags disabled by default
- Shadow export flags enabled (`shadowExportStrict`, `shadowExportLog`)

#### Schema Version Validation

- Added `version: "1.0.1"` to `src/nwb_schema.json`
- Created `scripts/check-schema-version.mjs` (260 lines)
- Integrated into CI via `.github/workflows/test.yml`
- Added npm script: `npm run check:schema`
- Configured AJV with `strict: false` to allow version metadata

#### Documentation

- Created `docs/TEST_INFRASTRUCTURE_AUDIT.md`
- Created `docs/CONTEXT_STORE_VERIFICATION.md`

### Test Results

- **Before M0:** 2074 tests passing
- **After M0:** 2115 tests passing (+41 from feature flags)

---
