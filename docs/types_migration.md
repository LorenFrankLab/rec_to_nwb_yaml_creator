# Type System Migration Strategy

**Status:** Approved
**Last Updated:** October 27, 2025
**Milestone:** M0.5

---

## Overview

This document defines the type system migration strategy for the rec_to_nwb_yaml_creator project. The goal is to introduce type safety incrementally without disrupting ongoing development or requiring a full TypeScript migration.

## Rationale

**Why JSDoc First?**

1. **Zero Build Configuration** - No need to add TypeScript compilation, maintain dual `.js/.ts` files, or modify build tooling
2. **Incremental Adoption** - Types can be added module-by-module as code is refactored
3. **IDE Support** - Modern editors (VS Code, WebStorm) provide full IntelliSense and type checking for JSDoc
4. **Reversibility** - Comments can be refined or removed without breaking builds
5. **Team Familiarity** - Developers already know JavaScript; JSDoc is a natural extension
6. **Scientific Infrastructure** - Minimizes risk by avoiding major build system changes

**Why Not TypeScript Immediately?**

- The codebase is currently 100% JavaScript with no `.ts` files
- A full TypeScript migration would require:
  - Renaming all files (`.js` → `.ts`, `.jsx` → `.tsx`)
  - Configuring TypeScript compiler settings
  - Fixing all type errors before code runs (high risk for critical infrastructure)
  - Learning TypeScript syntax for all contributors
- TypeScript can still be adopted later once the architecture stabilizes (see Phase 2)

---

## Migration Phases

### Phase 1: JSDoc Type Annotations (Current)

**Goal:** Achieve **70% function-level type coverage** on exported functions and critical utilities

**Implementation:**

1. **Add JSDoc comments to all new code**
   - All exported functions must have `@param` and `@returns` annotations
   - Complex data structures should use `@typedef` for reusable types
   - Internal/private functions should have types when clarity improves

2. **Enable type checking in development**
   - Configure `jsconfig.json` with `checkJs: true` (warning mode initially)
   - Add ESLint rules to encourage JSDoc (see ESLint Configuration section)

3. **Refactor existing code incrementally**
   - When touching existing modules, add JSDoc to modified functions
   - Prioritize validation, YAML export, and state management utilities

4. **Document type coverage goal**
   - Target: 70% of exported functions have complete JSDoc annotations
   - Measure via ESLint plugin or manual code review
   - Track progress in SCRATCHPAD.md during refactoring

**Timeline:** M0.5 → M12 (continuous)

---

### Phase 2: Optional TypeScript Migration (Future)

**Goal:** Evaluate TypeScript adoption after core refactor stabilizes

**Decision Point:** After M7 (when modularization is stable)

**Options:**

1. **Continue with JSDoc** - If type coverage and IDE support meet team needs
2. **Adopt TypeScript** - If stronger guarantees are needed (e.g., for public API)

**If adopting TypeScript:**

- Use `ts-migrate` tool for automated `.js` → `.ts` conversion
- Configure `tsconfig.json` with strict mode
- Fix type errors module-by-module (non-blocking)
- Maintain backward compatibility with existing JavaScript modules

**Timeline:** M13+ (after feature flag cleanup)

---

## JSDoc Examples

### Basic Function Types

```javascript
/**
 * Converts form data to YAML string
 * @param {object} formData - The form data object
 * @returns {string} YAML-formatted string
 */
export function toYaml(formData) {
  return YAML.stringify(formData);
}
```

### Complex Parameter Types

```javascript
/**
 * Validates data against NWB schema
 * @param {unknown} data - Data to validate
 * @returns {{ok: boolean, errors: ValidationIssue[]}} Validation result
 */
export function validateSchema(data) {
  // ...
}
```

### Type Definitions

```javascript
/**
 * @typedef {object} ValidationIssue
 * @property {string} path - JSON path to error
 * @property {'error'|'warning'} severity - Issue severity
 * @property {string} message - Human-readable message
 */

/**
 * @typedef {object} AnimalMetadata
 * @property {string} animal_id - Unique animal identifier
 * @property {string} species - Animal species
 * @property {string} [date_of_birth] - ISO date string (optional)
 */
```

### Array and Generic Types

```javascript
/**
 * Filters tasks by epoch
 * @param {Array<Task>} tasks - Task array
 * @param {string} epoch - Epoch identifier
 * @returns {Array<Task>} Filtered tasks
 */
export function filterTasksByEpoch(tasks, epoch) {
  return tasks.filter(t => t.epoch === epoch);
}
```

### Callback Types

```javascript
/**
 * Processes each electrode group
 * @param {Array<ElectrodeGroup>} groups - Electrode groups
 * @param {(group: ElectrodeGroup, index: number) => void} callback - Processor function
 * @returns {void}
 */
export function processElectrodeGroups(groups, callback) {
  groups.forEach(callback);
}
```

---

## Coverage Goal

**Target:** 70% of exported functions have complete JSDoc type annotations

**Measurement:**

- Use `eslint-plugin-jsdoc` with `require-jsdoc` and `require-param` rules
- Review coverage in quarterly code audits
- Track new module coverage in PR reviews

**Priority Modules:**

1. **Validation utilities** (`src/validation/**`) - 100% coverage (critical for data integrity)
2. **YAML export** (`src/utils/yamlExport.js`) - 100% coverage (critical output)
3. **Schema validation** (`src/utils/schemaValidator.js`) - 100% coverage (data safety)
4. **State management** (`src/state/**`) - 80% coverage (complex data flow)
5. **Form components** (`src/element/**`) - 50% coverage (UI, less critical)

---

## ESLint Configuration

### Add JSDoc Plugin

**Install:**

```bash
npm install --save-dev eslint-plugin-jsdoc
```

**Configure `.eslintrc.js`:**

```javascript
module.exports = {
  extends: "react-app",
  plugins: ["jsdoc"],
  rules: {
    // Existing rules...
    "import/no-extraneous-dependencies": "off",
    "import/no-unresolved": "error",
    "react/react-in-jsx-scope": "off",

    // JSDoc rules (warnings initially, errors in Phase 2)
    "jsdoc/require-jsdoc": ["warn", {
      "require": {
        "FunctionDeclaration": true,
        "MethodDefinition": false,
        "ClassDeclaration": false,
        "ArrowFunctionExpression": false,
        "FunctionExpression": false
      },
      "contexts": [
        "ExportNamedDeclaration > FunctionDeclaration",
        "ExportDefaultDeclaration > FunctionDeclaration"
      ]
    }],
    "jsdoc/require-param": "warn",
    "jsdoc/require-param-type": "warn",
    "jsdoc/require-returns": "warn",
    "jsdoc/require-returns-type": "warn",
    "jsdoc/check-types": "warn",
    "jsdoc/check-param-names": "error",
    "jsdoc/valid-types": "error"
  }
};
```

### Add jsconfig.json

**Create `jsconfig.json` in project root:**

```json
{
  "compilerOptions": {
    "checkJs": false,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "target": "ES2020",
    "module": "esnext",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "build", "dist"]
}
```

**Note:** `checkJs: false` initially to avoid overwhelming warnings. Enable to `true` in Phase 2.

---

## Integration with CI

### ESLint Check in GitHub Actions

Update `.github/workflows/test.yml`:

```yaml
- name: Lint code
  run: npm run lint
```

(Already present - JSDoc rules will be enforced once configured)

### Type Coverage Report (Optional)

Future enhancement: Add type coverage reporting tool

```bash
npm install --save-dev type-coverage
npm run type-coverage  # Generates coverage report
```

---

## Migration Checklist

### M0.5 Tasks

- [x] Document type strategy in `docs/types_migration.md`
- [ ] Add `eslint-plugin-jsdoc` to `package.json`
- [ ] Update `.eslintrc.js` with JSDoc rules
- [ ] Create `jsconfig.json` with path aliases
- [ ] Test JSDoc rules on sample modules
- [ ] Update PR template to check for JSDoc on new functions

### M1+ Tasks (Continuous)

- [ ] Add JSDoc to `src/utils/yamlExport.js`
- [ ] Add JSDoc to `src/utils/schemaValidator.js`
- [ ] Add JSDoc to `src/validation/**`
- [ ] Add JSDoc to new state management modules
- [ ] Measure coverage quarterly

### Phase 2 Decision Point (M13+)

- [ ] Review JSDoc effectiveness
- [ ] Survey team on TypeScript adoption
- [ ] Evaluate `ts-migrate` tool
- [ ] Decide: Continue JSDoc or migrate to TypeScript

---

## References

- **JSDoc Official Documentation:** https://jsdoc.app/
- **TypeScript JSDoc Support:** https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html
- **eslint-plugin-jsdoc:** https://github.com/gajus/eslint-plugin-jsdoc
- **ts-migrate Tool:** https://github.com/airbnb/ts-migrate

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-10-27 | Choose JSDoc over immediate TypeScript | Minimize risk, incremental adoption, preserve build simplicity |
| 2025-10-27 | Set 70% coverage goal | Balance between safety and pragmatism; prioritize critical paths |
| 2025-10-27 | Defer TypeScript decision to M13+ | Wait for architecture to stabilize before major migration |

---

## Questions & Answers

**Q: Why not use TypeScript from the start?**
A: This is critical scientific infrastructure. A full TypeScript migration introduces build risk and requires all contributors to learn TS syntax. JSDoc provides 80% of the benefits with 20% of the risk.

**Q: Can we mix JSDoc and TypeScript?**
A: Yes! If we adopt TypeScript in Phase 2, `.js` files with JSDoc will work alongside `.ts` files. TypeScript understands JSDoc natively.

**Q: What if JSDoc becomes too verbose?**
A: Focus on exported functions and complex types. Internal helper functions don't need exhaustive documentation. If verbosity becomes a blocker, we can fast-track to TypeScript.

**Q: How do we enforce JSDoc in PRs?**
A: ESLint will warn on missing JSDoc for exported functions. Reviewers should check coverage manually until automated tooling is added.

---

## Approval

This strategy was reviewed and approved as part of **M0.5 – Type System Strategy**.

**Approved by:** Development team
**Date:** October 27, 2025
**Next Review:** After M7 (Phase 2 decision point)
