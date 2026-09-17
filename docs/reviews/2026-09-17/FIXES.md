# Legacy capability audit: fixes and verification

Date: 2026-09-17. Follow-up to [the scientist workflow audit](LEGACY_CAPABILITY_PARITY_REVIEW.md), implemented on `modern` after `6907de8e`.

## Completed changes

| Finding | Result for the scientist |
| --- | --- |
| C1: Files stranded by epoch deletion | The confirmation offers **Keep files unassigned** or **Remove affected files**. Kept files appear in an automatically opened manager with an epoch selector and removal action. Both statescripts and videos are repairable. Removal affects metadata entries; files on disk remain. Undo restores the epoch and its file entries. Export errors identify the file. |
| C2: Statescripts disappear during editing | **Manage files & add supplemental files** exposes every retained associated file and video. It does not filter rows according to the text being edited. Multiple statescripts for one epoch remain reachable. The quick epoch editor links to name, epoch, and removal controls, and correctly calls its path action **Override path**. |
| C3: Partial units lost | Partial units are saved and survive navigation and reload. Export requires both units when either is present; clearing both omits the optional block. Repair links open and focus the correct technical input, including behavioral-event units. |
| C4: Custom DIO Add click lost | Guidance sits below the add controls. A custom name no longer introduces a warning that moves the Add button during its click. |
| C5: DIO mapping overwritten | Add starts at and advances to an unused index, including wraparound after 32. An occupied index disables Add and identifies the existing mapping. A full direction is explained, and switching Din/Dout selects an unused line in that direction. Existing rows remain directly editable. |
| C6: Required file fields marked optional | Name, description, path, and epoch are marked required for each added file. Incomplete rows explain what must be supplied before export, including a path readable by the conversion computer. The collection itself remains optional. |
| C7: Sex O unavailable | Creation and profile correction offer **Other (O)**. Modern and legacy options share the same catalog, including the corrected spelling of Other. Imported O survives profile review and export. |
| C8: Misleading header-path help | The legacy YAML field remains editable. Help explains that setting it does not configure the converter; a replacement header must also be supplied through the converter’s `header_reconfig_path` argument. |

The epoch grid remains the routine entry surface. The full manager is a disclosure, opens for unassigned files and repair requests, and stays open while a row is edited. File controls use the available width on narrow screens.

Verification also found and fixed a related lost-click problem: the save indicator can briefly disappear between committing a field and writing storage. The day header now reserves that line’s height, keeping **Review & export** in place while the last incomplete field is committed.

## Verification

- The final full unit suite passed **5,691/5,691 tests** across 392 files, including two new DIO boundary tests and creation, profile and day-frame coverage.
- The browser suite from the audit, expanded with eight regressions, passed **67/67**. The final file-layout and units-repair adjustments also passed all eight targeted browser regressions. [Full browser results](fix-evidence/browser-regressions.txt), [final targeted results](fix-evidence/file-and-entry-regressions.txt).
- Tests exercise deletion with reassignment or removal, Undo, repair-link focus, a second statescript while typing and after reload, complete YAML downloads, partial units and clearing an existing pair, first-pointer-click DIO addition at desktop/mobile widths, occupied-index protection, and Other sex in creation/profile/export.
- TypeScript, ESLint with zero warnings, and production build pass. CSS lint passes with no errors; its 205 existing warnings concern other styles and legacy token usage.
- File-manager checks at 1440px and 390px report no horizontal overflow, browser errors, or WCAG A/AA axe violations. [Desktop](fix-evidence/fixed-file-manager-desktop.png), [mobile](fix-evidence/fixed-file-manager-mobile.png).

## Actual conversion

The updated UI loaded the audit’s sample recording, restored its original unit labels, renamed the first statescript through Manage files, and downloaded [this YAML](fix-evidence/20230622_sample_metadata.yml). That downloaded file was passed unchanged to the local `trodes_to_nwb` checkout with the supplied sample recording files.

Conversion produced an NWB file containing 128 electrodes, 32 electrode groups, two recording epochs, two videos, and both nonempty statescript contents. The renamed statescript appears under its new name. PyNWB schema validation reported no errors. With the referenced videos linked beside the NWB file, the DANDI-configured NWB Inspector reported **53 best-practice suggestions and no critical findings or best-practice violations**. [Validation and content summary](fix-evidence/nwb-validation.json).

The new conversion artifacts are under `/tmp/app-parity-fixes-conversion/`. The original sample files and consumer repositories were not modified.

## Acceptance boundary

C1–C8 and the obsolete browser expectations are resolved. This verifies the repaired editing paths and a real non-optogenetics conversion. It does not establish end-to-end acceptance of every experiment: a complete optogenetics raw-recording conversion, representative Spyglass database ingestion, and DANDI CLI/archive validation still need separate verification. No database insertion or archive upload was performed.
