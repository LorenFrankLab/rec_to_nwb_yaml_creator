Evidence for the revision review at `5906074f`

Run from the repository root with project dependencies and Playwright Chromium installed. The scripts use synthetic workspaces in isolated Chromium contexts against the local Vite app, without modifying application source.

Start the app in a separate terminal:

```sh
CI=true npm start -- --host 127.0.0.1 --port 3013 --strictPort
```

Run individually:

```sh
node docs/reviews/2026-09-14/revision-4-review-evidence/review-finalization.cjs
node docs/reviews/2026-09-14/revision-4-review-evidence/verify-previous-restores.cjs
```

`REVIEW_BASE_URL` optionally overrides the local address. Scripts print results and write their original temporary paths under `/tmp`; neighboring JSON files preserve the reviewed revision's results. The finalization harness asserts observed failures. The earlier-restore harness verifies cancellation and reports memory, storage, artifact hashes, and comparison text after a failed main workspace write.

- `finalization-failures.json`: a failed revision-marker write leaves contradictory tabs; failed promotion discards its durable staging copy; cancellation cleanup deletes the retry's shared staging key.
- `previous-restore-results.json`: the earlier cancellation and main-write-failure cases now preserve the expected state and YAML.
- `playwright.config.cjs`: the configuration used for the 25 existing browser tests, with local absolute paths.
- `verification.txt`: typecheck, full unit-suite summary, and selected browser-test output.

The metadata failure rejects only the localStorage `.meta` write. The promotion failure rejects only the active receipt's IndexedDB write, allowing staging. The retry reproduction holds staging transaction completion callbacks and releases them in the specified order; it injects no storage failures.

See [the review](../REVISION_4_REVIEW.md) for source references, priorities, fixes, and verification limits.
