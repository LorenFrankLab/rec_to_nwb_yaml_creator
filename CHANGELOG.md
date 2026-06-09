# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Internal YAML import core (non-UI): a pure reconciliation that turns a set of parsed
  metadata YAML files into an import plan, plus an executor that writes the plan into the
  workspace store.
  - `extractRecordingDate` derives a recording day's ISO date from the
    `{mmddYYYY}_{subject}_metadata.yml` filename (primary) or a `{subject}_{YYYYMMDD}`
    `session_id` (fallback), rejecting invalid calendar dates.
  - `planImport` (pure) decomposes each file, groups files by subject, infers configuration
    versions (distinct electrode configs in date order), resolves animal-level facts with a
    documented default policy, and surfaces every cross-file disagreement as an explicit
    `divergence` flag rather than a silent pick. Conflicts with existing workspace animals are
    flagged (never overwritten silently).
  - `applyImportPlan` writes a plan into the live store via the existing workspace actions,
    supporting per-subject `add` / `skip` / `replace` conflict resolutions, and isolates
    per-animal failures so one failure never aborts the rest.
  - Import round-trip gate: a multi-day / multi-config-version workspace exported per day and
    re-imported through `planImport` → `applyImportPlan` re-exports byte-for-byte identically.
- Extracted the pure identity-divergence helper (`findIdentityDivergence`) into
  `src/state/identityDivergence.js` so both the animal-editor page layer and the state-layer
  import reconciler share one implementation without crossing the page/state boundary.
