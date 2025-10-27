# Documentation Overview

This directory contains documentation for the rec_to_nwb_yaml_creator project.

---

## Essential Documentation (Root Level)

These files are actively used by developers working on the project:

### Project Status & History

**[PHASE_3_COMPLETION_REPORT.md](PHASE_3_COMPLETION_REPORT.md)** (23 KB)

- **Purpose:** Comprehensive report of Phase 3 refactoring completion
- **Why keep:** Documents final architecture, exit criteria results, and lessons learned
- **Audience:** New developers understanding the codebase structure
- **Last updated:** October 27, 2025

**[REFACTOR_CHANGELOG.md](REFACTOR_CHANGELOG.md)** (43 KB)

- **Purpose:** Chronological history of all refactoring changes
- **Why keep:** Provides context for architectural decisions and change rationale
- **Audience:** Developers investigating "why was this done this way?"
- **Last updated:** October 26, 2025

**[TASKS.md](TASKS.md)** (5 KB)

- **Purpose:** Summary of Phase 3 completed work and exit criteria
- **Why keep:** Quick reference for what was accomplished
- **Audience:** Team members wanting a high-level overview
- **Last updated:** October 27, 2025

**[SCRATCHPAD.md](SCRATCHPAD.md)** (4 KB)

- **Purpose:** Active development notes and key architectural decisions
- **Why keep:** Living document for ongoing development guidance
- **Audience:** Current and future developers
- **Last updated:** October 27, 2025

### Development Infrastructure

**[TESTING_PATTERNS.md](TESTING_PATTERNS.md)** (37 KB)

- **Purpose:** Test patterns, conventions, and best practices
- **Why keep:** Essential guide for writing tests in this codebase
- **Audience:** Anyone writing or reviewing tests
- **Usage:** Reference for TDD approach, deep merge pattern, fixture usage

**[INTEGRATION_CONTRACT.md](INTEGRATION_CONTRACT.md)** (6 KB)

- **Purpose:** Contracts between this app and trodes_to_nwb (Python backend)
- **Why keep:** Critical for avoiding breaking changes to scientific pipeline
- **Audience:** Anyone modifying YAML output, schema, or device types
- **Usage:** Verify compatibility before schema changes

**[CI_CD_PIPELINE.md](CI_CD_PIPELINE.md)** (11 KB)

- **Purpose:** GitHub Actions workflow documentation
- **Why keep:** Explains automated testing and deployment process
- **Audience:** Anyone debugging CI failures or modifying workflows
- **Usage:** Reference when tests fail in CI but pass locally

**[ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md)** (5 KB)

- **Purpose:** Node.js environment setup and contained environment rationale
- **Why keep:** Ensures reproducible development environment
- **Audience:** New developers setting up the project
- **Usage:** Run before any development work

**[GIT_HOOKS.md](GIT_HOOKS.md)** (4 KB)

- **Purpose:** Pre-commit and pre-push hook documentation
- **Why keep:** Explains automated quality checks
- **Audience:** Anyone encountering hook failures
- **Usage:** Understand why commits are being rejected

---

## Archive (Preserved for Historical Context)

### Phase Completion Reports (docs/archive/)

**Phase 0-2 completion reports:**

- PHASE_0_COMPLETION_REPORT.md
- PHASE_1_COMPLETION_ASSESSMENT.md
- PHASE_1.5_SUMMARY.md
- PHASE_2.5_COMPLETE.md

**Why keep:** Historical record of development phases, useful for understanding evolution

**When to delete:** Never (historical value, minimal space cost)

### Analysis Documents (docs/archive/)

- APP_JS_COVERAGE_ANALYSIS.md - Coverage analysis that informed refactoring
- REFACTORING_SAFETY_ANALYSIS.md - Risk assessment and mitigation strategies
- TASK_1.5.1_FINDINGS.md - Integration test findings

**Why keep:** Context for major architectural decisions

### Legacy Documentation (docs/archive/legacy-docs/)

**Original documentation from pre-refactor:**

- app.md, developer.md, electron.md, fields.md, files.md, overview.md, tools.md

**Why keep:** Historical reference, some content may still be relevant

**When to update:** If original documentation has valuable content not in CLAUDE.md

---

## Documents Deleted (October 27, 2025)

The following were removed as temporary artifacts:

**Session reports (7 files):**

- 2025-10-27-P0-P1-fixes-session-summary.md
- 2025-10-27-P0-P1-session-complete.md
- Duplicated content from PHASE_3_COMPLETION_REPORT.md

**Code review reports (5 files):**

- 2025-10-27-code-review-report.md
- 2025-10-27-comprehensive-review-summary.md
- 2025-10-27-javascript-review-report.md
- 2025-10-27-react-review-report.md
- 2025-10-27-ux-review-report.md
- Process artifacts, findings integrated into final code

**Planning documents (6 files):**

- COMPREHENSIVE_REFACTORING_PLAN.md
- TESTING_PLAN.md
- VALIDATION_REFACTORING_PLAN.md
- 2025-10-23-contained-environment-setup.md
- 2025-10-23-phase-0-baselines.md
- PHASE_1.5_TEST_QUALITY_IMPROVEMENTS.md
- Completed plans, no longer needed

**Review documents (13 files):**

- All docs/reviews/* files
- Process artifacts from Phase 0-2
- Findings integrated into code and final reports

**Validation reports (2 files):**

- PHASE_2B_COMPLETION.md
- SCALING_SUMMARY.md
- Phase-specific artifacts

**Redundant docs (7 files):**

- P0_P1_FIXES.md - redundant with PHASE_3_COMPLETION_REPORT.md
- TRODES_TO_NWB_SCHEMA_UPDATE.md - outdated
- INTEGRATION_EXAMPLE.md - examples now in code comments

**Total deleted:** 35 files (~200 KB)
**Preserved in git history:** Yes (commit 994e082)

---

## Documentation Maintenance

### When to Add Documentation

**Add new docs when:**

- New architectural patterns introduced
- Integration contracts change
- Testing patterns evolve
- Development workflow changes

**Add to archive/ when:**

- Document is historical but has lasting value
- Phase completion reports
- Major analysis documents

### When to Delete Documentation

**Delete docs when:**

- Content is fully superseded by newer documentation
- Information is outdated and misleading
- Document was a temporary artifact (session notes, draft plans)
- Content is available in git history if needed

**Never delete:**

- Integration contracts (critical for pipeline compatibility)
- Testing patterns (actively used)
- Infrastructure docs (CI/CD, environment, hooks)
- Phase 3 completion report (final state documentation)

### Documentation Review Schedule

**Quarterly:** Review root-level docs for relevance
**Annually:** Review archive/ for consolidation opportunities
**After major changes:** Update affected documentation immediately

---

## Quick Reference

**New developers start here:**

1. [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) - Set up your environment
2. [CLAUDE.md](../CLAUDE.md) - Main development guide
3. [TESTING_PATTERNS.md](TESTING_PATTERNS.md) - How to write tests
4. [PHASE_3_COMPLETION_REPORT.md](PHASE_3_COMPLETION_REPORT.md) - Understand the architecture

**Before modifying YAML output:**

- [INTEGRATION_CONTRACT.md](INTEGRATION_CONTRACT.md) - Check compatibility contracts

**When tests fail:**

- [TESTING_PATTERNS.md](TESTING_PATTERNS.md) - Test debugging guide
- [CI_CD_PIPELINE.md](CI_CD_PIPELINE.md) - CI-specific issues

**Understanding refactoring:**

- [TASKS.md](TASKS.md) - High-level summary
- [PHASE_3_COMPLETION_REPORT.md](PHASE_3_COMPLETION_REPORT.md) - Detailed report
- [REFACTOR_CHANGELOG.md](REFACTOR_CHANGELOG.md) - Chronological history

---

**Total documentation:** 9 essential files (root) + 15 archived files = 24 files (~150 KB)
**All historical artifacts preserved in git history**
**Last reviewed:** October 27, 2025
