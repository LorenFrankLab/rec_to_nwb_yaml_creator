# End-to-End QA Runbook (Playwright)

**Purpose:** How to run, debug, and triage the browser end-to-end suite for this app — in
particular the **workspace** regression suite that is the QA pass's green core. Read this before a
QA run so the known pre-existing legacy-spec status doesn't surprise you.

This app is scientific infrastructure (see the root `CLAUDE.md`). The e2e suite is the browser-level
gate; it is **not** the downstream NWB/Spyglass gate — see "Deferred downstream round-trip" at the end.

---

## One-time setup

```bash
npx playwright install chromium     # browser binaries are NOT committed
```

The dev server is started automatically by the config's `webServer` block:

- **Locally** (`reuseExistingServer: true`): if `http://localhost:3000` is already running
  (`npm run start`), the suite reuses it; otherwise it launches `npm start` for the run.
- **In CI** (`CI=1` → `reuseExistingServer: false`): Playwright spawns its own server, so do NOT
  have a server already bound to port 3000 when running with `CI=1` locally (it will refuse with
  "http://localhost:3000 is already used").

Chromium is the only enabled project (Firefox/WebKit are commented out in `playwright.config.js`).

---

## Running the suite

```bash
npm run test:e2e                    # full suite, Chromium (what CI runs)
npm run test:e2e:ui                 # interactive UI mode (pick/inspect/replay individual tests)

# Just the workspace regression suite (the green core):
npx playwright test e2e/workspace-*.spec.js --project=chromium --reporter=line

# A single spec, or a single test by line:
npx playwright test e2e/workspace-export.spec.js --project=chromium --reporter=line
npx playwright test e2e/workspace-export.spec.js:NN --project=chromium

# Headed / step-through while debugging:
npx playwright test e2e/workspace-export.spec.js --project=chromium --headed --debug
```

`--reporter=line` is the most readable for a triage run; the config also emits the HTML and JSON
reporters (see Artifacts).

### CI vs local selection

CI sets `CI=1`, which makes the config `testIgnore` `**/visual-regression.spec.js`. So the
visual-regression baseline spec runs **locally only**; everything else runs in both. To preview
exactly which tests CI selects:

```bash
CI=1 npx playwright test --project=chromium --list
```

---

## What each workspace spec covers

The workspace specs (`e2e/workspace-*.spec.js`, all GREEN on Chromium) drive the **shipped tabbed
workspace** (`#/animal/:id/:tab`, `#/day/:id`) — not the frozen legacy single-page form.

| Spec | Covers |
| --- | --- |
| `workspace-harness.smoke.spec.js` | Smoke-tests the shared harness helpers against the real app so the other specs can rely on them. |
| `workspace-export.spec.js` | The real browser download path: per-day Day Editor Export step and the per-animal Validation & Export tab produce valid YAML. |
| `workspace-export-gate.spec.js` | Fail-closed export gate — an invalid day cannot reach/use Download from any route; repair navigation works. |
| `workspace-workflows.spec.js` | Scenario tests from the neuroscientist's goal: same-day export and catch-up batch export (unready days excluded). |
| `workspace-mistake-prevention.spec.js` | Mistake-prevention UX on the highest-risk edit surfaces (naming-identity / stale-reference corruption guards). |
| `workspace-ownership.spec.js` | Ownership/discoverability + nav-focus-guard lifecycle on the tabbed Animal View; live re-render + focus moves to panel on tab change. |
| `workspace-lifecycle.spec.js` | Animal/day create + switch, destructive delete confirms, and post-delete cleanup coherence. |
| `workspace-persistence.spec.js` | Data-loss guard: creating an animal autosaves to localStorage and survives a full reload. |
| `workspace-persistence-recovery.spec.js` | Harder persistence/recovery paths, save-failure state + unsaved-work guard, and YAML import via the file picker. |
| `workspace-optogenetics.spec.js` | Two-layer opto model end to end (animal implant sections + day FsGUI protocol); all-or-nothing opto gating. |
| `workspace-responsive-a11y.spec.js` | Responsive + a11y smoke at desktop (1280×720) and narrow (390×844): nav reachable, modal focus trap/restore, validation + export reachable. |

**Shared harness — `e2e/helpers/workspace.js`:** deterministic helpers the specs import to
clear/prime the persisted store, seed complex workspace state through localStorage when the UI path
would be slow/flaky, and open `<details>` disclosures before asserting. Centralizing these keeps the
specs short and stable; change them here, not per-spec.

---

## Failure artifacts — where they land and how to open them

Per-run outputs are written to (and are **git-ignored**, regenerated each run, uploaded by CI as
build artifacts):

- `playwright-report/` — the HTML report (all tests, with embedded screenshots/traces).
- `test-results/` — per-failing-test folders with `test-failed-*.png` screenshots, `error-context.md`,
  and traces; plus `results.json` (the JSON reporter) and `.last-run.json`.
- Downloaded-YAML captures from export tests are read via `download.path()` into the test's temp dir
  during the run; assertions parse them in-test (not persisted as a committed artifact).

Config retention: `screenshot: 'only-on-failure'` and `trace: 'retain-on-failure'` — a trace is kept
for any failing attempt (locally `retries: 0`, so `retain-on-failure` is what actually captures the
first/only failure; passing runs keep no trace).

Open them:

```bash
npx playwright show-report                         # opens playwright-report/ in a browser
npx playwright show-trace test-results/<...>/trace.zip   # interactive trace viewer (DOM, network, console, timeline)
```

---

## Pre-existing legacy-spec status (triage — read before a run)

The legacy specs in `e2e/baselines/` drive the **frozen legacy single-page form** (`page.goto('/')`,
`input[type="file"]` import), not the workspace. Their status as of this QA pass:

- **`baselines/form-interaction.spec.js`** — GREEN.
- **`baselines/import-export.spec.js`** — GREEN (fixed during this QA pass). It had been failing on
  `modern` independently of the workspace work: `AlertModal` was refactored onto the shared `Modal`
  primitive, so the import-success modal's overlay class changed from `.alert-modal-overlay` to
  `.modal-overlay` (+ an explicit `.alert-modal-close` button). The spec's `dismissAlertModal` helper
  still waited on the old class, silently timed out, and left the modal intercepting the
  Download/section-link clicks. The fix updates only the helper's dismissal selectors (low-risk, no
  app-behavior change) — keeping legacy coverage green.
- **`baselines/visual-regression.spec.js`** — **local-only (CI-ignored via `testIgnore`).** Its
  pixel snapshots in `e2e/baselines/visual-regression.spec.js-snapshots/` are **stale** because the
  workspace UI overhaul intentionally changed the rendered form; its snapshot tests fail
  `expect(page).toHaveScreenshot()` locally. **Do NOT regenerate the snapshots blindly** — snapshots
  are a reviewed artifact. When the UI change is intentional and reviewed, update them deliberately
  with:

  ```bash
  npx playwright test e2e/baselines/visual-regression.spec.js --project=chromium --update-snapshots
  git diff e2e/baselines/visual-regression.spec.js-snapshots/   # review every changed PNG before committing
  ```

**Triage rule:** the workspace suite (`e2e/workspace-*.spec.js`) must be 100% green. The only
expected failures in a full local run are the visual-regression snapshot mismatches above, which
CI does not run. Anything else is a real regression.

---

## Findings surfaced by the QA pass — dispositions

The QA pass surfaced several app-UX issues beyond the browser coverage. Each was triaged and either
**fixed** (with a test), **corrected** (the finding was overstated — the disposition records the
verified reality), or **annotated**. None blocked the workspace suite.

- **FIXED — silent data-loss bug (import file picker).** Workspace YAML import via the **file picker**
  did nothing in a real browser: `ImportYamlDialog.onInputChange` cleared `e.target.value` before
  awaiting `handleFiles`, emptying the live `FileList`. Fixed by snapshotting
  `Array.from(e.target.files ?? [])` before the clear; pinned by the file-picker test in
  `workspace-persistence-recovery.spec.js`. (Drag-drop was never affected.)
- **FIXED — optogenetics section-nav count honesty** (`src/pages/AnimalView/index.jsx`,
  `src/domain/sectionStatus.js`). *Correction to the original framing:* the section-nav already
  signals an incomplete-but-started opto config with a red ● and accessible name
  "Optogenetics — blocks export" (the blocking dot is computed from the export validator, and the
  `partial_configuration` rule attributes to the `optogenetics` tab — verified). The only defect was
  the **decorative count** still reading `'used'` next to the ●. Now derived from a new
  `getAnimalOptoCompleteness` helper (same four-field definition as the export rule): **complete →
  `used`**, **partial → `incomplete`** (agrees with the ●), **none → the hollow-○ "not set up" path**.
  Pinned by `AnimalView.optoCount.test.jsx` + `sectionStatus.test.js`.
- **FIXED — import preview remediation hints.** Each un-importable file now shows, alongside the raw
  reason, a plain-language "what to fix" hint derived from the validator's reason string: a missing
  required property → "Add the missing field(s): `data_acq_device`[, …].", otherwise a generic "Open
  this file and correct the reported problem before re-importing." (the plan's reason string carries
  no instancePath, so the hint does not claim a field path). Presentation-only (the parser is
  untouched); pinned by `ImportYamlDialog.test.jsx`.
- **FIXED — import result names created identities.** The result phase now lists, per created animal,
  its id and the day dates added (regrouped from `createdDays`) instead of counts only. Pinned by
  `ImportYamlDialog.test.jsx`.
- **FIXED (kept as a latent safety net + pinned) — `handleNavClick` discard guard.** Confirmed
  unreachable in the shipped UI: all three setup editors that report `pendingEdits`
  (electrode-groups, channel-maps via `ChannelMapEditor`, cameras) are focus-trapping shared
  `Modal`s whose overlay intercepts the nav click. The guard is correct, intentional safety code for
  a **future inline (non-modal)** setup editor, so it was **not removed**; instead a clarifying
  comment was added and the decision was extracted to a pure `shouldInterceptNavDiscard` + pinned by
  `AnimalView.navDiscardGuard.test.jsx` (intercept-and-confirm; "Keep editing" cancels, "Discard
  changes" proceeds).
- **CORRECTED — first-run "Set up this animal" card "Needs fixing" state.** Not dead code: the setup
  card renders when `!(subjectPresent && dayCount > 0)`, so it shows for an animal that has recording
  days **but a missing/empty subject** (a recovery/corruption state) — and in exactly that case
  `getAnimalBlockingSections` (day-derived) can be non-empty, so "Needs fixing" **is** reachable and
  correct. The common new-animal path (subject present, no days) cannot have a day-derived export
  blocker, so it correctly shows "To do"/"Set up", not "Needs fixing". No code change; the original
  "unreachable" finding was overstated.
- **ANNOTATED — legacy `e2e/baselines/` anti-pattern island.** `import-export.spec.js` /
  `form-interaction.spec.js` use `if (isVisible)`-then-skip bodies, fixed `waitForTimeout` sleeps,
  CSS-class selectors, and leftover `console.log` — the opposite of the workspace-suite discipline.
  They are pre-existing legacy coverage for the frozen single-page form. Each now carries a header
  banner marking it **frozen legacy coverage, not a pattern reference**; a full rewrite/quarantine
  remains a dedicated legacy-lane cleanup (out of this QA pass's scope).

---

## Optional: cross-browser / manual screenshot review

Firefox and WebKit projects are commented out in `playwright.config.js`. To do a one-off
cross-browser pass, uncomment them and run `npx playwright test`. This is **not** part of the
committed CI gate (Chromium-only, for snapshot/runtime determinism). Automated Axe checks (and the
a11y assertions in `workspace-responsive-a11y.spec.js`) catch only ~30–40% of WCAG issues — pair a
release-grade pass with manual keyboard + screen-reader review.

---

## Deferred downstream round-trip (NOT part of this browser QA)

This suite validates the **app in the browser**. It does **not** run the real downstream pipeline.
Before a production cutover, the YAML this app exports must additionally clear the downstream gate —
a separate, deferred step:

```
trodes_to_nwb (convert) → nwbinspector --config dandi (zero CRITICAL) → dandi validate (exit 0) → Spyglass ingest
```

Downstream validation is mostly **silent** (logs, doesn't raise), so this app + this suite are the
real gate for app-side correctness; the NWB itself must be validated separately. See
[`docs/PIPELINE_REQUIREMENTS.md`](PIPELINE_REQUIREMENTS.md) for the field-by-field requirements and
the exact commands/method to re-verify when trodes_to_nwb / DANDI / Spyglass change.
