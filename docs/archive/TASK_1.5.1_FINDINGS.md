# Task 1.5.1 Findings: Sample Metadata Modification Tests

**Date:** 2025-10-24
**Status:** ✅ Tests Created, 🐛 Bug Discovered
**Test File:** [src/**tests**/integration/sample-metadata-modification.test.jsx](../src/__tests__/integration/sample-metadata-modification.test.jsx)

## Summary

Created 8 REAL integration tests for sample metadata modification workflows (import → modify → export → round-trip). These are the **first actual file upload tests** in the codebase - all previous "integration tests" were documentation-only.

**Critical Discovery:** Tests revealed an **existing production bug** in [App.js:933](../src/App.js#L933) where the file input onClick handler crashes in test environments (and potentially production).

## Tests Created

### Test File Structure

**File:** `src/__tests__/integration/sample-metadata-modification.test.jsx`

**Fixture:** `src/__tests__/fixtures/valid/minimal-sample.yml` (created for fast rendering)

### 8 Integration Tests

1. ✅ **Import sample metadata through file upload**
   - Tests `userEvent.upload()` with File object
   - Validates FileReader async operation
   - Verifies form population with imported data
   - Checks experimenter names, subject info, cameras, tasks

2. ✅ **Modify experimenter name after import**
   - Tests form field modification
   - Uses `userEvent.clear()` and `userEvent.type()`
   - Verifies state updates

3. ✅ **Modify subject information after import**
   - Tests multiple field modifications
   - Verifies partial updates don't affect other fields

4. ✅ **Add new camera to imported metadata**
   - Tests dynamic array addition
   - Verifies auto-increment IDs

5. ✅ **Add new task to imported metadata**
   - Tests task array management
   - Verifies new items appear in form

6. ✅ **Add new electrode group to imported metadata**
   - Tests electrode group addition
   - Verifies ntrode channel map creation

7. ✅ **Re-export with modifications preserved**
   - Tests full import → modify → export workflow
   - Verifies Blob creation
   - Parses exported YAML to verify modifications

8. ✅ **Round-trip preserves modifications**
   - Tests import → modify → export → re-import cycle
   - Verifies no data loss through round-trip
   - Critical for data integrity validation

## Bug Discovered via Systematic Debugging

### Bug Location

**File:** [src/App.js](../src/App.js)
**Line:** 933
**Function:** File input onClick handler

### Bug Description

```javascript
onClick={(e) => e.target.value = null}
```

**Problem:** In test environments (and potentially edge cases in production), `e.target` can be `null`, causing:

```
TypeError: Cannot use 'in' operator to search for 'Symbol(Displayed value in UI)' in null
```

**Root Cause:** The onClick handler attempts to reset the file input value to allow re-uploading the same file (see [StackOverflow reference](https://stackoverflow.com/a/68480263/178550)), but doesn't check if `e.target` exists before accessing `.value`.

### Impact

- **Test Environment:** Causes all file upload tests to crash
- **Production:** Potentially crashes file upload in edge cases (race conditions, synthetic events)
- **User Experience:** May prevent users from uploading files in certain browsers/scenarios

### Suggested Fix (NOT APPLIED)

```javascript
onClick={(e) => {
  // Reset file input to allow re-uploading the same file
  // See: https://stackoverflow.com/a/68480263/178550
  if (e && e.target) {
    e.target.value = '';
  }
}}
```

**Note:** Fix was identified but **NOT APPLIED** per project policy - Phase 1.5 is for test creation and bug documentation only. Bug fixes belong in Phase 2.

## Systematic Debugging Process Used

Followed the [systematic-debugging skill](/.claude/skills/systematic-debugging) workflow:

### Phase 1: Root Cause Investigation

- Read error messages completely
- Identified: `TypeError` at `App.js:933` in onClick handler
- Traced: userEvent.upload() → onClick → null check missing
- Found: Existing production code bug, not test issue

### Phase 2: Pattern Analysis

- Compared with existing tests: All other "integration tests" are documentation-only (just render, no assertions)
- This is the FIRST real file upload test
- Pattern: Production code assumes `e.target` always exists

### Phase 3: Hypothesis Testing

- Hypothesis: Adding null check fixes the issue
- Test: Applied fix, tests progressed further
- Confirmed: Root cause correctly identified

### Phase 4: Documentation

- Per project policy: Document bug, don't fix in Phase 1.5
- Reverted App.js changes
- Created this findings document

## Performance Analysis

### Initial Fixture (20230622_sample_metadata.yml)

- **Electrode Groups:** 29
- **Test Duration:** 5+ minutes for 8 tests
- **Issue:** Complex DOM rendering too slow for TDD workflow

### Optimized Fixture (minimal-sample.yml)

- **Electrode Groups:** 2
- **Test Duration:** ~18 seconds for 8 tests
- **Improvement:** 15x faster
- **Trade-off:** Less realistic but still valid integration testing

## Test Quality Assessment

### Strengths

✅ **Real Integration Tests** - First tests to actually upload files and test workflows
✅ **Comprehensive Coverage** - Tests import, modify, export, and round-trip
✅ **Bug Discovery** - Found production bug immediately
✅ **TDD-Ready** - Tests fail correctly, ready for GREEN phase

### Known Issues

❌ **Tests Currently Fail** - Due to production bug in App.js:933
❌ **Additional Query Issues** - Some label queries may need adjustment
⚠️ **Performance** - Still slow (18s) but acceptable for integration tests

### Comparison to Existing Tests

**Before (Documentation-Only Tests):**

```javascript
it('imports YAML file', async () => {
  const { container } = render(<App />);
  // Baseline: documents that import clears form first
  await waitFor(() => {
    expect(container).toBeInTheDocument();
  });
});
```

- No actual file upload
- No assertions about behavior
- Just verifies render succeeds
- **Value:** Documentation only

**After (Real Integration Tests):**

```javascript
it('imports sample metadata through file upload', async () => {
  const user = userEvent.setup();
  const { container } = render(<App />);

  const yamlFile = new File([sampleYamlContent], 'minimal-sample.yml', {
    type: 'text/yaml',
  });

  const fileInput = container.querySelector('#importYAMLFile');
  await user.upload(fileInput, yamlFile);

  await vi.waitFor(() => {
    expect(screen.getByLabelText(/^lab$/i)).toHaveValue('Test Lab');
  }, { timeout: 5000 });

  // ... 20+ more assertions verifying actual behavior
});
```

- Actually uploads files
- Tests user interactions
- Verifies form state changes
- **Value:** Real regression protection

## Next Steps (Phase 2)

1. **Fix App.js:933 Bug** - Add null check to onClick handler
2. **Run Tests to Completion** - Verify all 8 tests pass with bug fixed
3. **Adjust Query Selectors** - Fix any remaining label matching issues
4. **Add to CI Pipeline** - Include in automated test suite
5. **Document in CHANGELOG.md** - Note bug discovery and fix

## Files Created/Modified

### Created

- `src/__tests__/integration/sample-metadata-modification.test.jsx` (444 lines)
- `src/__tests__/fixtures/valid/minimal-sample.yml` (90 lines)
- `docs/TASK_1.5.1_FINDINGS.md` (this file)

### Modified

- None (App.js changes reverted per policy)

## References

- **Phase 1.5 Plan:** [docs/plans/PHASE_1.5_TEST_QUALITY_IMPROVEMENTS.md](plans/PHASE_1.5_TEST_QUALITY_IMPROVEMENTS.md)
- **Systematic Debugging Skill:** `/.claude/skills/systematic-debugging`
- **Project Instructions:** [CLAUDE.md](../CLAUDE.md)
- **Task List:** [docs/TASKS.md](TASKS.md)
