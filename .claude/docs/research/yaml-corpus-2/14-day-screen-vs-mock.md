# Day screen vs. finalized mockup — visual diagnosis

Live app: `http://localhost:3000` (this repo's Vite dev server). Diagnosed against the
finalized mockup `.claude/docs/plans/scope-tiers-ia/tabbed-day-editor-mockup.png` (+
`mockup-tabbed-day-editor.html`).

**Intended IA (mockup):** a single LEFT VERTICAL RAIL of section links grouped
`SESSION` (Overview · Files & Weight) / `RECORDING` (Devices & Failed Channels · Tasks &
Epochs) / `FINISH` (Validation & Export). One clean single-column section per panel. Subject
identity + recording-system are INHERITED, READ-ONLY. No top-level DIO tab.

**Current build:** four HORIZONTAL tabs — Day / Epochs / Failed channels / DIO
(`src/viewModels/dayEditorViewModel.ts:193-198`, rendered by
`src/pages/DayEditor/DayEditorFrame.tsx:412-424`). The day screen still edits technical
parameters and subject metadata; DIO is its own tab.

Screenshots in `./screenshots/`.

## The single highest-leverage root cause

The day editor was migrated from a left-rail **section-nav** stepper to a **horizontal tab
bar**, but the old grid CSS that positioned a 230px left rail was never removed. The new
horizontal `.tabBar` is now jammed into that 230px grid column, so it wraps to two rows
("smushed to the side"). And the body panel still uses the wide multi-column `.form-grid`,
so a single section reads as a dense 3-column form, not the mockup's single column. The IA
realignment (a real grouped vertical rail + single-column panel + folding DIO/technical/subject
into the right scopes) is the fix that resolves points 1-5 together.

## Findings

| # | What's rendered now (screenshot) | Intended per mock | Root cause (file:line) | Fix |
|---|---|---|---|---|
| 1 | **Tab bar wraps to 2 rows, crammed into a 230px left column.** Measured: `.day-editor-body` is `display:grid; grid-template-columns:230px 1fr`; the `.tabBar` (`display:flex; flex-direction:row; flex-wrap:wrap`) is placed in the 230px track → "Day Epochs" on row 1 (y=215), "Failed channels DIO" on row 2 (y=255). (`screenshots/01-day-editor-full.png`, `01-tabbar-cropped.png`) | A single LEFT VERTICAL RAIL — one section per row, grouped SESSION / RECORDING / FINISH. | Grid mismatch: `src/pages/DayEditor/DayEditor.scss:84-88` (`.day-editor-body { grid-template-columns: 230px 1fr }`, a vestigial left-rail layout for the removed `.section-nav`) vs the new horizontal tab markup in `src/pages/DayEditor/DayEditorFrame.tsx:412-424` styled by `src/pages/DayEditor/DayEditorFrame.module.css:60-66` (`.tabBar` row flex). The 230px-rail CSS was never removed when the tab bar replaced the stepper nav. | Make the nav a true vertical rail: render the tab buttons as a grouped vertical list in the 230px column (`flex-direction:column`, full-width items, group headings), matching AnimalView's `SectionNav`. Remove/repurpose the orphan `.section-nav` rules at `DayEditor.scss:90-175`. |
| 2 | **Session Metadata is a dense 3-column grid.** Measured: `.form-grid` = `grid-template-columns: 289px 289px 289px`; Session ID \| Data folder \| Session Description on row 1; Experiment Description \| Weight \| Keywords on row 2. (`screenshots/02-day-tab-body.png`) | A clean single-column "Overview": Session ID, Session Description, Experiment Description, Weight only. | `src/pages/DayEditor/DayEditor.scss:254-258` — `.form-grid { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)) }`. In the wide ~998px content track this packs 3 columns. Markup: `src/pages/DayEditor/DayTab.tsx:197-331`. | Constrain the Overview panel to a single-column form (cap panel width / use one-column grid). Move Data folder + Keywords out of "Overview" into a "Files & Weight" section per the mock's SESSION group. |
| 3 | **Technical parameters AND subject metadata are editable on the Day tab.** "Technical parameters" `<details>` exposes editable Default-header-path / Analog units / Behavioral-event units; "View / edit inherited subject metadata" (badged "UPDATES ALL DAYS") exposes editable Date of Birth / Species / Description that write through to the animal. (`screenshots/03-day-tab-editable-technical-subject.png`) | Subject identity + recording system are INHERITED, READ-ONLY on the day screen. No per-day editable technical-params block on Overview. | Components: `src/pages/DayEditor/DayTechnicalSection.tsx` (whole section; the day-only inputs at lines 113-163) and `src/pages/DayEditor/DayTab.tsx:374-510` (the inherited-subject editor; subject inputs write via `onSubjectUpdate` lines 417-478). Mounted in `DayTab.tsx:367-372` and `:375`. | Demote subject identity to read-only display on the day surface (keep edits on AnimalView's "Edit profile"). Keep genuine day-only technical facts (header path / units) but relocate them under the RECORDING group; surface rig constants as read-only as today. |
| 4 | **"Setup & Failed Channels" tab conflates animal setup with day marks.** The Failed-channels tab heading is "Setup & Failed Channels" and shows a "Recording system" setup card ("No recording system yet — add it in its Recording System tab") and "No electrodes are set up… Set Up Electrodes" — i.e. animal-setup nudges, not just per-day failed-channel marking. (`screenshots/04-failed-channels-tab.png`) | Mock's RECORDING group has one "Devices & Failed Channels" section. Device GEOMETRY is animal-owned (set up once); the day section should mark failed channels for THIS day, pointing at animal setup only when geometry is absent. | Tab→step join: `dayEditorViewModel.ts:193-198` maps tab `channels` → step `devices` ("Devices & Failed Channels"); panel is `src/pages/DayEditor/FailedChannelsTab.tsx`. The conflation is partly correct (matches the mock's combined label) but the day surface still renders animal-setup affordances inline + the Day tab ALSO holds device rig-constants (point 3), so "Devices" is split across two tabs. | Keep one "Devices & Failed Channels" section; show the setup-needed prompt only as a thin "set up electrodes in Animal Setup" link, and move the rig-constant display here so all device content is in one place. |
| 5 | **Top-level DIO tab ("Behavioral events").** A full 4th tab renders a large two-column Din/Dout channel-map table. (`screenshots/05-dio-tab.png`) | The mock has NO top-level DIO tab. Its RECORDING group is only Devices & Failed Channels + Tasks & Epochs; behavioral events have no standalone tab. | `dayEditorViewModel.ts:197` (`{ key:'dio', label:'DIO', step:'behavioral' }`) + `DayEditorFrame.tsx:48` (`TAB_ORDER` includes `'dio'`) and `:449-455` (renders `DioTab`). | Fold DIO/behavioral events into a RECORDING-group section (or under Devices) rather than a peer top-level tab, so the rail matches the mock's 3-group / 5-section structure. |
| 6 | **Two "Add recording day" buttons at zero days.** Header "Add Recording Days" button + the EmptyState card's "＋ Add recording day(s)" button both render. (`screenshots/06-zero-days-empty-state.png`, `07-animalview-zerodays-setupcard.png`) | One add affordance. | Both are wired: header button in `src/pages/AnimalWorkspace/RecordingDaysTab.tsx:409-415` (`handleToggleCalendar`), and the zero-state CTA in `src/pages/AnimalWorkspace/DayList.tsx:78-92` (`onAddDay` → `RecordingDaysTab.tsx:512` → `setShowCalendar(true)`). They open the SAME calendar. | Show only ONE. Simplest: drop the header "Add Recording Days" button when `dayRows.length === 0` (let the EmptyState CTA own onboarding), or omit the EmptyState CTA (`onAddDay`) and keep the header button. |
| 7 | **"Set up this animal" card shows even for a configured animal.** A fully-set-up animal (1 probe, recording system, config v1; Electrode Groups + Recording System both "DONE") with ZERO days still shows the "Set up this animal" checklist; the section-nav shows ○ rings on Cameras/Optogenetics. (`screenshots/07-animalview-zerodays-setupcard.png`) | After setup, AnimalView should not nag "set up this animal" / imply setup is undone. | `src/viewModels/animalWorkspaceViewModel.ts:546` — `const showSetupCard = !(subjectPresent && dayCount > 0)`. It's gated on "has subject AND ≥1 day", NOT on actual hardware-setup completeness, so any zero-day animal shows the nag regardless of configuration. Rendered at `RecordingDaysTab.tsx:434-440`. The nav ○ rings come from per-section status in `src/pages/AnimalView/index.tsx:517-526` (Cameras/Opto are optional but render a hollow-○ "not set up" ring). | Gate `showSetupCard` on real setup completeness (e.g. required sections done) instead of `dayCount > 0`; for a configured animal show a lighter "ready — add a recording day" state. Treat optional sections (Cameras/Opto) as "not used" rather than "to do" ○ when the animal is otherwise configured. |

## Notes / method

- Geometry measured via `getComputedStyle` + `getBoundingClientRect` in-page (points 1, 2),
  not eyeballed — see the inline measurements in the table.
- The day used was the real `remy-2023-06-22`. For the zero-day states (points 6-7) a
  throwaway, fully-configured `uxtest02` animal was created in localStorage (ADDITIVE) and
  REMOVED afterward; the user's `remy` and pre-existing `uxtest01` were untouched.
- Point 4's "conflation" is partly intentional — the underlying step IS "Devices & Failed
  Channels" (matching the mock label). The divergence is that device content is SPLIT across
  the Day tab (rig constants) and the Failed-channels tab, and the day surface still renders
  animal-setup nudges inline.
</content>
</invoke>
