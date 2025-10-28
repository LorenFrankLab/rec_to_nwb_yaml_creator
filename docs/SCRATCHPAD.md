# Development Scratchpad

**Purpose:** Notes for ongoing development work on the rec_to_nwb_yaml_creator project.

- Use this file to keep notes on ongoing development work.
- When the work is completed, clean it out from this file, so that the contents only reflect ongoing work.

**Last Updated:** October 27, 2025

---

## Current Session: Refactoring Plan Review & Architecture Design

**Status:** Planning phase complete - Ready to begin implementation

### Documents Created

1. **[REFACTORING_PLAN_REVISED.md](REFACTORING_PLAN_REVISED.md)** - Revised migration plan
   - Addresses 8 critical concerns from original plan
   - Preserves existing infrastructure (Context store, Vitest, single-page app)
   - Moves shadow export validation to PR1 (from PR8)
   - Adds continuous accessibility requirements
   - Defines TypeScript strategy (JSDoc first, defer .ts conversion)

2. **[ANIMAL_WORKSPACE_DESIGN.md](ANIMAL_WORKSPACE_DESIGN.md)** - Multi-animal architecture
   - Complete data model with TypeScript interfaces
   - localStorage storage strategy (5MB capacity)
   - YAML export flow (preserves current format)
   - UI workflow (4 views: Home, Animal Workspace, Day Editor, Validation)
   - Batch operations (creation, validation, export)
   - Probe reconfiguration tracking with versioning
   - Migration path (Phase 1: single animal, Phase 2: multi-animal)

### Key Decisions

| Topic | Decision | Location |
|-------|----------|----------|
| **State Management** | Extend existing Context/hooks (no Zustand) | REFACTORING_PLAN_REVISED.md §1 |
| **Testing** | Audit existing 90+ tests, integrate shadow export | REFACTORING_PLAN_REVISED.md §4 |
| **Shadow Export** | Move to PR1 for immediate parity enforcement | REFACTORING_PLAN_REVISED.md §6 |
| **TypeScript** | JSDoc first, defer .ts conversion to PR7+ | REFACTORING_PLAN_REVISED.md §2 |
| **Routing** | Hash-based conditional rendering (no React Router) | REFACTORING_PLAN_REVISED.md §3 |
| **Storage** | localStorage (Phase 1), file system (Phase 2) | ANIMAL_WORKSPACE_DESIGN.md §4 |
| **YAML Format** | Unchanged - each day exports independent file | ANIMAL_WORKSPACE_DESIGN.md §5 |
| **Devices** | Configuration versioning for probe tracking | ANIMAL_WORKSPACE_DESIGN.md §3.2 |

### Milestone Sequence (Revised)

- **M0**: Repo Prep & Safety Rails (feature flags, schema version, test audit)
- **M0.5**: Type System Strategy (JSDoc coverage target, tsconfig)
- **M1**: Extract Pure Utilities + Shadow Export (moved from PR8)
- **M2**: UI Skeleton + Hash Routing (a11y from start)
- **M3**: Extend Existing Store (workspace state in Context)
- **M4-M12**: Continue with feature development

### Next Actions

**Before Implementation:**

- [ ] Review and approve ANIMAL_WORKSPACE_DESIGN.md
- [ ] Answer open questions (import strategy, experiment description scope)
- [ ] Create FEATURE_FLAGS.md (flag lifecycle documentation)
- [ ] Create SCHEMA_UPGRADE_PROTOCOL.md (coordination with trodes_to_nwb)

**Ready to Start:**

- [ ] M0: Repository audit (existing tests, baseline coverage)
- [ ] M0: Add feature flags (src/featureFlags.js)
- [ ] M0: Add schema version to nwb_schema.json
- [ ] M0: Create check-schema-version.mjs script

### Open Questions

From ANIMAL_WORKSPACE_DESIGN.md:

1. **Import existing YAMLs**: Batch import from directory (defer to Phase 2)
2. **Experiment description**: Animal-level with day override (recommended)
3. **Weight tracking**: Animal default with day override (recommended)
4. **Camera IDs**: Animal-level with day override (recommended)

### Reference Links

- Original plan: [COMPREHENSIVE_REFACTORING_PLAN.md](COMPREHENSIVE_REFACTORING_PLAN.md)
- Task breakdown: [TASKS.md](TASKS.md)
- Implementation guide: [CLAUDE.md](../CLAUDE.md)
- Testing patterns: [TESTING_PATTERNS.md](TESTING_PATTERNS.md)

---
