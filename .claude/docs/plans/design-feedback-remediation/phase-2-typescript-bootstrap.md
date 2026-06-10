# Phase 2 — TypeScript bootstrap + type the pure I/O core

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Stand up the TypeScript toolchain so `.ts`/`.js` coexist, add a `tsc --noEmit` CI gate, and type the
lowest-churn, highest-leverage modules first: the YAML codec and the workspace type definitions. **The first
task is non-negotiable: the test runner does not currently transform `.ts`,** so converting any file without
fixing that first breaks the entire suite. No runtime behavior changes — this is scaffolding for Phases 8–9.

**Inputs to read first:**

- [vitest.config.js](../../../vitest.config.js) — **read carefully.** It has a custom `esbuild: { loader: 'jsx', include: /src\/.*\.jsx?$/ }` block and `test.include: ['src/**/*.{test,spec}.{js,jsx}']`. The `include` regex matches `.jsx?` only, so `.ts` type annotations are never stripped → a `.ts` import fails to parse. **This must be fixed before any conversion.**
- [package.json:60-75](../../../package.json) — scripts + deps; CRA `react-scripts@5` compiles TS via Babel (so the production build does **not** type-check — only `tsc --noEmit` does); `typescript` is **not** a direct dep.
- [jsconfig.json](../../../jsconfig.json) — `checkJs:false`, `resolveJsonModule:true`, `moduleResolution:node`, `target:ES2020`, `module:esnext`, `baseUrl`, `paths` `@/*`→`src/*`, `exclude`. **Every option must be carried into `tsconfig.json`** (esp. `resolveJsonModule` — `validation/schemaValidation.js` does `import nwb_schema.json`).
- `src/io/yaml.js` — exports `encodeYaml` (`:37`), `decodeYaml` (`:81`), `formatDeterministicFilename` (`:107`), `downloadYamlFile` (`:127`, DOM: `document.createElement`/Blob/anchor), and aliases `convertObjectToYAMLString` (`:146`), `createYAMLFile` (`:152`). **All six** get typed under `strict`.
- `src/state/workspaceTypes.js` — JSDoc `typedef`s to convert to interfaces.
- `src/__tests__/fixtures/golden/generate-golden.js` — imports `io/yaml` with an **explicit `.js` extension** (breaks on rename). Real yaml unit tests: `src/__tests__/unit/io/yaml-decodeYaml.test.js`, `yaml-formatDeterministicFilename.test.js`, and `src/io/__tests__/yaml-memory-leak.test.js` (there is **no** `src/io/__tests__/yaml.test.js`).
- `.github/workflows/test.yml` — add the typecheck step; `.eslintrc.js` + `package.json` `"lint"` (currently `--ext .js,.jsx`).

**Contracts referenced:**

- [C1 — YAML byte-identity](shared-contracts.md#c1) — typing `io/yaml` must not change output; baselines byte-identical.

## Tasks

- **(First) Fix the test transform.** Amend `vitest.config.js` so `.ts`/`.tsx` are transformed: widen the `esbuild.include` to `/src\/.*\.(jsx?|tsx?)$/` with a per-extension loader so `.ts` does **not** get the `jsx` loader (or drop the custom `esbuild` block and let `@vitejs/plugin-react` defaults handle it), and add `ts,tsx` to `test.include`. Verify the existing `.jsx`-with-JSX files still parse and `npx vitest run` is green **before** converting anything.
- Add dev deps: `typescript` (5.x), `@types/react`, `@types/react-dom`, `@types/node`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`. Commit `package-lock.json`.
- Add `tsconfig.json` carrying **all** `jsconfig.json` options (`resolveJsonModule`, `moduleResolution`, `target`, `module`, `baseUrl`, `paths`, `include`, `exclude`) **plus**: `"allowJs": true`, `"checkJs": false`, `"strict": true`, `"jsx": "react-jsx"`, `"noEmit": true`, `"esModuleInterop": true`, `"skipLibCheck": true`, `"forceConsistentCasingInFileNames": true`, `"lib": ["DOM", "DOM.Iterable", "ES2020"]` (the DOM lib is needed by `downloadYamlFile`). Delete `jsconfig.json`.
- Scripts/CI: add `"typecheck": "tsc --noEmit"`; add a typecheck CI step to `test.yml` (parallel, fast). Extend `"lint"` to `--ext .js,.jsx,.ts,.tsx` and configure `.eslintrc.js` to use `@typescript-eslint/parser` for `.ts`/`.tsx` (so converted files are still linted).
- Convert `src/io/yaml.js` → `src/io/yaml.ts`: type **all six exports** including the DOM-touching `downloadYamlFile` and the alias re-exports (`encodeYaml(value: unknown): string`, `decodeYaml(text: string): unknown`, etc.). No logic change. Update `generate-golden.js`'s explicit `'../../../io/yaml.js'` import to extension-less; grep for any other explicit-`.js` importer of `io/yaml` and fix.
- Convert `src/state/workspaceTypes.js` → `src/state/workspaceTypes.ts`: JSDoc `typedef`s → `export interface`/`export type` (`Workspace`, `Animal`, `Day`, `SubjectMetadata`, `ConfigurationSnapshot`, `DeviceOverrides`, …). Keep any runtime exports identical.
- Documentation: a "TypeScript" note in `CLAUDE.md` — `.ts`/`.js` coexist via `allowJs`; the **build (Babel) does not type-check, only `npm run typecheck` does**; type pure modules first. CHANGELOG entry.

## Deliberately not in this phase

- Typing `domain/`, `validation/`, the `state/` hooks, or any component — [Phase 9](phase-9-architecture-cleanup.md) and the ongoing ratchet.
- Enabling `checkJs:true` or strict JS null-checks — `.ts` only for now.
- Any `.jsx`→`.tsx` component conversion.

## Validation slice

| Test | Asserts |
| --- | --- |
| `npx vitest run` (after the config fix, before conversions) | green — `.jsx` still parse; `.ts` now transforms (add a throwaway `.ts` probe import to confirm, then remove it). |
| `npm run typecheck` | `tsc --noEmit` exits 0 over the new `.ts` files. |
| `src/__tests__/unit/io/yaml-decodeYaml.test.js`, `yaml-formatDeterministicFilename.test.js`, `src/io/__tests__/yaml-memory-leak.test.js` | pass unchanged against `yaml.ts`. |
| `npx vitest run baselines` | byte-identical — `yaml.ts` behavior unchanged (C1); `generate-golden.js` still imports correctly. |
| `npm run lint` | runs over `.ts`/`.tsx` without parser errors. |
| CI | typecheck step present and passing. |

## Fixtures

None new.

## Review

Before opening the PR, dispatch `code-reviewer` against the diff. Confirm:
- `vitest.config.js` transforms `.ts`/`.tsx` and the full suite is green **before** conversions (the prerequisite).
- `tsconfig.json` carries every `jsconfig` option (esp. `resolveJsonModule`); `jsconfig.json` removed; lint covers `.ts`.
- `io/yaml.ts` types all six exports with no logic change; `generate-golden.js` (and any other explicit-`.js`) importer fixed; baselines byte-identical.
- CLAUDE.md notes the build doesn't type-check; CHANGELOG updated; names don't reference this plan.
