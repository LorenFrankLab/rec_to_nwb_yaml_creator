Review evidence for [INCREMENTS_1_2_REVIEW.md](../INCREMENTS_1_2_REVIEW.md).

The browser harnesses use disposable Chromium contexts with synthetic metadata. They intentionally inject storage failures and demonstrate current incorrect behavior; they are reproduction scripts, not passing acceptance tests for the desired fixes. No existing browser profile is used. Production source files are not modified.

From the repository root, serve the reviewed checkout on a local-only port:

```sh
CI=true npm start -- --host 127.0.0.1 --port 3012 --strictPort
```

In another terminal, also from the repository root:

```sh
node docs/reviews/2026-09-14/increment-review-evidence/review-browser.cjs
node docs/reviews/2026-09-14/increment-review-evidence/review-extra.cjs
```

`REVIEW_BASE_URL` overrides the default `http://127.0.0.1:3012`. Playwright Chromium must already be installed. Scripts print JSON and also write their results under `/tmp/rec-yaml-review*-evidence.json`.

`snapshot.json` records the reviewed timestamp, base commit, and hashes of the main runtime files discussed. The full-suite summary is from the live-tree run; the focused failure and migration/import logs are from the captured snapshot. The existing-browser-workflow log is the repo's original same-day test running against that snapshot, with one worker and a 15-second test timeout. It fails its five-second editor-heading assertion because the seeded day is missing.

The scanner check also passed using the supplied converter environment:

```sh
/Users/edeno/Documents/GitHub/trodes_to_nwb/.venv/bin/python scripts/check-scanner-grouping.py --rec-dir /Users/edeno/Downloads/trodes_to_nwb_test_data 20230622_sample_metadata.yml
```

It reported the metadata and both sample recordings in group `(20230622, 'sample')`. No full NWB conversion or Spyglass insertion was performed.
