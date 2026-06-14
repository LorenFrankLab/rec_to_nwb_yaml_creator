# CRA → Vite migration plan

**Goal:** replace `react-scripts` (Create React App, deprecated Feb 2025) with **Vite** as the
build/dev tool, keeping the app a **client-side SPA** with **zero behavior change**. Preserve
hash-ish routing, all tests, the one env var, asset/base paths, GitHub Pages deploy, and the
ESLint-warnings-as-errors gate.

**Non-goals:** no SSR/RSC framework, no routing/data-loading rewrite, no feature work, no CSS
refactor, no legacy-form changes (that is a separate, product-gated decision — see
[Sequencing](#sequencing-note)). This is purely a toolchain swap.

## Why Vite, why not a framework
This app is a static, local-first workflow tool: hash routing (`useHashRouter`), `localStorage`-first
state, a static GitHub Pages deploy (`homepage: …github.io/rec_to_nwb_yaml_creator/`). SSR/RSC would
be a pointless rewrite. Vite gives modern ESM tooling, faster dev/build, cleaner TS integration, and
removes the deprecated CRA dependency. Per React's own guidance
(<https://react.dev/blog/2025/02/14/sunsetting-create-react-app>), migrate existing apps to a build
tool like Vite.

**Key tailwind:** the repo is *already half on Vite*. `vitest@4` is installed and pulls
`vite@7.1.12` transitively; [`vitest.config.js`](../../../../vitest.config.js) is a real Vite config
(`@vitejs/plugin-react`, an `esbuild` JSX-in-any-extension loader, `resolve.alias`). Today there are
**two** toolchains — react-scripts for build/dev/deploy, Vite for tests. This migration **collapses
them to one** `vite.config.ts`. The hardest part (JSX/TS transform) is already solved in the test lane
and gets lifted into the shared config.

## Verified repo surface (what the migration must carry)
| Concern | Today (CRA) | Vite target |
| --- | --- | --- |
| Base path | `homepage` field → CRA derives it | `base: '/rec_to_nwb_yaml_creator/'` |
| Build output | `build/` (CI uploads `build/`; `deploy: gh-pages -d build`) | set `build.outDir: 'build'` (keep `build/` so deploy + CI artifact path are unchanged) |
| Dev port | `3000` (react-scripts) | `server.port: 3000` + `preview.port: 3000` (keeps `playwright.config` `localhost:3000` + the kill-stale-:3000 workflow) |
| Env vars | `process.env.NODE_ENV === 'development'` — **one** site, [`ErrorBoundary.tsx:115`](../../../../src/components/ErrorBoundary.tsx#L115) | `import.meta.env.DEV` |
| Prod detection | `isProduction()` = runtime `window.location.hostname` ([`utils.ts:95`](../../../../src/utils.ts#L95)) | **no change** (build-tool-agnostic) |
| `index.html` | `public/index.html` with `%PUBLIC_URL%` (og:image, favicon) | move to **repo root**, add `<script type="module" src="/src/index.tsx">`, base-relative asset paths |
| Type shims | `react-app-env.d.ts` → `/// <reference types="react-scripts" />` | → `vite/client`; keep the `*.css`/`*.scss` + `jest-axe` `declare module`s |
| JSX in `.js` | CRA Babel | already handled in `vitest.config` via `esbuild.loader: 'tsx'` + `optimizeDeps` — lift into the shared config (or moot if legacy is deleted first) |
| Path alias | `@/*` omitted from tsconfig (CRA forbids `compilerOptions.paths`); only `resolve.alias` for tests | Vite allows it — optionally re-add `paths` to `tsconfig.json` so `@/*` type-resolves in tsc/editor too |
| Browserslist | `package.json` `browserslist` (CRA uses it) | Vite ignores it by default (esbuild `build.target`); becomes vestigial unless `@vitejs/plugin-legacy` is added (not needed for a modern-browser lab tool) |

## The one gate that must NOT silently regress — ESLint warnings-as-errors
The migration's biggest trap. CI ([`test.yml`](../../../../.github/workflows/test.yml)) already runs
`npm run lint`, `npm run typecheck`, and the build as **separate jobs**, so Vite (whose build skips
ESLint) does **not** lose CI linting outright. BUT the **`build` job** currently runs
`CI=true npm run build`, and its comment is explicit: *"CI=true ARMS the build gate … Create React App
treats ESLint warnings as build errors."* Most `eslint-config-react-app` rules are `warn`-level, so
**today the build job is the warnings-as-errors gate.** `vite build` will not enforce that.

**Mitigation (do this in the same PR that swaps the build):** make the CI lint step strict —
`eslint --max-warnings 0`. **Caveat on scope:** CRA's `CI=true build` only lints files in the **build
graph** (reachable from the entry). `eslint . --max-warnings 0` lints **everything** (tests, legacy,
unreachable files) and will surface warnings CRA never gated. Decide deliberately: either (a) scope the
strict lint to `src` excluding tests/legacy to match the old surface, or (b) accept the broader set and
fix/triage it. Capture whichever in the PR description — do not let the gate quietly weaken.

## Phases (each ends with the full gate)
Per-phase verification gate (the project standard): `npm run typecheck` · `npx vitest run baselines` ·
`npx vitest run` (full) · the production build · `CI=true npm run test:e2e` (kill stale `:3000` first) ·
a manual `vite preview` smoke confirming the **base path** resolves (`/rec_to_nwb_yaml_creator/`).

### Phase 0 — Pre-flight (no behavior change)
- Promote `vite` + `@vitejs/plugin-react` to explicit `devDependencies` (currently transitive via vitest).
- Snapshot a CRA production build (`build/` file list + `index.html`) as the comparison baseline.
- Branch off `modern` (e.g. `vite-phase-0`…); merge `--no-ff`, do not push (session workflow).

### Phase 1 — Add `vite.config.ts` (build + test in ONE config)
- Create `vite.config.ts` using `defineConfig` from `vitest/config` (so the `test` block stays typed):
  carry over `plugins: [react()]`, the `esbuild`/`optimizeDeps` JSX loader, `resolve.alias`
  (`@`/`@tests`/`@fixtures`), and **add** `base`, `build.outDir: 'build'`, `server.port: 3000`,
  `preview.port: 3000`. Merge the entire `test` block from `vitest.config.js`.
- Move `public/index.html` → repo-root `index.html`; add the module `<script>`, swap `%PUBLIC_URL%`.
- Verify `npx vitest run` still passes against the merged config (tests must be byte-stable) **before**
  touching the build scripts. Keep `react-scripts` installed this phase (parallel, for comparison).

### Phase 2 — Swap dev/build scripts
- `start: vite`, `build: vite build`, `preview: vite preview` (keep `predeploy: npm run build`,
  `deploy: gh-pages -d build`). Fix `ErrorBoundary.tsx` env var → `import.meta.env.DEV`. Update
  `react-app-env.d.ts` → `vite/client`.
- Verify: `vite build` produces `build/` with correct base-prefixed asset URLs; diff against the
  Phase-0 CRA snapshot (expect equivalent app behavior, different hashed filenames). `vite preview`
  smoke at `:3000` + a Playwright run.

### Phase 3 — CI + deploy
- `test.yml` `build` job: `CI=true npm run build` → `npm run build` (`vite build`).
- Preserve warnings-as-errors: lint job → `eslint --max-warnings 0` (scope per the gate caveat above).
- Confirm the e2e job's `webServer: npm start` still serves `:3000` (now Vite). `deploy`/artifact paths
  unchanged (still `build/`). Run the full CI matrix on a branch.

### Phase 4 — Remove CRA + cleanup
- Uninstall `react-scripts` and CRA-only deps (babel preset, etc.). Delete `vitest.config.js` (merged
  into `vite.config.ts`). Remove the `eject` script.
- Re-evaluate `.npmrc legacy-peer-deps=true`: it exists *because* react-scripts pins `typescript ^3||^4`
  as an optional peer. With CRA gone the conflict may be gone — try removing it, but **carefully**
  (CLAUDE.md notes peers like `@testing-library/dom` were declared explicitly *because* of it; verify
  `npm ci` + the full gate still pass before dropping it).
- Optional: re-add `@/*` to `tsconfig.json` `paths` (now allowed) so the alias type-resolves in
  tsc/editor, not just tests. Decide browserslist fate (delete, or wire `build.target`).

## Sequencing note (legacy form)
Deleting the legacy single-page form **before** this migration would remove most of Vite's hard parts
at once (the JSX-in-`.js` loader trick, the `prop-types` dep, ~2000 LOC, `legacy-peer-deps` pressure).
The TS migration proved the boundary is clean — the **only** live→legacy import is
`layouts/AppLayout.tsx → pages/LegacyFormView.jsx`. But legacy deletion is a **product** decision (is
the v3 workspace ready to drop the fallback route?), not a technical one, so it is intentionally NOT a
step here. If that decision is made, do it first and several Phase-1/Phase-4 items simplify or vanish.

## Risk register
- **Silent ESLint-gate weakening** (highest) — mitigation above.
- **Base-path regression** → blank GitHub Pages deploy. Mitigation: `vite preview` base smoke each phase + a post-deploy check.
- **`index.html`/asset-path drift** (favicon, og:image, logo import). Mitigation: diff against Phase-0 snapshot.
- **Test-config drift** when merging vitest into vite.config. Mitigation: run the full 4793-test suite + golden baselines immediately after Phase 1, before any build-script change.
- **Coverage `include`/`exclude` paths** reference `src/index.tsx`, `src/reportWebVitals.js` — keep them valid in the merged config.

## Rollback
Each phase is a `--no-ff` merge on its own branch; revert the merge. `react-scripts` stays installed
through Phase 3, so Phases 1–3 are reversible by restoring the scripts. Phase 4 (CRA removal) is the
point of no return — only after Phases 1–3 are green in CI.

## Definition of done
`vite build` deploys an identical-behaving app to GitHub Pages at the correct base path; one
`vite.config.ts` serves both build and tests; CI enforces typecheck + ESLint (warnings-as-errors) +
4793 tests + golden baselines + 104 e2e; `react-scripts` is gone from `package.json`.
