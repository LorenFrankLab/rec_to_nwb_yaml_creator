Evidence for the revision review at `3c4458a2`

Run from the repository root with project dependencies and Playwright Chromium installed. All scripts use synthetic workspaces in isolated browser contexts and the local Vite app. Application source is unchanged.

Start the local app in a separate terminal:

```sh
CI=true npm start -- --host 127.0.0.1 --port 3013 --strictPort
```

Run individually:

```sh
node docs/reviews/2026-09-14/revision-3-review-evidence/review-restore.cjs
node docs/reviews/2026-09-14/revision-3-review-evidence/verify-export-fix.cjs
node docs/reviews/2026-09-14/revision-3-review-evidence/verify-preservation-fix.cjs
```

`REVIEW_BASE_URL` optionally overrides the local address. Results print to stdout and the original temporary paths under `/tmp`; neighboring JSON files preserve this review's observations. The restore harness asserts observed bugs. The other two scripts assert the intended fixed behavior.

Delayed cases hold IndexedDB transaction completion callbacks until explicitly released; the app has not yet received acknowledgement while the UI actions proceed. The failure case rejects only localStorage writes to the workspace key, leaving reads and IndexedDB operational.

- `restore-failures.json`: Cancel followed by a saved edit is overwritten; failed restore changes memory and the active receipt artifact despite its refusal message.
- `export-fix.json`: the previous false-current result now remains changed after acknowledgement and reload.
- `preservation-fix.json`: the original is protected while pending, and the newly entered animal survives reload.
- `playwright.config.cjs`: configuration used for the 24 existing browser tests, with local absolute paths.
- `verification.txt`: current typecheck, full unit-suite summary, and selected browser-test output.

See [the review](../REVISION_3_REVIEW.md) for code references, priorities, fixes, and verification limits.
