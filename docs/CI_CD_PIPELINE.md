# CI/CD Pipeline Documentation

## Overview

This repository uses GitHub Actions for continuous integration and deployment. The CI/CD pipeline automatically runs tests, checks code quality, and validates integration points on every push and pull request.

**Workflow File:** `.github/workflows/test.yml`

## Pipeline Architecture

The pipeline consists of 6 independent jobs that run in parallel where possible. `e2e`,
`integration`, and `build` wait for the fast `test` gate; `typecheck` and `coverage` run in parallel.

```
┌─────────────────────────────────────────────────────────────┐
│  Push to any branch / PR to main                            │
└────────────────┬────────────────────────────────────────────┘
                 │
        ┌────────┼────────┐
        │        │        │
        ▼        ▼        ▼
┌────────────┐ ┌──────────┐ ┌──────────┐
│ 1. Test    │ │2.Typecheck│ │3.Coverage│
└─────┬──────┘ └──────────┘ └──────────┘
      │
 ┌────┼───────────┐
 │    │           │
 ▼    ▼           ▼
┌──────┐ ┌─────────────────┐ ┌────────┐
│4. E2E│ │5. Integration   │ │6.Build │
│      │ │  (Schema Sync)  │ │        │
└──────┘ └─────────────────┘ └────────┘
```

### Job 1: Test (Unit & Integration Tests)

**Runs on:** `ubuntu-latest`

**Steps:**

1. Checkout repository
2. Setup Node.js v26.0.0 (from `.nvmrc`)
3. Install dependencies (`npm ci`)
4. Check schema version (`node scripts/check-schema-version.mjs --expected-version 1.0.1`)
5. Run linter (`npm run lint:ci` — ESLint with `--max-warnings 0`)
6. Run CSS linter (`npm run lint:css`)
7. Run all Vitest tests without coverage (`npm test -- run`)

**Failure Conditions:**

- Linter errors **or warnings** (`lint:ci` runs `--max-warnings 0` — this is the warnings-as-errors
  gate that CRA's `CI=true react-scripts build` used to provide before the Vite migration)
- Schema version mismatch
- CSS linter failure
- Any Vitest failure

### Job 2: Type Check

**Runs on:** `ubuntu-latest`

**Steps:**

1. Checkout repository
2. Setup Node.js v26.0.0
3. Install dependencies
4. Run TypeScript (`npm run typecheck`)

**Failure Conditions:**

- TypeScript errors

### Job 3: Coverage

**Runs on:** `ubuntu-latest`

**Steps:**

1. Checkout repository
2. Setup Node.js v26.0.0
3. Install dependencies
4. Run all tests with coverage (`npm run test:coverage -- run`)
5. Upload coverage to Codecov
6. Upload coverage artifacts (30-day retention)

**Failure Conditions:**

- Coverage test failure
- Coverage threshold not met (80% for lines, functions, branches, statements)

**Artifacts:**

- `coverage-report/` - HTML and LCOV coverage reports (30 days)

### Job 4: E2E (End-to-End Tests)

**Runs on:** `ubuntu-latest`
**Depends on:** `test` job must pass first

**Steps:**

1. Checkout repository
2. Setup Node.js v26.0.0
3. Install dependencies
4. Install Playwright browser dependencies (Chromium only)
5. Run E2E tests (`npm run test:e2e`)
6. Upload Playwright HTML report (always, even on failure)
7. Upload test results (always, even on failure)

**Failure Conditions:**

- Any Chromium E2E test failure

**Artifacts:**

- `playwright-report/` - HTML test report with screenshots (30 days)
- `playwright-test-results/` - Raw test results and traces (30 days)

### Job 5: Integration (Schema Sync Check)

**Runs on:** `ubuntu-latest`
**Depends on:** `test` job must pass first

**Purpose:** Verify that `nwb_schema.json` is synchronized between this repository and the `trodes_to_nwb` Python package.

**Steps:**

1. Checkout this repository (`rec_to_nwb_yaml_creator`)
2. Checkout `trodes_to_nwb` repository
3. Fail immediately if the downstream schema file is missing at the expected path
4. Compare SHA256 hashes of both schema files
5. Exit with error if hashes don't match

**Why This Matters:**

- The web app and Python package must use identical schemas
- Schema drift causes validation inconsistencies
- Prevents YAML files passing validation here but failing in Python
- Critical for scientific data integrity

**Failure Conditions:**

- Schema hash mismatch
- Schema file not found in the checked-out Python package at the expected path

### Job 6: Build (Production Bundle)

**Runs on:** `ubuntu-latest`
**Depends on:** `test` job must pass first

**Steps:**

1. Checkout repository
2. Setup Node.js v26.0.0
3. Install dependencies
4. Build production bundle (`npm run build`)
5. Upload build artifacts

**Failure Conditions:**

- Build compilation errors
- Missing required files

**Artifacts:**

- `build/` - Production-ready static files (7 days)

## Triggers

### Push Events

```yaml
on:
  push:
    branches: ['**']  # All branches
```

The pipeline runs on **every push to any branch**. This ensures:

- Feature branches are validated before PR
- Commits to `main` are always tested
- Worktree branches (`refactor/*`) are tested

### Pull Request Events

```yaml
on:
  pull_request:
    branches: [main]
```

The pipeline runs on **every PR targeting `main`**. This provides:

- Pre-merge validation
- Required status checks for merging
- Protection against breaking changes

## Node.js Version Management

The pipeline uses the exact Node.js version specified in `.nvmrc`:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version-file: '.nvmrc'  # Currently v26.0.0
    cache: 'npm'
```

**Benefits:**

- Consistent environment across CI and local development
- Automatic caching of npm dependencies
- Version updates managed through `.nvmrc` file

## Test Execution Details

### Baseline Tests

```bash
npm run test:baseline
# Runs: vitest run baselines
```

Tests in `src/__tests__/baselines/` that document current behavior (including bugs). These tests MUST NOT fail - they represent the safety net for refactoring.

**Coverage:** State management, validation, performance, integration contracts

### Unit Tests

```bash
npm test -- run unit
# Runs: vitest run unit
```

Tests in `src/__tests__/unit/` that test individual functions and components in isolation.

**Current Status:** Not implemented yet (Phase 1)

### Integration Tests

```bash
npm run test:integration
# Runs: vitest run integration
```

Tests in `src/__tests__/integration/` that test interactions between components.

**Current Status:** Not implemented yet (Phase 1)

### Coverage Requirements

Defined in `vite.config.ts`:

```javascript
coverage: {
  lines: 80,
  functions: 80,
  branches: 80,
  statements: 80,
}
```

The pipeline **fails** if coverage drops below these thresholds.

### E2E Tests

```bash
npm run test:e2e
# Runs: playwright test
```

Tests in `e2e/` that test complete user workflows across browsers.

**Browsers Tested:**

- Chromium (Desktop Chrome)
- Firefox (Desktop Firefox)
- WebKit (Desktop Safari)

**Configuration:** `playwright.config.js`

- Retries: 2 (in CI only)
- Workers: 1 (in CI, unlimited locally)
- Screenshots: On failure only
- Traces: On first retry

## Codecov Integration

Coverage reports are uploaded to [Codecov](https://codecov.io/) for tracking over time.

```yaml
- uses: codecov/codecov-action@v4
  with:
    files: ./coverage/lcov.info
    flags: unittests
    fail_ci_if_error: false
    token: ${{ secrets.CODECOV_TOKEN }}
```

**Setup Required:**

1. Add `CODECOV_TOKEN` to GitHub repository secrets
2. Configure Codecov project settings
3. Set up coverage thresholds and PR comments

**Note:** Pipeline does NOT fail if Codecov upload fails (`fail_ci_if_error: false`).

## Artifact Retention

| Artifact | Retention | Size (typical) | Purpose |
|----------|-----------|----------------|---------|
| `coverage-report/` | 30 days | ~5 MB | Debugging coverage issues |
| `playwright-report/` | 30 days | ~10 MB | E2E test results with screenshots |
| `playwright-test-results/` | 30 days | ~20 MB | Traces for debugging failures |
| `build/` | 7 days | ~500 KB | Testing production builds |

## Performance Targets

Based on typical runs:

| Job | Target Duration | Typical Duration |
|-----|-----------------|------------------|
| Test (Unit/Integration) | < 5 minutes | ~2-3 minutes |
| E2E | < 10 minutes | ~5-7 minutes |
| Integration (Schema Sync) | < 1 minute | ~30 seconds |
| Build | < 3 minutes | ~1-2 minutes |
| **Total Pipeline** | **< 10 minutes** | **~5-7 minutes** |

**Optimization Strategies:**

- Dependency caching (`cache: 'npm'`)
- Parallel job execution
- Playwright browser installation with deps
- Minimal test file patterns

## Troubleshooting

### Pipeline Failing on Snapshot Mismatches

**Symptom:** Baseline tests fail with snapshot mismatches

**Cause:** Performance variance or legitimate behavior changes

**Solution:**

```bash
# Update snapshots locally
npm run test:baseline -- -u

# Commit updated snapshots
git add src/__tests__/baselines/__snapshots__/
git commit -m "test: update baseline snapshots"
```

### Linter Errors Blocking Pipeline

**Symptom:** `npm run lint` fails with errors

**Cause:** Code doesn't meet ESLint rules

**Solution:**

```bash
# Auto-fix what can be fixed
npm run lint

# Manually fix remaining errors
# Commit fixes
```

### E2E Tests Timing Out

**Symptom:** Playwright tests exceed timeout

**Cause:** App startup slow or tests waiting for non-existent elements

**Solution:**

```bash
# Run locally with UI to debug
npm run test:e2e:ui

# Check Playwright traces in artifacts
# Increase timeout in playwright.config.js if needed
```

### Schema Sync Check Failing

**Symptom:** Integration job fails with "Schema mismatch detected!"

**Cause:** `nwb_schema.json` differs between repositories

**Solution:**

```bash
# Compare schemas
cd /path/to/rec_to_nwb_yaml_creator
sha256sum src/nwb_schema.json

cd /path/to/trodes_to_nwb
sha256sum src/trodes_to_nwb/nwb_schema.json

# Synchronize schemas (copy from authoritative source)
# Update both repositories
# Coordinate changes with team
```

### Coverage Below Threshold

**Symptom:** "Coverage for X (Y%) does not meet threshold (80%)"

**Cause:** New code added without tests

**Solution:**

```bash
# Run coverage locally
npm run test:coverage

# Add tests for uncovered code
# Or adjust thresholds in vite.config.ts (with approval)
```

## Local Testing

Before pushing, run the same checks locally:

```bash
# Full CI simulation
npm run lint
npm run test:baseline
npm test -- run unit
npm run test:integration
npm run test:coverage -- run
npm run test:e2e
npm run build

# Quick validation (recommended before commit)
npm run lint
npm run test:baseline
npm run build
```

## Future Enhancements

Planned improvements for the CI/CD pipeline:

1. **Matrix Testing**
   - Test across multiple Node.js versions
   - Test across different OS (Ubuntu, macOS, Windows)

2. **Deployment Automation**
   - Auto-deploy to GitHub Pages on `main` push
   - Deploy preview builds for PRs

3. **Performance Monitoring**
   - Track bundle size over time
   - Alert on significant size increases
   - Track test execution time

4. **Security Scanning**
   - Dependency vulnerability scanning
   - SAST (Static Application Security Testing)
   - License compliance checks

5. **Notification Integration**
   - Slack notifications for failures
   - Email digests for main branch
   - PR comment summaries

## Related Documentation

- [TESTING_PLAN.md](TESTING_PLAN.md) - Comprehensive testing strategy
- [REVIEW.md](REVIEW.md) - Known issues and bugs
- [CLAUDE.md](../CLAUDE.md) - Development workflow and guidelines
- [vite.config.ts](../vite.config.ts) - Test configuration
- [playwright.config.js](../playwright.config.js) - E2E test configuration

## Questions?

For issues with the CI/CD pipeline:

1. Check GitHub Actions logs for detailed error messages
2. Review this documentation for common solutions
3. Test locally to reproduce issues
4. Open an issue with pipeline logs attached
