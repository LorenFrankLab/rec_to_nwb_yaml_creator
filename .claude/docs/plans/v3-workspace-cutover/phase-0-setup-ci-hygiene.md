# Phase 0 — Setup & CI hygiene (behavior-preserving)

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

This phase precedes all feature work. Its goal: a fresh contributor on a machine **without a Node
version manager** can clone, install, test, and build the project, and the `modern` development
branch receives CI feedback. It also clears one real (non-transitive) security advisory. No
application behavior changes — golden-baseline YAML output stays byte-identical.

**Inputs to read first:**

- [README.md](../../../../README.md) — currently documents only `npm run start` and `npm run deploy`; no Requirements / install / test section. Task 1 expands it.
- [docs/ENVIRONMENT_SETUP.md](../../../../docs/ENVIRONMENT_SETUP.md) — setup doc; the "For Humans (Manual)" block (lines 47–66) and Troubleshooting (lines 111–142) assume `nvm` is installed. Task 2 adds a no-version-manager fallback.
- [.nvmrc](../../../../.nvmrc) — pins Node `20.19.5`. The version every doc and CI step must agree on.
- [package.json](../../../../package.json) — scripts (lines 60–76): `start`, `build` (`react-scripts build`), `test` (`vitest`), `test:baseline` (`vitest run baselines`), `deploy`, `lint` (`eslint --fix …`). Dependency `yaml: "^2.2.2"` (line 58).
- [.github/workflows/test.yml](../../../../.github/workflows/test.yml) — triggers only on `main` (lines 3–7); `node-version-file: '.nvmrc'` (lines 25, 68, 154); build step uses `CI=false npm run build` with a stale TODO referencing wrong line numbers and a "Phase 3 / issue TBD" note (lines 160–166).
- [src/__tests__/baselines/golden-yaml.baseline.test.js](../../../../src/__tests__/baselines/golden-yaml.baseline.test.js) — the byte-identical YAML parity gate; the blocking check after the `yaml` bump.

**Contracts referenced:**

- [YAML parity / shadow-export contract](shared-contracts.md#yaml-parity--shadow-export-contract) — golden baselines MUST stay byte-identical after the `yaml` dependency bump. A parity change is a **blocker**, not a fixture-regeneration event.

## Tasks

### 1. README.md — add Requirements / Setup / Test / Build section

Insert a new section (after Introduction, before or merged with "Running Locally") that covers the
full contributor workflow. README currently only mentions `npm run start` and `npm run deploy`.

Add, in plain commands:

- **Requirements:** Node `20.19.5` (the version pinned in [`.nvmrc`](../../../../.nvmrc)). State that
  other Node majors are untested (see Task 2 note).
- **Install:** `npm ci` (reproducible install from `package-lock.json`; preferred over `npm install`
  for a clean clone).
- **Run dev server:** `npm start`.
- **Test:** `npm test` (Vitest watch mode) and `npx vitest run` (single CI-style run); mention
  `npm run test:baseline` for the golden-YAML parity suite.
- **Build:** `npm run build`.
- **Deploy:** `npm run deploy` (preserve the existing warning that the `gh-pages` branch must not be
  deleted).
- A link to [docs/ENVIRONMENT_SETUP.md](../../../../docs/ENVIRONMENT_SETUP.md) for environment detail.

Keep the existing Introduction and the live-app link. Do not invent scripts that aren't in
`package.json`.

### 2. docs/ENVIRONMENT_SETUP.md — add a "no version manager available" fallback

The current manual instructions (lines 47–66) and Troubleshooting (lines 111–142) assume `nvm`. Many
machines (and the current dev machine: Homebrew Node, no nvm) won't have it. Add a subsection under
"Setup Instructions" (and a Troubleshooting entry) describing fallback paths to obtain Node `20.19.5`
without nvm, for example:

- Homebrew: `brew install node@20`, then put `node@20` on `PATH` (`brew link --overwrite node@20` or
  the `$(brew --prefix node@20)/bin` export Homebrew prints).
- `corepack`/`volta` as alternatives (mention only as options; do not add them as project deps).
- Explicitly state: **other Node majors are untested.** The pinned version is `20.19.5`; newer
  majors may install and pass locally but are not the supported/CI version.

Do not remove the existing nvm instructions — add alongside them. This is a docs-only change.

### 3. .github/workflows/test.yml — run CI on the `modern` branch

Add `modern` to the push and pull_request branch filters so the long-lived development branch gets CI
feedback before a PR is opened. Currently (lines 3–7):

```yaml
on:
  push:
    branches: [main]  # Only run on pushes to main
  pull_request:
    branches: [main]  # Run on all PRs to main
```

Change to include `modern` (the active dev branch convention):

```yaml
on:
  push:
    branches: [main, modern]
  pull_request:
    branches: [main, modern]
```

No other workflow structure changes in this task. Verify the `node-version-file: '.nvmrc'` usages
(lines 25, 68, 154) remain — they already pin Node correctly.

### 4. CI build workaround — keep `CI=false`, replace the stale TODO with a tracked decision note

`react-scripts build` (Create React App) treats ESLint warnings as errors when `CI=true`. A
`CI=true npm run build` currently **fails to compile** with **79 warnings across 36 files**, dominated
by jsdoc rules (`jsdoc/require-returns-type` ×37, `jsdoc/require-returns` ×19, `jsdoc/require-param-type`
×13), plus 6 `no-unused-vars` and 2 `react-hooks/exhaustive-deps`. The existing TODO comment (test.yml
lines 161–165) is stale: it cites only "App.js lines 119, 122…" and "ArrayUpdateMenu.jsx line 13",
references a non-existent "Phase 3" and an "issue TBD", and undercounts the problem.

**Decision for this phase:** the warning set is too broad to clear here without editing ~36 files —
and two of them are `react-hooks/exhaustive-deps` in `src/state/store.js`, store logic reserved for a
later refactor phase (see overview). Clearing all of them is explicitly **out of scope** (overview
Non-Goals; "Deliberately not in this phase" below). So **keep `CI=false`** for now, but replace the
misleading TODO with an accurate, tracked decision note. Update the comment above the build step
(lines 161–165) to state:

- `CI=false` is intentional and required: CRA treats ESLint warnings as build errors under `CI=true`.
- Current cause: ~79 ESLint warnings (mostly missing-JSDoc-type rules) surface during build across
  ~36 files; clearing them is deferred to dedicated lint-cleanup work, not done here.
- Do not "fix" this by deleting `CI=false` until the warning set is zero; do not suppress the rules
  globally.

Do not reference plan/phase/milestone names in the committed comment — describe the decision in
codebase terms (e.g. "deferred to a dedicated lint-cleanup pass") rather than "Phase N". If a GitHub
issue exists or is opened to track the lint cleanup, link it; otherwise state plainly that it is
tracked as known debt rather than leaving a bare `TBD`.

### 5. Bump `yaml` to clear GHSA-48c2-rrv3-qjmp — BLOCKING parity check

`npm audit` flags the moderate advisory **GHSA-48c2-rrv3-qjmp** (stack overflow via deeply nested YAML
collections). The advisory range for v2 is `>=2.0.0 <2.8.3`. The app's direct `yaml` dependency
resolves to `2.8.1` today (deduped) — **still in range, still vulnerable.** The patched version
`2.8.3` is available and is within the existing `^2.2.2` semver constraint, so no `package.json`
range edit is required.

Steps:

1. Bump the resolved version: `npm install yaml@^2.8.3` (or `npm update yaml`), which updates
   `package-lock.json`. Confirm with `npm ls yaml` that the app's direct `yaml` resolves to `>=2.8.3`.
2. Confirm the advisory is cleared for the **direct** dependency:
   `npm audit --json` should no longer list `yaml` under the app's own (non-react-scripts) tree. The
   `yaml@1.10.2` instances pulled in transitively by `react-scripts` (cssnano, cosmiconfig) remain and
   are handled in Task 6.
3. **BLOCKING parity check:** run `npx vitest run baselines` (equivalently `npm run test:baseline`).
   All golden-YAML baseline tests in
   [src/__tests__/baselines/golden-yaml.baseline.test.js](../../../../src/__tests__/baselines/golden-yaml.baseline.test.js)
   MUST pass with byte-identical output for all 4 fixtures. **A parity change is a blocker** per the
   [YAML parity contract](shared-contracts.md#yaml-parity--shadow-export-contract) — do **not**
   regenerate the golden fixtures to make a diff pass. If output changes, stop and investigate the
   `yaml` serialization difference before proceeding.
4. Also run the full suite (`npx vitest run`) to confirm no other YAML-dependent test regressed.

### 6. Document accepted react-scripts transitive vulnerabilities

`npm audit` reports a large number of vulnerabilities (the majority transitive through
`react-scripts@5.0.1` — webpack-dev-server, postcss, the `yaml@1.10.2` chain, etc.). `npm audit fix
--force` would attempt to downgrade/replace `react-scripts` and **break the build** (overview
dependency policy). These are dev-time/build-time transitive issues, not runtime-shipped to users.

Record them as **accepted known debt** in the CHANGELOG note (Task 7) and/or a short note in
[docs/ENVIRONMENT_SETUP.md](../../../../docs/ENVIRONMENT_SETUP.md): state that the remaining audit
findings are react-scripts transitive dependencies, that `npm audit fix --force` is forbidden because
it breaks `react-scripts`, and that the long-term remediation (CRA replacement / toolchain migration)
is out of scope here. Do not run `npm audit fix --force`.

### 7. Add a changelog entry

The repo's changelog is [docs/REFACTOR_CHANGELOG.md](../../../../docs/REFACTOR_CHANGELOG.md) (there is
**no root `CHANGELOG.md`**; CLAUDE.md's "CHANGELOG.md" references the existing file). **Use that file —
do not create a second changelog.** All phases in this plan write to `docs/REFACTOR_CHANGELOG.md`. Add
an entry for this work documenting:

- Security: bumped `yaml` to `>=2.8.3` to resolve GHSA-48c2-rrv3-qjmp (golden YAML baselines verified
  byte-identical).
- CI: `modern` branch now runs the test workflow.
- Docs: README setup/test/build section added; ENVIRONMENT_SETUP.md gained a no-version-manager
  fallback.
- Known debt: remaining `npm audit` findings are react-scripts transitive deps, accepted (no
  `audit fix --force`); CRA `CI=false` build workaround retained with a tracked note.

Write the entry in user/operator terms; do not name plan phases in the file.

## Deliberately not in this phase

- **Clearing the 171 lint warnings** (79 of which break the `CI=true` build). Touching ~36 files —
  including `react-hooks/exhaustive-deps` in `src/state/store.js` — is out of scope; the store is
  decomposed in a later phase. We keep `CI=false` and document the decision instead (Task 4).
- **Upgrading or replacing `react-scripts` / CRA → Vite migration.** This is what would let us drop
  `CI=false` and clear most transitive audit findings, but it is a large, separate effort.
- **`npm audit fix --force`** — forbidden; it breaks `react-scripts` (Task 6).
- **Any application behavior change**, schema change, or YAML-format change. This phase is
  behavior-preserving; the only code-adjacent change is a patch-level `yaml` bump validated against
  golden baselines.
- **Editing `package.json`'s `yaml` semver range** — `2.8.3` is already within `^2.2.2`; only the
  lockfile resolution changes.

## Validation slice

| Test | Asserts |
| --- | --- |
| `npm ci` from a clean clone (no `node_modules`) | Installs successfully from `package-lock.json` on Node `20.19.5`; exits 0. |
| `npm ls yaml` after Task 5 | App's direct `yaml` dependency resolves to `>=2.8.3`. |
| `npx vitest run baselines` (`golden-yaml.baseline.test.js`) | All 4 golden fixtures encode/round-trip **byte-identical** after the `yaml` bump (BLOCKING). |
| `npx vitest run` (full suite) | Entire suite green; no YAML-dependent regression (baseline today: 2747 passed / 1 skipped per overview). |
| `npm run build` (i.e. `CI=false react-scripts build`) | Production build succeeds and emits `build/`. |
| `npm run lint` | Exits 0 (171 warnings, 0 errors — unchanged; we are not clearing warnings here). |
| `.github/workflows/test.yml` trigger | Workflow runs on push/PR to `modern` (verified by the branch appearing in `on.push.branches` / `on.pull_request.branches` and by a CI run on the next `modern` push). |

These are integration/CI checks rather than unit tests; no new test files are added in this phase.

## Fixtures

None beyond the existing golden fixtures in `src/__tests__/fixtures/golden/` (sample, minimal,
realistic, probe-reconfig). They are used **read-only** as the parity gate after the `yaml` bump and
must not be regenerated.

## Review

Follow the full gate in [review-protocol.md](review-protocol.md). Phase-specific:

- **Self-verify (§1):** run this phase's Validation slice + `npx vitest run` (no regressions; baseline 2747/1 skipped) + `npx vitest run baselines` (byte-identical). Emphasis for this phase: `npm ci` is clean, `npm run build` succeeds, the golden baselines still pass byte-for-byte *after* the `yaml` bump (fixtures **not** regenerated), and CI runs on `modern`.
- **Playwright UI (§2):** Not applicable (no rendered UI change).
- **Reviewers:** `pr-review-toolkit:code-reviewer` (only).
- **Checklist (§6):** every task implemented; "Deliberately not in this phase" honored; tests non-trivial; no plan/phase strings in code/test names/docstrings; old code flagged for removal is removed (stale `test.yml` TODO replaced, not left alongside the new note); user-facing docs (README/CHANGELOG) updated.
