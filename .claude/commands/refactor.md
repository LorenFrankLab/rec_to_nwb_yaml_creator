---
description: Quick access to refactoring project status, documentation, and common operations
---

# 🔄 Refactoring Project Assistant

**Context:** You're working on the rec_to_nwb_yaml_creator refactoring project following the comprehensive Phase 0-5 plan.

---

## 📊 Current Status

**Phase:** Phase 1 - Testing Foundation
**Branch:** `main` (Phase 0 merged and approved)
**Working Directory:** `/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator`

---

## 📚 Key Documentation

You MUST READ these files IN ORDER to understand context:

### Critical Reading Order

1. **CLAUDE.md** - Project overview, zero-tolerance policy, critical workflows
2. **docs/TASKS.md** - Current task checklist with completion status (PHASE 1 tasks)
3. **docs/plans/COMPREHENSIVE_REFACTORING_PLAN.md** - Overall refactoring strategy
4. **docs/SCRATCHPAD.md** - Session notes and performance baselines
5. **docs/REFACTOR_CHANGELOG.md** - All changes made during refactoring

### Supporting Documentation

- **docs/ENVIRONMENT_SETUP.md** - Node.js environment details
- **docs/CI_CD_PIPELINE.md** - GitHub Actions workflow documentation
- **docs/GIT_HOOKS.md** - Pre-commit/pre-push hook details
- **docs/INTEGRATION_CONTRACT.md** - Schema sync and device type contracts

---

## 🧪 Common Test Commands

```bash
# Run all tests
npm test -- --run

# Run baseline tests only
npm run test:baseline -- --run

# Run specific test file
npm test -- validation-baseline.test.js --run

# Run with coverage
npm run test:coverage -- --run

# Run E2E tests
npm run test:e2e

# Run integration tests
npm run test:integration -- --run

# Update visual regression snapshots
npm run test:e2e -- --update-snapshots
```

---

## 🔧 Quick Actions

### Check Project Status

```bash
# View current phase tasks
cat docs/TASKS.md | grep -A 100 "## Phase 1"

# Check what's been completed
git log --oneline -20

# View performance baselines
cat docs/SCRATCHPAD.md
```

### Run Verification Suite

```bash
# Full verification (what CI runs)
npm run lint && npm run test:baseline -- --run && npm run test:coverage -- --run

# Quick smoke test
npm test -- --run --passWithNoTests
```

### Git Workflow

```bash
# Current branch and status
git status

# Commit with phase prefix
git add <files>
git commit -m "phase1(category): description"

# View recent commits
git log --oneline -10

# Push to remote
git push origin main
```

---

## ⚠️ Critical Rules

### Test-Driven Development (TDD)

1. **ALWAYS write test FIRST**
2. **Run test and verify it FAILS** (or establishes baseline)
3. **Only then create implementation**
4. **Run test until it PASSES**
5. **Run full regression suite**

### Phase Gate Rules

- ❌ **DO NOT move to next phase** until ALL current phase tasks are checked
- ❌ **DO NOT skip tests** to match broken code
- ❌ **DO NOT change baselines** without explicit approval
- ✅ **ASK permission** if you need to change requirements

### Zero-Tolerance Policy

- This is **critical scientific infrastructure**
- Any regression can **corrupt irreplaceable data**
- Always use **verification-before-completion** skill
- Never skip verification steps

---

## 📋 Phase 1 Exit Criteria

Before moving to Phase 2, ALL must be ✅:

- [ ] Unit test coverage ≥ 60%
- [ ] Integration test coverage ≥ 50%
- [ ] All tests passing (baseline + new unit tests)
- [ ] No new ESLint errors introduced
- [ ] Documentation updated
- [ ] Human review and approval

**Check current status:** `cat docs/TASKS.md | grep -A 10 "Phase 1 Exit Gate"`

---

## 🆘 Troubleshooting

### Tests Failing

```bash
# Check console output for errors
npm test -- <test-file> --run --no-coverage

# Verify imports work
npm test -- --run --passWithNoTests

# Clear and reinstall
rm -rf node_modules && npm install
```

### Snapshots Need Updating

```bash
# Update Vitest snapshots
npm test -- --run --update

# Update Playwright screenshots
npm run test:e2e -- --update-snapshots
```

### Hooks Not Running

```bash
# Reinstall hooks
npx husky install

# Check hook files exist
ls -la .husky/
```

### Environment Issues

```bash
# Run environment setup
/setup

# Or manually
nvm use && npm install
```

---

## 🎯 Your Next Steps

1. **Read docs/TASKS.md** to find the next unchecked [ ] task in Phase 1
2. **Read existing production code** that you'll be testing
3. **Follow TDD workflow** for the task:
   - Write test first (covering existing behavior)
   - Verify test passes (we're testing existing code, not fixing bugs)
   - Add additional test cases for edge cases
   - Run full regression suite
4. **Update documentation**:
   - Check off [x] in TASKS.md
   - Add notes to SCRATCHPAD.md if you discover important behaviors
   - Update REFACTOR_CHANGELOG.md
5. **Commit with phase prefix**: `phase1(tests): description`

---

## 💡 Remember

- **Read before you code** - Use Read tool to understand context
- **Test before you implement** - TDD is mandatory
- **Verify before you claim completion** - Use verification-before-completion skill
- **Ask when uncertain** - Better to ask than assume
- **Document as you go** - Update SCRATCHPAD.md with decisions/blockers

---

## 📞 When Blocked

If you encounter any of these, STOP and document in SCRATCHPAD.md:

1. ❓ **Unclear requirements** - Ask for clarification
2. 🐛 **Unexpected test failures** - Use systematic-debugging skill
3. 🔄 **Conflicting requirements** - Ask for guidance
4. ⚠️ **Need to change baselines** - Request approval
5. 🚫 **Missing dependencies** - Document and ask for help

**Never proceed with assumptions** - this is critical scientific infrastructure.

---

Now tell me: **What task are you working on next?**

Read docs/TASKS.md to find the first unchecked [ ] task in Phase 0.
