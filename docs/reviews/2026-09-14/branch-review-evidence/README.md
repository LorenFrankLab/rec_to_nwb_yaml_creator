Evidence for the branch review at `4d07e9dd`

These checks use synthetic workspace fixtures in disposable Chromium contexts. Run from the repository root with dependencies and the Playwright Chromium browser already installed. Start the app in a separate terminal:

```sh
npm start -- --host 127.0.0.1 --port 3013 --strictPort
```

Run the reproduction scripts individually:

```sh
node docs/reviews/2026-09-14/branch-review-evidence/review-new.cjs
node docs/reviews/2026-09-14/branch-review-evidence/review-identity.cjs
node docs/reviews/2026-09-14/branch-review-evidence/review-previous.cjs
node docs/reviews/2026-09-14/branch-review-evidence/review-extra.cjs
```

Set `REVIEW_BASE_URL` to use another local Vite server. Scripts print JSON and write their original temporary output paths under `/tmp`; the neighboring JSON files preserve this review's results. These are diagnostic reproductions, some of which assert the observed buggy behavior, rather than acceptance tests for a fix. The identity check uses the actual profile editor and confirmation dialog. Domain checks invoke production functions loaded through Vite.

- `new-domain-findings.json`: effective-date confirmation, source-description overwrite, renamed identity lookup, and day/animal optogenetics disagreement.
- `subject-id-collision.json`: distinct animals pass validation with identical subject IDs and export filenames.
- `persistence-and-copy.json`: reader editing, failed-save handover, recovery durability, duplicated setup, folder carry, and migrated weight.
- `backup-migration-recovery.json`: missing restored receipt YAML, migrated-weight validation, and stale revision after corruption recovery.
- `verification.txt`: typecheck, full unit-test summary, and the ten selected existing browser tests.

No converter, NWB Inspector, or Spyglass ingestion run is included in this review's verification. See `../BRANCH_REVIEW.md` for findings and code references.
