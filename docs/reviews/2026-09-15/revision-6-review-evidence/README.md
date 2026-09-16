Evidence for `REVISION_6_REVIEW.md`, reviewed at `036b9591`.

- `verify-cleanup.cjs`: isolated Chromium diagnostic with mixed immutable/reusable artifact keys. Delays cleanup, downloads again through the UI, releases cleanup, reloads, builds a backup, and checks the comparison UI. Asserts the intended behavior.
- `cleanup-result.json`: observed passing diagnostic result.
- `playwright.config.cjs`: configuration for the three existing workspace browser specs; local paths reflect this review machine.
- `verification.txt`: typecheck, full unit-suite summary, changed-file ESLint output, browser-suite output, and exit statuses.

Run from the repository root with the installed project dependencies and Chromium binary. Start Vite locally:

```sh
npx vite --host 127.0.0.1 --port 3013 --strictPort
```

In another shell at the repository root:

```sh
node docs/reviews/2026-09-15/revision-6-review-evidence/verify-cleanup.cjs
npx playwright test --config=docs/reviews/2026-09-15/revision-6-review-evidence/playwright.config.cjs
```

The diagnostic uses a disposable browser context and synthetic fixture workspace. It writes its result to `/tmp/revision6-cleanup.json`. `REVIEW_BASE_URL` can override the diagnostic's default origin; adjust the Playwright configuration separately if needed.
