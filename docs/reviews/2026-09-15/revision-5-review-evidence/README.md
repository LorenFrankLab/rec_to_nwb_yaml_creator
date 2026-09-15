Evidence for the revision review at `5fa83f98`

Run from the repository root with project dependencies and Playwright Chromium installed. The scripts use synthetic workspaces in isolated Chromium contexts against the local Vite app. Application source is unchanged.

Start the app in a separate terminal:

```sh
CI=true npm start -- --host 127.0.0.1 --port 3013 --strictPort
```

Run individually:

```sh
node docs/reviews/2026-09-15/revision-5-review-evidence/review-cleanup.cjs
node docs/reviews/2026-09-15/revision-5-review-evidence/verify-retry-and-backup.cjs
```

`REVIEW_BASE_URL` optionally overrides the local address. Scripts print results and write their original output paths under `/tmp`; neighboring JSON files preserve the reviewed revision's results.

- `cleanup-failure.json`: a new download has an acknowledged, matching YAML artifact; delayed cleanup from the preceding restore deletes it; after reload, comparison is unavailable. The harness asserts the observed bug.
- `retry-and-backup.json`: cancelled-attempt cleanup leaves the retry's unique artifact intact; reload, portable backup, and a subsequent comparison all succeed. The harness asserts the intended behavior.
- `playwright.config.cjs`: the configuration used for the 26 existing browser tests, with local absolute paths.
- `verification.txt`: typecheck, full unit-suite summary, browser tests, and whitespace check.

Both scripts control IndexedDB completion callbacks to reproduce asynchronous ordering. Neither injects a storage failure. See [the review](../REVISION_5_REVIEW.md) for source references, priority, the minimal fix, and verification limits.
