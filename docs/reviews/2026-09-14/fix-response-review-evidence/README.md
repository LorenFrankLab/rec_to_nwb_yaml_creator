Evidence for the fix-response review at `51bc3430`

These scripts use synthetic workspaces in disposable Chromium contexts against the local Vite app. They invoke production modules and actual UI actions; they do not modify application source. Run from the repository root with the existing dependencies and Playwright Chromium installed.

Start the app in a separate terminal:

```sh
CI=true npm start -- --host 127.0.0.1 --port 3013 --strictPort
```

Run the diagnostic checks individually:

```sh
node docs/reviews/2026-09-14/fix-response-review-evidence/review-persistence.cjs
node docs/reviews/2026-09-14/fix-response-review-evidence/review-export-freshness.cjs
```

`REVIEW_BASE_URL` optionally overrides the local address. The scripts print results and write their original output paths under `/tmp`; neighboring JSON files preserve the reviewed revision's results. Their assertions reproduce observed failures, not desired acceptance behavior.

The delayed-storage helper holds IndexedDB transaction completion callbacks until explicitly released. The underlying transaction can finish; the app has not yet received its acknowledgement. This makes the interleaving of asynchronous continuations and user edits deterministic without editing the app.

- `persistence-and-domain.json`: newly saved animal removed by pending recovery; restore writes after handover; restore overwrites an unpreserved original; setup interval disagreement; non-durable receipt restoration.
- `export-freshness.json`: a 485 g download incorrectly shown as current after a saved correction to 499 g, including distinct content hashes and reload persistence.
- `playwright.config.cjs`: configuration used for the 23 existing browser tests, with local absolute paths and output under `/tmp`.
- `verification.txt`: current typecheck, full unit-suite summary, and selected browser-test output.

See [the report](../FIX_RESPONSE_REVIEW.md) for priorities, source references, fixes, and limits of verification.
