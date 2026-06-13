/**
 * @fileoverview Compatibility barrel for the form-default + catalog values.
 *
 * The legacy ~1100-LOC `valueList.js` was split (Phase 9 TS migration) into focused, typed
 * modules — {@link module:defaults}, {@link module:deviceCatalog}, {@link module:subjectCatalog},
 * {@link module:locations}, {@link module:dioCatalog}, {@link module:optoCatalog}. This barrel
 * re-exports their public surface VERBATIM so the many existing `from '.../valueList'` importers
 * keep working unchanged; the underlying values are byte-identical to the pre-split module.
 */

export * from './defaults';
export * from './deviceCatalog';
export * from './subjectCatalog';
export * from './locations';
export * from './dioCatalog';
export * from './optoCatalog';
