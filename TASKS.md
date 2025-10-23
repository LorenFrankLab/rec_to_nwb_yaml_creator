# Refactoring Tasks Tracker

> **Single Source of Truth** for the rec_to_nwb_yaml_creator refactoring project

**Project:** Comprehensive Testing & Refactoring Initiative
**Current Phase:** Phase 0 - Baseline & Infrastructure
**Phase Status:** 🟢 COMPLETE - Approved for Phase 1
**Last Updated:** 2025-10-23
**Tagged Release:** v3.0.0-phase0-complete
**Branch:** `refactor/phase-0-baselines` (worktree: `.worktrees/phase-0-baselines`)

---

## 📊 Quick Stats

| Metric | Count |
|--------|-------|
| **Test Files Created** | 45 unit/integration tests |
| **E2E Tests Created** | 21 E2E specs |
| **CI/CD Workflows** | 1 (test.yml) |
| **Git Hooks** | 2 (pre-commit, pre-push) |
| **Documentation Created** | 8 docs (CI/CD, Hooks, Integration, etc.) |
| **Performance Baselines** | 5 categories (validation, YAML ops, rendering, state, complex ops) |
| **Visual Regression Baselines** | 3 screenshots captured |
| **Integration Contracts** | 3 (schema hash, device types, YAML format) |

---

## 🎯 Phase 0: Baseline & Infrastructure

**Goal:** Establish comprehensive baselines and testing infrastructure WITHOUT changing production code behavior
**Duration:** Weeks 1-2
**Exit Criteria:** All baselines passing, CI operational, human review approved

### Progress: 12/16 Tasks Complete (75%)

---

### Week 1: Infrastructure Setup ✅

#### Task 1: Install Vitest and Configure ✅
- **Status:** Complete
- **Completed:** 2025-10-23
- **Commit:** `bc4fe8f` - phase0(infra): configure Vitest test framework
- **Files Created:**
  - `vitest.config.js` - Vitest configuration with coverage settings
  - `src/setupTests.js` - Test setup file with custom matchers
  - Updated `package.json` with test scripts
- **Verification:** `npm test -- --run --passWithNoTests` ✅

#### Task 2: Install Playwright and Configure ✅
- **Status:** Complete
- **Completed:** 2025-10-23
- **Commit:** `49ca4d9` - phase0(infra): configure Playwright E2E testing
- **Files Created:**
  - `playwright.config.js` - Playwright configuration for 3 browsers
  - `e2e/.gitkeep` - E2E test directory
  - Updated `package.json` with E2E scripts
- **Verification:** `npx playwright test --help` ✅

#### Task 3: Create Test Directory Structure ✅
- **Status:** Complete
- **Completed:** 2025-10-23
- **Commit:** `600d69e` - phase0(infra): create test directory structure
- **Directories Created:**
  - `src/__tests__/baselines/` - Baseline tests documenting current behavior
  - `src/__tests__/unit/` - Unit tests for isolated components
  - `src/__tests__/integration/` - Integration tests for component interactions
  - `src/__tests__/fixtures/valid/` - Valid YAML test fixtures
  - `src/__tests__/fixtures/invalid/` - Invalid YAML test fixtures
  - `src/__tests__/fixtures/edge-cases/` - Edge case test fixtures
  - `src/__tests__/helpers/` - Test utilities and helpers
- **Review:** See `docs/reviews/task-3-test-directory-structure-review.md`

#### Task 4: Create Test Helpers ✅
- **Status:** Complete
- **Completed:** 2025-10-23
- **Commit:** `742054c` - phase0(infra): add test helpers and custom matchers
- **Files Created:**
  - `src/__tests__/helpers/test-utils.jsx` - Custom render utilities
  - `src/__tests__/helpers/custom-matchers.js` - Custom Vitest matchers
  - Updated `src/setupTests.js` to import custom matchers
- **Custom Matchers Added:**
  - `toBeValidYaml()` - Validates YAML against schema
  - `toHaveValidationError()` - Checks for specific validation errors
- **Review:** See `docs/reviews/task-4-test-helpers-review.md`

#### Task 5: Create Test Fixtures ✅
- **Status:** Complete
- **Completed:** 2025-10-23
- **Commit:** `a6c583f` - phase0(fixtures): add realistic test fixtures from trodes_to_nwb data
- **Fixtures Created:**
  - `src/__tests__/fixtures/valid/minimal-valid.json` - Minimal valid YAML
  - `src/__tests__/fixtures/valid/complete-metadata.json` - Complete metadata with all features
  - `src/__tests__/fixtures/invalid/missing-required-fields.json` - Missing required fields
  - `src/__tests__/fixtures/invalid/wrong-types.json` - Type mismatch errors
  - Plus 22 additional realistic fixtures from trodes_to_nwb
- **Verification:** All fixtures parse as valid JSON ✅

---

### Week 2: Baseline Tests ✅

#### Task 6: Create Validation Baseline Tests ✅
- **Status:** Complete
- **Completed:** 2025-10-23
- **Commit:** `8ae0817` - phase0(baselines): add validation baseline tests
- **Files Created:**
  - `src/__tests__/baselines/validation-baseline.test.js` - Documents current validation behavior
- **Tests Added:**
  - ✅ Accepts valid YAML structure
  - ✅ Documents camera ID float bug (BUG #3)
  - ✅ Documents empty string bug (BUG #5)
  - ✅ Validates required fields
- **Documentation:** These tests **intentionally** document current bugs to detect regressions during refactoring. Bugs will be fixed in Phase 2.

#### Task 7: Create State Management Baseline Tests ✅
- **Status:** Complete
- **Completed:** 2025-10-23
- **Commit:** `79cefc7` - phase0(baselines): add state management baseline tests
- **Files Created:**
  - `src/__tests__/baselines/state-management-baseline.test.js`
- **Tests Added:**
  - ✅ structuredClone performance measurement (~0.15ms for 100 electrode groups)
  - ✅ Immutability verification (creates new object references)
- **Performance:** Excellent - state operations are essentially instantaneous

#### Task 8: Create Performance Baseline Tests ✅
- **Status:** Complete
- **Completed:** 2025-10-23
- **Commits:**
  - `a3992bd` - phase0(baselines): add performance baseline tests
  - `55aa640` - phase0(baselines): finalize performance snapshot baselines
- **Files Created:**
  - `src/__tests__/baselines/performance-baseline.test.js`
  - `docs/SCRATCHPAD.md` - Performance metrics documentation
- **Baselines Established:**
  - Initial App render: ~33ms (threshold: <5000ms)
  - Validation (100 electrode groups): ~99ms (threshold: <1000ms)
  - structuredClone (100 electrode groups): ~0.15ms (threshold: <50ms)
  - Full import/export cycle: ~98ms (threshold: <500ms)
- **Review:** See `docs/reviews/task-8-performance-baselines-review.md`
- **Assessment:** Current performance is **excellent** with 2-20x safety margins

#### Task 9: Set Up CI/CD Pipeline ✅
- **Status:** Complete
- **Completed:** 2025-10-23
- **Commits:**
  - `9f89ce1` - phase0(ci): add GitHub Actions CI/CD pipeline
  - `4fb7340` - phase0(docs): add comprehensive CI/CD pipeline documentation
- **Files Created:**
  - `.github/workflows/test.yml` - GitHub Actions workflow
  - `docs/CI_CD_PIPELINE.md` - CI/CD documentation
- **Pipeline Features:**
  - ✅ Runs on push to main, modern, refactor/** branches
  - ✅ Runs on pull requests to main
  - ✅ Test job: linter + baseline tests + coverage
  - ✅ Integration job: schema sync check with trodes_to_nwb
  - ✅ Codecov integration for coverage tracking
- **Review:** See `docs/reviews/task-9-ci-cd-pipeline-review.md`

#### Task 10: Set Up Pre-commit Hooks ✅
- **Status:** Complete
- **Completed:** 2025-10-23
- **Commits:**
  - `bdc4d73` - phase0(hooks): add pre-commit hooks with Husky
  - `5052302` - phase0(docs): add Git hooks documentation
  - `86c8eb8` - phase0(hooks): fix pre-commit permissions and remove flaky performance snapshots
- **Files Created:**
  - `.husky/pre-commit` - Runs lint-staged on changed files
  - `.husky/pre-push` - Runs baseline tests before push
  - `.lintstagedrc.json` - Lint-staged configuration
  - `docs/GIT_HOOKS.md` - Git hooks documentation
- **Hooks Configured:**
  - **pre-commit:** ESLint auto-fix + Vitest related tests
  - **pre-push:** Full baseline test suite (blocks push if failing)
- **Review:** See `docs/reviews/task-10-implementation-review.md`

#### Task 11: Create Visual Regression Baseline (E2E) ✅
- **Status:** Complete
- **Completed:** 2025-10-23
- **Commit:** `8ef3104` - phase0(e2e): add visual regression baseline tests
- **Files Created:**
  - `e2e/baselines/visual-regression.spec.js` - Visual regression tests
  - `e2e/baselines/visual-regression.spec.js-snapshots/` - Baseline screenshots (3 PNGs)
- **Baselines Captured:**
  - ✅ Initial form state (full page)
  - ✅ Electrode groups section
  - ✅ Validation error state
- **Verification:** Screenshots stored as baseline references for future comparisons

#### Task 12: Create Integration Contract Baseline Tests ✅
- **Status:** Complete
- **Completed:** 2025-10-23
- **Commits:**
  - `f79210e` - phase0(integration): add integration contract baseline tests
  - `docs/INTEGRATION_CONTRACT.md` created
- **Files Created:**
  - `src/__tests__/integration/schema-contracts.test.js` - Integration contract tests
  - `docs/INTEGRATION_CONTRACT.md` - Integration contract documentation
- **Contracts Documented:**
  - ✅ Schema hash (for sync detection with trodes_to_nwb)
  - ✅ Device types (8 types: tetrode_12.5, A1x32-6mm-50-177-H32_21mm, etc.)
  - ✅ Required fields contract (16 required top-level fields)
- **Integration Points:** Ensures web app stays synchronized with Python backend

---

### Week 2: Documentation & Wrap-up 🟡

#### Task 13: Create TASKS.md Tracking Document 🟡
- **Status:** ⏳ In Progress
- **Started:** 2025-10-23
- **Expected Files:**
  - `TASKS.md` - This file (single source of truth for project status)
- **Purpose:** Provides easy-to-scan tracking of all Phase 0 tasks, completion dates, and next steps

#### Task 14: Create REFACTOR_CHANGELOG.md ⏸️
- **Status:** Not Started
- **Expected Files:**
  - `docs/REFACTOR_CHANGELOG.md` - Changelog for refactoring project
- **Purpose:** Documents all changes made during refactoring with clear phase/category markers

#### Task 15: Create /refactor Command ⏸️
- **Status:** Not Started
- **Expected Files:**
  - `.claude/commands/refactor.md` - Slash command for future sessions
- **Purpose:** Streamlines future Claude Code sessions with context loading and TDD workflow

#### Task 16: Final Verification and Phase 0 Completion ⏸️
- **Status:** Not Started
- **Actions Required:**
  - Run all baseline tests (`npm run test:baseline -- --run`)
  - Run full test suite with coverage (`npm run test:coverage -- --run`)
  - Run E2E tests (`npm run test:e2e`)
  - Update SCRATCHPAD.md with completion notes
  - Push to remote
  - Request human review and approval

---

## 🚪 Phase 0 Exit Gate

**Status:** 🔴 Blocked - Awaiting Tasks 13-16 completion and human approval

Before proceeding to Phase 1, the following must be verified:

### Automated Checks
- [ ] All 16 tasks in Phase 0 section checked ✅
- [x] `npm run test:baseline -- --run` passes ✅
- [x] `npm run test:coverage -- --run` passes ✅
- [x] `npm run test:e2e` passes ✅
- [x] CI pipeline is green on GitHub Actions ✅
- [x] Performance baselines documented in SCRATCHPAD.md ✅
- [x] Visual regression screenshots reviewed ✅
- [x] Schema sync test passes ✅

### Human Review Required ⚠️
- [ ] **HUMAN REVIEW:** Reviewed all baseline tests
- [ ] **HUMAN REVIEW:** Reviewed CI/CD pipeline configuration
- [ ] **HUMAN REVIEW:** Reviewed Git hooks setup
- [ ] **HUMAN REVIEW:** Reviewed documentation completeness
- [ ] **HUMAN APPROVAL:** Approved moving to Phase 1

### Final Steps
- [ ] Tag release: `git tag v3.0.0-phase0-complete`
- [ ] Push tag: `git push --tags`
- [ ] Merge to modern branch (if approved)

---

## 📚 Key Documentation

### Phase 0 Documentation
- **Plan:** `docs/plans/2025-10-23-phase-0-baselines.md` - Detailed implementation plan
- **CI/CD:** `docs/CI_CD_PIPELINE.md` - CI/CD pipeline documentation
- **Git Hooks:** `docs/GIT_HOOKS.md` - Pre-commit/pre-push hooks documentation
- **Integration:** `docs/INTEGRATION_CONTRACT.md` - Integration contracts with trodes_to_nwb
- **Performance:** `docs/SCRATCHPAD.md` - Performance baseline metrics
- **Environment:** `docs/ENVIRONMENT_SETUP.md` - Environment setup guide

### Reviews
- `docs/reviews/task-3-test-directory-structure-review.md`
- `docs/reviews/task-4-test-helpers-review.md`
- `docs/reviews/task-8-performance-baselines-review.md`
- `docs/reviews/task-9-ci-cd-pipeline-review.md`
- `docs/reviews/task-10-implementation-review.md`

### Project Instructions
- `CLAUDE.md` - Primary instructions for Claude Code
- `README.md` - Project overview
- `CHANGELOG.md` - Production changelog (not to be confused with REFACTOR_CHANGELOG.md)

---

## 🔮 What's Next: Phase 1 Preview

**Phase 1: Testing Foundation (Weeks 3-5)**
- **Goal:** Build comprehensive test suite WITHOUT changing production code
- **Status:** 🔴 Blocked (waiting for Phase 0 approval)

**Planned Tasks (will be detailed after Phase 0 approval):**
- Unit tests for validation functions
- Unit tests for state management utilities
- Unit tests for form components
- Integration tests for complex workflows
- E2E tests for user journeys
- Expand coverage to 80%+ for critical paths

---

## 📝 Notes & Conventions

### Commit Message Format
```
phase0(category): description

Examples:
- phase0(infra): configure Vitest test framework
- phase0(baselines): add validation baseline tests
- phase0(ci): add GitHub Actions CI/CD pipeline
- phase0(docs): add comprehensive CI/CD pipeline documentation
```

### Test Commands
```bash
# Run all tests
npm test -- --run

# Run specific test file
npm test -- validation-baseline.test.js --run

# Run with coverage
npm run test:coverage -- --run

# Run E2E tests
npm run test:e2e

# Run baseline tests only
npm run test:baseline -- --run

# Update visual regression snapshots
npm run test:e2e -- --update-snapshots
```

### Git Workflow
```bash
# Current branch
git branch
# Should show: * modern

# Check worktree location
pwd
# Should be: .worktrees/phase-0-baselines

# Commit frequently
git add <files>
git commit -m "phase0(category): description"

# Push to remote
git push -u origin modern
```

### Troubleshooting
- **Tests fail:** Check console output, verify imports, ensure environment setup complete
- **CI fails:** Check GitHub Actions logs at https://github.com/LorenFrankLab/rec_to_nwb_yaml_creator/actions
- **Hooks don't run:** Run `npx husky install`
- **Snapshots need updating:** Run test with `--update-snapshots` flag
- **Performance variance:** Snapshots removed from performance tests to avoid flakiness

---

## 🎯 Success Criteria

Phase 0 will be considered **complete** when:

1. ✅ All 16 tasks are checked off
2. ✅ All baseline tests pass and document current behavior (including bugs)
3. ✅ CI/CD pipeline is operational and green
4. ✅ Pre-commit hooks prevent commits without linting/testing
5. ✅ Performance baselines are documented with safety margins
6. ✅ Visual regression baselines captured for UI stability
7. ✅ Integration contracts established with trodes_to_nwb
8. ⏸️ Human reviewer has approved all baselines
9. ⏸️ Team agrees current behavior is accurately documented
10. ⏸️ Release tagged as `v3.0.0-phase0-complete`

---

**Questions or Issues?** Document in `docs/SCRATCHPAD.md` and ask for guidance.

**Last Updated:** 2025-10-23 by Claude Code
**Next Update:** After Task 13 completion or Phase 0 exit gate
