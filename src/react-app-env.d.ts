/// <reference types="react-scripts" />

// react-scripts' bundled types declare CSS Modules (`*.module.css` / `*.module.scss`) and
// asset imports, but NOT bare side-effect stylesheet imports. Declare those so a `.tsx`
// component's `import './X.css'` / `import './X.scss'` type-checks (the value is unused —
// the import is purely for its CSS side effect, bundled by webpack).
declare module '*.css';
declare module '*.scss';
