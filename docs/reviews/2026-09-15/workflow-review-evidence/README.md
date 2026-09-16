# Workflow review evidence

Review target: `036b9591`, September 15, 2026. No application source modifications.

## Reproduce

Run the repository's development server on an unused port:

```sh
CI=true npm start -- --host 127.0.0.1 --port 3017 --strictPort
node docs/reviews/2026-09-15/workflow-review-evidence/corpus.cjs
node docs/reviews/2026-09-15/workflow-review-evidence/walkthrough.cjs
node docs/reviews/2026-09-15/workflow-review-evidence/domain-audit.cjs
node docs/reviews/2026-09-15/workflow-review-evidence/interactions.cjs
npx playwright test --config docs/reviews/2026-09-15/workflow-review-evidence/playwright.config.cjs
```

The corpus/import diagnostics require the user-provided directories under `/Users/edeno/Downloads`. Browser diagnostics use isolated contexts and local dev-module imports. They do not modify those input directories or the user's normal browser profile. `walkthrough.cjs` supplies `seed.json`; `domain-audit.cjs` supplies `synthetic-inputs.json` and `import-survey.json` for `interactions.cjs`.

## Contents and interpretation

- Numbered PNGs and text files: actual rendered screens. The populated baseline uses `buildCatalogWorkspace` with the animal's current electrode mirror aligned to its configuration snapshot. File paths/observations in that fixture are synthetic. The real-file repair screenshot is explicitly named in the report.
- `screens.json`: viewport dimensions and axe findings after finishing active animations. Camera contrast warnings from an earlier unstabilized pass were eliminated and are not retained as findings. The separate settled camera check in `interactions.json` agrees.
- `interactions.json`: draft rejection, actual batch-import preview/commit, keyboard behavior, task-edit effect on historical metadata, modal contents, and copy identity results.
- `domain-findings.json`: pure app import/reconciliation and merge observations. Synthetic source models differ only in the stated calibration/date context. Imported days still need the usual configuration/video confirmations; the result demonstrates calibration loss, not a completed NWB conversion.
- `corpus.json`: strict parse failures and byte-deduplicated variation analysis. `nonSessionFiles` is the script's exclusion counter for files without `subject.subject_id`; it does not establish that these are non-metadata files. Grouping uses exact subject IDs, not verified biological identities. No frequency is a confirmed rate of experimental change or user error.
- `import-survey.json` / `import-survey-summary.json`: individual-file checks for all 325 YAMLs in the supplementary collection. Repair and source-edit counts overlap. Readiness precedes batch reconciliation and subsequent day-review requirements.
- `task-environments.json`: raw same-subject/same-task environment disagreements and multi-camera task-row count. These may include corrections or stale naming; they are not independently verified experiment histories.
- `recording-headers.json`: bounded XML-header observations, not conversion results.
- `verification.txt`: summarized command outcomes and existing browser-test output.

The exploratory scripts were corrected for selectors, fixture assembly, animation settling, and the validation-call signature during the review. The retained outputs are from their corrected successful runs. These were diagnostic corrections, not application fixes.
