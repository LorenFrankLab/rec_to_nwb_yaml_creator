# Phase 1.5 Summary - For Claude Code Sessions

**Created:** 2025-10-24
**Status:** Ready to Start (Awaiting Human Approval)

---

## Quick Context

You are working on **critical scientific infrastructure** that generates YAML metadata for neuroscience experiments. Data corruption can invalidate months/years of irreplaceable research.

**Current Status:**
- ✅ Phase 0: Baseline infrastructure complete
- ✅ Phase 1: Testing foundation complete (60.55% coverage, 1,078 tests)
- ⚠️ **Phase 1 Review:** Critical quality issues found - requires Phase 1.5
- 🔴 **Phase 1.5:** Ready to start (this phase)
- 🔴 Phase 2: Blocked until Phase 1.5 complete

---

## Why Phase 1.5 Exists

**Phase 1 achieved 60.55% coverage with 1,078 tests, but comprehensive code review revealed:**

1. **111+ trivial tests** that always pass (`expect(true).toBe(true)`)
2. **Sample metadata modification** workflows completely untested (user's concern)
3. **Integration tests** don't actually test (just render and document)
4. **Test code quality** blocks future work (DRY violations, brittle selectors)
5. **Branch coverage** only 30.86% (unsafe for refactoring)

**Decision:** Fix these issues before proceeding to Phase 2 bug fixes.

---

## Phase 1.5 Plan (2-3 weeks, 40-60 hours)

**Detailed Plan:** [`docs/plans/PHASE_1.5_TEST_QUALITY_IMPROVEMENTS.md`](plans/PHASE_1.5_TEST_QUALITY_IMPROVEMENTS.md)

### Week 7: Critical Gap Filling (54 tests, 20-28 hours)

1. **Sample Metadata Modification (8 tests)** - User's specific concern
   - Import sample YAML through file upload
   - Modify experimenter, subject, add cameras/tasks
   - Re-export with modifications preserved

2. **End-to-End Workflows (11 tests)** - Complete user journeys
   - Blank form → fill all fields → export valid YAML
   - Test entire session creation process

3. **Error Recovery (15 tests)** - Critical error paths
   - Validation errors → user corrects → resubmit
   - Malformed YAML → error message → retry
   - Form corruption prevention

4. **Fix Import/Export Integration (20 tests rewritten)**
   - Actually simulate file uploads (not just document)
   - Actually verify form population

### Week 8: Test Quality Improvements (20-29 hours)

1. **Convert Documentation Tests** (25-30 converted, 80 deleted)
   - Replace `expect(true).toBe(true)` with real assertions
   - Delete purely documentation tests
   - Add JSDoc comments to App.js

2. **Fix DRY Violations** (~1,500 LOC removed)
   - Create shared test hooks
   - Refactor 24 unit test files
   - Eliminate code duplication

3. **Migrate CSS Selectors** (100+ selectors)
   - Replace `querySelector()` with semantic queries
   - Enable safe Phase 3 refactoring

4. **Known Bug Fixtures** (6 fixtures)
   - Create fixtures for documented bugs
   - Add tests to verify bugs exist

### Week 9 (OPTIONAL): Refactoring Preparation (35-50 tests, 18-25 hours)

Can be deferred if time-constrained. Only needed for Phase 3 refactoring.

---

## Success Criteria

**Minimum (Weeks 7-8) to proceed to Phase 2:**
- [ ] 54 new/rewritten tests passing
- [ ] Documentation tests converted or deleted
- [ ] DRY violations reduced by 80%
- [ ] CSS selectors replaced with semantic queries
- [ ] Meaningful coverage ≥ 60%
- [ ] Branch coverage ≥ 50%
- [ ] Human approval

**Full (Week 9) to proceed to Phase 3:**
- [ ] Above + 35-50 refactoring preparation tests
- [ ] Refactoring readiness: 8/10

---

## Key Files for Claude Code

**Planning & Tracking:**
- `docs/TASKS.md` - Complete task checklist with all checkboxes
- `docs/SCRATCHPAD.md` - Session notes and current status
- `docs/REFACTOR_CHANGELOG.md` - Change history
- `docs/plans/PHASE_1.5_TEST_QUALITY_IMPROVEMENTS.md` - Detailed plan

**Review Reports:**
- `REFACTORING_SAFETY_ANALYSIS.md` - Phase 3 readiness assessment
- Agent reviews (in memory): Coverage review, quality review

**Critical Source Files:**
- `src/App.js` - Main application (2,767 LOC)
- `src/__tests__/integration/` - Integration tests to fix
- `src/__tests__/unit/app/` - Unit tests with DRY violations

---

## First Task to Start

**Task 1.5.1: Sample Metadata Modification Tests**

**File:** `src/__tests__/integration/sample-metadata-modification.test.jsx` (NEW)

**Goal:** Test import → modify → export workflows (8 tests, 4-6 hours)

**Tests:**
1. Import sample metadata through file upload
2. Modify experimenter name
3. Modify subject information
4. Add new camera
5. Add new task
6. Add new electrode group
7. Re-export with modifications
8. Round-trip preserves modifications

**Approach:**
- Use `renderWithProviders()` from test-utils
- Use `userEvent.upload()` to simulate file uploads
- Verify form population with `screen` queries
- Use sample from `fixtures/realistic-session.yml`

---

## Common Pitfalls to Avoid

1. **Don't write documentation-only tests**
   - ❌ `expect(true).toBe(true)` - Always passes
   - ✅ Test actual behavior with real assertions

2. **Don't mock functions being tested**
   - ❌ Test through mocks instead of real code
   - ✅ Test through UI interactions

3. **Don't use CSS selectors**
   - ❌ `container.querySelector('.class-name')`
   - ✅ `screen.getByRole('button', { name: /add/i })`

4. **Don't duplicate test code**
   - ❌ Copy-paste hook implementations
   - ✅ Use shared test hooks from `test-hooks.js`

---

## Testing Best Practices

**Follow AAA Pattern:**
```javascript
it('imports sample metadata through file upload', async () => {
  // ARRANGE
  const { user } = renderWithProviders(<App />);
  const yamlFile = new File([sampleYaml], 'sample.yml', { type: 'text/yaml' });

  // ACT
  const fileInput = screen.getByLabelText(/import/i);
  await user.upload(fileInput, yamlFile);

  // ASSERT
  expect(screen.getByLabelText('Lab')).toHaveValue('Loren Frank Lab');
  expect(screen.getByLabelText('Session ID')).toHaveValue('12345');
});
```

**Use Semantic Queries:**
```javascript
// Good
screen.getByRole('button', { name: /add camera/i })
screen.getByLabelText(/experimenter/i)
screen.getAllByRole('group', { name: /electrode group/i })

// Bad
container.querySelector('button[title="Add cameras"]')
container.querySelector('#experimenter_name-0')
```

**Test User Behavior, Not Implementation:**
```javascript
// Good - tests what user sees/does
it('adds camera when add button clicked', async () => {
  await user.click(screen.getByRole('button', { name: /add camera/i }));
  expect(screen.getAllByRole('group', { name: /camera/i })).toHaveLength(1);
});

// Bad - tests internal implementation
it('calls addArrayItem when button clicked', () => {
  const mockFn = vi.fn();
  // ...tests the mock
});
```

---

## Workflow for Each Task

1. **Read the plan** - Understand what's needed
2. **Create test file** - Use TDD approach
3. **Write failing tests** - Red phase
4. **Implement if needed** - Green phase (Phase 1.5 is test-only, no App.js changes)
5. **Refactor** - Clean up test code
6. **Verify all pass** - `npm test -- --run`
7. **Update TASKS.md** - Check off completed items
8. **Commit** - `phase1.5(task-name): description`

---

## Commit Message Format

```bash
phase1.5(sample-modification): add 8 tests for import→modify→export workflows

- Test import through file upload
- Test modifications (experimenter, subject, cameras, tasks, electrode groups)
- Test re-export with modifications preserved
- Test round-trip data preservation

All 8 tests passing
```

---

## When to Ask for Help

**STOP and ask user if:**
- Requirements unclear or conflicting
- Test approach uncertain
- Discovered new bugs that need discussion
- Need to change production code (Phase 1.5 is test-only)
- Blocked by technical issues

**Document in SCRATCHPAD.md:**
- Decisions made
- Challenges encountered
- Time spent on each task
- Anything unexpected

---

## References

**Documentation:**
- `CLAUDE.md` - Project overview and critical context
- `docs/TESTING_PLAN.md` - Original testing strategy
- `docs/ENVIRONMENT_SETUP.md` - Node.js and dependencies

**Test Infrastructure:**
- `src/__tests__/helpers/test-utils.jsx` - Shared utilities
- `src/__tests__/helpers/custom-matchers.js` - Custom Jest matchers
- `src/__tests__/fixtures/` - Test data

**Skills to Use:**
- `test-driven-development` - Write test first, watch fail, implement
- `systematic-debugging` - If unexpected failures
- `verification-before-completion` - Always verify tests pass
- `requesting-code-review` - After major milestones

---

## Next Session Checklist

**At start of each session:**
1. Read `docs/SCRATCHPAD.md` - Get current status
2. Read `docs/TASKS.md` - Find next unchecked task
3. Run `/setup` - Verify environment
4. Check `git status` - Review uncommitted changes
5. Review plan for current task
6. Create TodoWrite list for session

**At end of each session:**
1. Update SCRATCHPAD.md with progress
2. Update TASKS.md checkboxes
3. Commit all changes
4. Document any blockers

---

## Emergency Contacts

**If stuck:** Review comprehensive plan in `docs/plans/PHASE_1.5_TEST_QUALITY_IMPROVEMENTS.md`

**If tests failing unexpectedly:**
1. Check Node version: `node --version` (should be v20.19.5)
2. Reinstall dependencies: `npm install`
3. Clear coverage: `rm -rf coverage/`
4. Use `systematic-debugging` skill

**If unclear what to do:**
- Re-read this summary
- Check TASKS.md for next unchecked item
- Review detailed plan
- Ask human for clarification

---

**Good luck! Remember: This is critical scientific infrastructure. Test quality matters more than speed.**
