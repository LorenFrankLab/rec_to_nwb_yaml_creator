# Phase 0 — Quick wins (independent of the tab restructure)

**Ships immediately. Copy-only. No tabs, no routing, no store/export change.** These are the requests
that don't need the tabbed shell, so they shouldn't wait for it.

## Goal

Make the Channel Maps screen say what the scientist is actually doing, and stop the setup screens from
implying a false linear "do these steps in order, once" flow.

## Tasks

- **Task 0.1 — Channel Maps copy** ([ChannelMapsStep.jsx:92-94](../../../../src/pages/AnimalEditor/ChannelMapsStep.jsx)).
  Replace the heading `Step 2: Channel Maps` → `Channel Maps` and the intro `Configure channel mappings
  for each electrode group.` with copy that names the two real jobs:
  > Map each probe channel to its electrode position, and mark dead/bad channels. The map records which
  > hardware channel reads which contact on the probe; bad channels are the ones to exclude from analysis.
  Confirm the table's status badges (✓ all mapped / ⚠ partial / ❌ none) and the bad-channel affordance
  read consistently with this framing (the badges live in this component; the per-group editor is
  [ChannelMap.jsx](../../../../src/ntrode/ChannelMap.jsx)). **Surface the bad-channel count per group in
  all states** (firm requirement, not conditional — a channel dying mid-experiment is a common edit):
  a scannable `2 bad / 16` per row.
- **Task 0.2 — De-stepper the setup headings.** Drop the `Step N:` prefixes that imply linearity:
  `Step 1: Electrode Groups` → `Electrodes & Ephys` ([ElectrodeGroupsStep.jsx:178](../../../../src/pages/AnimalEditor/ElectrodeGroupsStep.jsx)),
  `Step 2: Channel Maps` → handled in 0.1. Leave the stepper *navigation* untouched (Phase 1+ replaces
  it); this is only the in-panel `<h2>` copy so the screens don't read as a one-time wizard.
- **Task 0.3 — Update the affected tests/snapshots.** Any test asserting `/Step 2: Channel Maps/i`,
  `/Step 1: Electrode Groups/i`, or `/configure channel mappings/i` (search `src/pages/AnimalEditor/__tests__/`).

## Acceptance

- Channel Maps screen names "map channels" AND "mark bad channels" in its heading/intro; a scientist
  unfamiliar with the schema can tell what the screen is for.
- The per-group bad-channel count is visible in every row state (`2 bad / 16`).
- No `Step N:` prefix remains in a setup panel heading.
- Full suite, lint, build green; **125 golden baselines byte-identical** (copy-only — nothing touches
  export).

## Notes

- This is the only phase that can land before the tab shell and even before the v3 cutover with zero
  IA risk. Do it first.
- The Electrodes & Channels *tab* (Phase 3) inherits this copy; don't re-litigate it there.
