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
1. Verify Node.js version matches `.nvmrc` (v26.0.0)
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
✓ Environment ready: Node v26.0.0, dependencies installed
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

> 📎 **Verified downstream requirements + how to re-research them:** [docs/PIPELINE_REQUIREMENTS.md](docs/PIPELINE_REQUIREMENTS.md).
> It records the field-by-field trodes_to_nwb / DANDI / Spyglass requirements (what's required, tolerated,
> or **silently** mishandled), the mandatory NWB-validation commands (`nwbinspector --config dandi`,
> `dandi validate`), and the exact files/URLs + method to re-verify when those repos change.

**Pipeline gotchas (hard-won — see [docs/PIPELINE_REQUIREMENTS.md](docs/PIPELINE_REQUIREMENTS.md) for detail):**

- **Downstream validation is mostly *silent*, so this app is the real gate.** trodes_to_nwb's schema check
  only logs (never raises) and its NWB Inspector run doesn't fail on findings; Spyglass logs ingestion
  errors to a side table and continues. A YAML that "converts without error" can still be wrong — validate
  the NWB itself (`nwbinspector --config dandi` → zero CRITICAL, then `dandi validate` → exit 0).
- **Channel-map `map` values are probe *electrode IDs*, reset per electrode group** (a 2nd tetrode is
  `0..3`, not `4..7`), and multi-shank probes partition `0..N-1` across shanks — they are **not** global
  hardware channels. `bad_channels` are probe-local indices; out-of-range is silently ignored downstream.
- **DANDI rejects free-text `species`** — it must be a Latin binomial (`Rattus norvegicus`) or NCBI Taxon URI.
- **Researching trodes_to_nwb / spyglass:** the local `~/Documents/GitHub/{trodes_to_nwb,spyglass}` checkouts
  are **not readable from the agent sandbox** (EPERM) — read them from GitHub (`raw.githubusercontent.com` /
  the contents API) instead.

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

1. **Probe `device_type` must resolve to a real probe.** The `device_type` (e.g. `"tetrode_12.5"`) must match a `probe_type` file in `trodes_to_nwb`'s `device_metadata/probe_metadata/` (exact, case-sensitive — otherwise conversion hard-fails with `FileNotFoundError`). *(Verified update: on current Spyglass `master`, `ProbeType` is auto-registered from the NWB `ndx_franklab_novela.Probe`, not a pre-existing Spyglass table; the `ElectrodeGroup.probe_id`-NULL risk now occurs when the electrode group's device isn't a proper ndx Probe with `probe_type` + geometry. See [docs/PIPELINE_REQUIREMENTS.md](docs/PIPELINE_REQUIREMENTS.md) §3.)*

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

### Environment Setup

```bash
/setup                 # Automated environment verification (recommended)
nvm use                # Switch to Node version from .nvmrc
node --version         # Check current Node version (should match .nvmrc: v26.0.0)
npm install            # Install exact dependency versions from package-lock.json
```

**When to run:**
- Start of every Claude Code session
- After pulling changes that update .nvmrc or package.json
- When switching between projects
- If you see module import errors or version mismatches

### Development

```bash
npm run start          # Start development server (opens browser automatically)
npm run build          # Build production bundle
npm test               # Run tests in watch mode
npm run lint           # Run ESLint with auto-fix
npm run typecheck      # tsc --noEmit (the only thing that type-checks .ts/.tsx)
```

### Deployment

```bash
npm run deploy         # Deploy to GitHub Pages (builds and pushes to gh-pages branch)
```

**Important:** The `gh-pages` branch should never be deleted - it serves the live application.

## TypeScript

The codebase is incrementally adopting TypeScript. `.ts`/`.tsx` and `.js`/`.jsx` files
**coexist** — `tsconfig.json` sets `allowJs: true` (so JS imports TS and vice versa) and
`checkJs: false` (so `.js` files are parsed but not type-checked).

**The production build does NOT type-check.** `vite build` compiles TypeScript with esbuild,
which strips types without checking them — so a type error never fails the build. The
**only** thing that type-checks is `npm run typecheck` (`tsc --noEmit`), which runs as its own
CI job. If you change a `.ts` file, run `npm run typecheck` before claiming it works; the build
passing tells you nothing about types.

`tsconfig.json` currently omits the `@/*` path alias; the alias is resolved (for both the build
and the test lane) by `resolve.alias` in `vite.config.ts`. No build-included source uses `@/`.
(The historical reason for keeping it out of tsconfig — react-scripts forbidding
`compilerOptions.paths` and rewriting the file — no longer applies now that the build is Vite, so
re-adding tsconfig `paths` is a possible future cleanup.)

**Conversion guidance:** type the lowest-churn, highest-leverage **pure** modules first
(`io/`, then `state/`, then `domain/`/`validation/`) — not components. A pure module with a
small, stable public surface (e.g. the YAML codec) is typed under `strict` with **no logic
change**; verify it against its existing tests and the golden baselines (`npx vitest run baselines`)
before moving on. Components (`.jsx` → `.tsx`) and `checkJs: true` are intentionally deferred.

## Styling

**Design tokens** live in `src/index.css` `:root` and are available app-wide (index.css loads on
every route). Use them instead of raw values: colors (`--color-primary`, `--color-error`,
`--color-grey-*`, …), spacing (`--spacing-*`), typography (`--font-size-*`), radius
(`--radius-sm/md`), shadow (`--shadow-sm/--shadow-modal`), transitions, and the **z-index scale**.

**The z-index scale is the single source of truth for stacking** — never invent a new magic number:

```css
--z-base: 1;        /* in-flow positioned content (e.g. .primary-nav) */
--z-banner: 5;      /* the .home-region banner (logo + shortcuts trigger) */
--z-sticky: 10;     /* sticky toolbars / stepper headers */
--z-popover: 40;    /* menus, autocompletes, switchers */
--z-overlay: 100;   /* in-page overlays */
--z-modal: 1000;    /* modal overlays */
--z-skip-link: 1100;/* skip link must beat the modal */
```

Some legacy stylesheets still use raw z-indexes; migrate them to the scale **as you touch them**
(don't sweep unrelated files in an unrelated change).

**CSS Modules for component styles.** New/migrated component styles go in `*.module.css` (CRA-native,
locally scoped — collisions are structurally impossible), imported as `import styles from
'./X.module.css'` and referenced `className={styles.foo}`. The canonical example is the token-driven
button primitive `src/components/ui/Button.jsx` (+ `Button.module.css`) — prefer it over the legacy
global `.button-*` classes. Plain `.css`/`.scss` (non-module) files are **global**: scope their class
names under a component-root to avoid collisions. Migration is incremental — convert a component's
styles to a module only when a phase touches it.

**stylelint** (`npm run lint:css`) enforces tokens on `z-index`/`color`/`background-color` and flags
style debt. It runs at **warn-level** (`defaultSeverity: "warning"` in `.stylelintrc.json`) so it
reports without failing the gate today; a later phase ratchets it to error-level.

> Note: `.npmrc` sets `legacy-peer-deps=true`. This was originally required because react-scripts@5
> pinned `typescript` as an optional peer at `^3||^4` while this project uses `typescript@5`. The
> CRA→Vite migration **removed react-scripts**, so that specific conflict is gone — but the setting is
> **kept for now** (its removal needs a clean `rm -rf node_modules && npm ci` validation for ERESOLVE
> risk; tracked as a follow-up). **Trade-off (still applies while it's on):** `legacy-peer-deps` stops
> npm auto-installing *peer* dependencies tree-wide, so when a dependency relies on a peer you need at
> runtime or in tests (e.g. `@testing-library/dom` for `@testing-library/react`), **declare that peer
> explicitly** in `devDependencies`/`dependencies`.

## Using Playwright (for Claude)

This repo has **two** Playwright surfaces. Use the right one:

| Goal | Tool | Notes |
| --- | --- | --- |
| Interactively drive/inspect the live app during a session (verify a UI change, debug a form, spot-check a11y) | **Playwright MCP** (`browser_*` tools) | Ephemeral. Not a substitute for committed tests. |
| Repeatable regression / a11y / visual tests that run in CI | **`@playwright/test`** suite in `e2e/` | Committed. `npm run test:e2e`. |

**Setup (required once):** browser binaries are not committed — run `npx playwright install chromium`
(covers both the MCP server and the `e2e/` suite). A project [`.mcp.json`](.mcp.json) pins the
Playwright MCP server so any clone's Claude session has it.

**MCP best practices (modern, accessibility-tree-first):**

- Prefer `browser_snapshot` (the accessibility tree, ~hundreds of tokens) over
  `browser_take_screenshot` (~thousands) for understanding/asserting page state. Screenshots are for
  visual confirmation only.
- Workflow: `browser_navigate` → `browser_snapshot` → act by `ref` (`browser_click`,
  `browser_fill_form`) → `browser_snapshot` to confirm. Refs are valid only within one snapshot;
  re-snapshot after navigation/DOM changes.
- Drive **localhost only** (`npm run start` → `http://localhost:3000`) or the public deploy — never a
  production/private target. Wait on conditions (snapshots/auto-wait), never `sleep`. Close the
  browser (`browser_close`) when done; MCP artifacts land in `.playwright-mcp/` (gitignored).
- The MCP is for *finding out if it works*; once it does, encode the guarantee as a committed
  `@playwright/test` spec. Automated Axe catches only ~30-40% of WCAG issues — pair with manual review.

For committed accessibility tests, `jest-axe` (jsdom/Vitest lane) and/or `@axe-core/playwright` (e2e
lane) are the recommended additions — see the v3 plan's Phase 9 (`.claude/docs/plans/`).

## Architecture

### Two architectures live in this repo (read this first)

The `modern` branch is mid-migration to a multi-page **workspace** model while the legacy single-page form
is retained as a frozen safety net. Don't mix them (`workspace.*` vs `formData.*`):

- **Legacy** — one flat `formData` object in [App.js](src/App.js) (described below). Frozen safety net.
- **Workspace (v3 — where active work happens)** — an animal / day / configuration model in
  [src/state/useWorkspace.js](src/state/useWorkspace.js); export flows through `mergeDayMetadata`
  ([src/state/workspaceUtils.js](src/state/workspaceUtils.js)) → `encodeYaml`. The phased plans and their
  shared contracts live in [.claude/docs/plans/](.claude/docs/plans/).

  **Bad channels are day-owned in the workspace model.** The animal-level Channel Maps tab is
  wiring/mapping only; a channel is *marked failed per recording day* in the Day Editor ("Failed
  Channels"), stored at `day.deviceOverrides.bad_channels`. A new day **carries forward** the prior
  same-`configurationVersion` day's marks (a probe reconfiguration resets them — different versions are
  never compared). Marks are **monotonic**: un-marking a channel that was bad on an earlier same-config
  day prompts an in-context confirm and records an off-export acknowledgment in
  `day.state.badChannelRemovalAcks`; an unacknowledged regression **blocks export**
  (`bad_channel_unfailed_without_ack`). The export merge reads bad channels from the day override ONLY —
  the **exported YAML shape is unchanged** (`bad_channels` still on the ntrode rows); only the app's
  internal ownership moved from the config snapshot down to the day. See
  [src/domain/badChannelMonotonicity.js](src/domain/badChannelMonotonicity.js).

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

### Persistence & schema migration

The workspace slice is persisted to localStorage as `{ schemaVersion, workspace }`
([src/state/persistence.js](src/state/persistence.js)). Old blobs are upgraded **forward** by an
ordered registry of pure migrators in [src/state/workspaceMigrations.js](src/state/workspaceMigrations.js)
(`migrators[n]: vN → vN+1`, applied by `migrateWorkspace` before device-normalize / shape-ensure),
not discarded. `MIGRATABLE_SCHEMA_VERSIONS` is **derived** from the registry — never hand-edited.

**Rule — bump `WORKSPACE_SCHEMA_VERSION` ONLY together with:** (1) a registered migrator from the
previous version, and (2) a checked-in `vN` blob fixture
([src/state/__tests__/fixtures/persistence/](src/state/__tests__/fixtures/persistence/)) whose test
proves `load(vN-blob)` hydrates to the current shape with no discard and no data loss. Migrators are
total and non-destructive (a field one can't map forward is preserved or surfaced via the
`recovered`/`discarded` notice path, never silently dropped).

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

## Regression Prevention Protocol

**CRITICAL:** This application generates YAML files that represent irreplaceable scientific data. Regressions in YAML output can corrupt experiments. We use **golden baseline tests** to prevent unintended changes.

### Golden Baseline Tests

Location: [src/__tests__/baselines/golden-yaml.baseline.test.js](src/__tests__/baselines/golden-yaml.baseline.test.js)

**Purpose:** Ensure YAML export is deterministic and byte-for-byte identical across code changes.

**Coverage:**
- 18 comprehensive tests
- 4 golden fixture files (sample, minimal, realistic, probe-reconfig)
- Tests: deterministic export, round-trip consistency, format stability, edge cases

### How Golden Baseline Tests Work

```javascript
// 1. Read golden fixture (known-good YAML file)
const golden = readGoldenFixture('20230622_sample_metadata.yml');

// 2. Parse YAML to JavaScript object
const parsed = YAML.parse(golden);

// 3. Re-export using our YAML encoder
const reexported = encodeYaml(parsed);

// 4. Compare byte-for-byte (MUST be identical)
expect(reexported).toBe(golden);
```

**What This Catches:**
- Unintended formatting changes (indentation, line endings, key order)
- Data type changes (string → number, null → undefined)
- Precision loss in numeric values
- Encoding changes (UTF-8, special characters)
- Library version changes that affect output

### When Golden Baseline Tests Fail

**🚨 DO NOT ignore golden baseline test failures!**

If `golden-yaml.baseline.test.js` tests fail:

1. **Investigate the cause:**
   ```bash
   npm test -- src/__tests__/baselines/golden-yaml.baseline.test.js --run
   ```

2. **Review the diff carefully:**
   - Is the change intentional? (e.g., fixing a bug, upgrading YAML library)
   - Does it affect data integrity?
   - Will it break existing YAML files?

3. **If the change is INTENTIONAL and SAFE:**
   ```bash
   # Regenerate golden fixtures
   node src/__tests__/fixtures/golden/generate-golden.js

   # Review the diff BEFORE committing
   git diff src/__tests__/fixtures/golden/

   # Run tests again to verify
   npm test -- src/__tests__/baselines/golden-yaml.baseline.test.js --run
   ```

4. **Document the change:**
   - Update CHANGELOG.md with breaking change notice
   - Add migration guide if needed
   - Coordinate with trodes_to_nwb team if format changed

5. **Test integration:**
   ```bash
   # Generate test YAML from app
   # Load into trodes_to_nwb and verify conversion succeeds
   cd /Users/edeno/Documents/GitHub/trodes_to_nwb
   python -c "from trodes_to_nwb.convert import create_nwbs; create_nwbs('test_data')"
   ```

### When to Regenerate Golden Fixtures

**ONLY regenerate when:**
- ✅ Fixing a known data corruption bug
- ✅ Upgrading YAML library for security/compatibility
- ✅ Adding new required fields to schema
- ✅ Intentionally changing output format (with team approval)

**NEVER regenerate because:**
- ❌ Tests are "annoying" or "in the way"
- ❌ You don't understand why they're failing
- ❌ You want to "make CI green quickly"
- ❌ The diff looks "small" or "harmless"

### Golden Fixture Files

Located in: [src/__tests__/fixtures/golden/](src/__tests__/fixtures/golden/)

1. **20230622_sample_metadata.yml** (16 KB)
   - Complete session with optogenetics, cameras, tasks, electrode groups
   - Most comprehensive fixture for testing complex structures

2. **minimal-valid.yml** (260 bytes)
   - Minimal valid NWB metadata (required fields only)
   - Tests baseline validation

3. **realistic-session.yml** (5 KB)
   - Typical recording session without optogenetics
   - Tests common use case

4. **20230622_sample_metadataProbeReconfig.yml** (4 KB)
   - Session with probe reconfiguration
   - Tests electrode group changes

### Test Coverage

Run the suites for current counts — don't hard-code totals here (they drift every PR):

```bash
npx vitest run                 # full suite
npx vitest run baselines       # golden baselines (the data-corruption safety net; 4 fixtures)
npx vitest run src/validation  # a single module
```

**Key suites:**

- **YAML I/O** ([src/io/](src/io/)) — `encodeYaml` / `decodeYaml` / `formatDeterministicFilename` / `downloadYamlFile`.
- **Validation** ([src/validation/](src/validation/)) — AJV schema + business rules + integration.
- **Golden Baselines** — deterministic, byte-identical export over the 4 golden fixtures (see "Golden Baseline Tests" above).

### Adding New Tests

When adding features:

- Test form state updates with complex nested structures
- Validate electrode group & ntrode map synchronization
- Test import of YAML files with various validation scenarios
- Verify dynamic dependencies (cameras, epochs, dio events) update correctly
- **Integration Testing**: Generate YAML and test with trodes_to_nwb to ensure end-to-end compatibility

### Continuous Integration

All tests run on every commit via GitHub Actions:

```yaml
# .github/workflows/test.yml
- Run schema version check
- Run full test suite (npx vitest run)
- Golden baseline tests MUST pass
- Fail CI if any test fails
```

**Golden baseline tests are NOT optional.** They are the safety net that prevents data corruption.
