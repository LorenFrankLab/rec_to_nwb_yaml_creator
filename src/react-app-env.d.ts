/// <reference types="react-scripts" />

// react-scripts' bundled types declare CSS Modules (`*.module.css` / `*.module.scss`) and
// asset imports, but NOT bare side-effect stylesheet imports. Declare those so a `.tsx`
// component's `import './X.css'` / `import './X.scss'` type-checks (the value is unused —
// the import is purely for its CSS side effect, bundled by webpack).
declare module '*.css';
declare module '*.scss';

// jest-axe ships no type declarations and there is no @types/jest-axe, so a `.ts` test-setup
// file importing it (setupTests.ts → `toHaveNoViolations`) would fail TS7016. Declare it as an
// untyped module; the a11y matcher is exercised by tests, not type-checked.
declare module 'jest-axe';
