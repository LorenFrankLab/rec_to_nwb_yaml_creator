# Export journey & error-correction states

**Date:** 2026-06-15 · **Branch:** `modern` · Companion to
[mental-model-and-ui.md](./mental-model-and-ui.md), [data-change-scope-model.md](./data-change-scope-model.md),
and [yaml-corpus-analysis.md](./yaml-corpus-analysis.md).

Purpose: write down the **irreducible step-by-step work** a user does to export YAML(s) — the
happy-path journey *and* the secondary states where they have to fix a mistake or correct an error.
This is task analysis (what the user must accomplish), not current-app screens; it grounds the UX
options that follow.

**Decision captured:** scientists author metadata in a **mix** of day-by-day and batch (a whole block
after recording). Both are first-class. The atomic unit is **one day**; a "batch" is just the per-day
flow repeated across N dates with carry-forward chaining from the previous day. The UI must make a
single day fast *and* a span of days fast — neither is the afterthought.

## 1. The goal and the three tiers

Export produces one valid, convertible `{date}_{animal}_metadata.yml` per recording day. Each file is a
merge of three scopes (see [data-change-scope-model](./data-change-scope-model.md)):

- **Animal-static** — identity, team, experiment description, lab/institution.
- **Configuration (the implant)** — electrode groups + device_type + location + coords (→ channel maps
  auto-derive), opto hardware, rig + boilerplate constants.
- **Day delta** — date, weight, epoch/task structure, per-epoch files (statescript + video), bad
  channels, DIO (usually carried), opto power schedule, who ran it.

## 2. The happy-path journey

### Phase A — first time with a new animal (the "initial add")

1. **Create the animal** — identity fields, once.
2. **Define the configuration / implant** — per electrode group: device_type + location + targeted
   coords; channel maps generate; mark opto hardware if any. *Heavy, careful, once per implant.*
3. **Confirm the rig / shared defaults** — `data_acq_device`, camera catalog, DIO template; lab
   boilerplate pre-filled and merely accepted.
4. **Add the first recording day(s):**
   - Pick the date(s): one day · a **consecutive range** · or **individually-chosen** dates (gaps are
     normal — rest days, weekends, sick days).
   - Supply the delta (first day carries nothing): weight, epoch structure (tasks + order + camera),
     per-epoch statescript + video files, bad channels (usually none yet), opto schedule, session
     description, experimenters (default = team).
   - **Key:** per-epoch *files* are mechanically derivable from the naming convention
     `{date}_{animal}_{epoch:02d}_{tasktag}` (`20260507_Laurent_01_s1.stateScriptLog`,
     `..._01_s1.1.h264`). The *authored* delta is really **epoch structure + weight + bad channels**;
     files should follow.
5. **Validate & export** — one file per day, or batch-export all selected days.

### Phase B — coming back later to add more days

1. **Open the existing animal** — source of truth; nothing re-entered.
2. **Did the implant change since last time?** No → current config. Yes (re-implant) → **start a new
   configuration version** first; bad-channel marks reset; later days stamped with the new config.
3. **Add the new day(s)** — pick date(s). **Carry-forward seeds from the most-recent recorded day *of
   the same config*** — explicitly *not* calendar-yesterday, so gaps just work.
4. **Edit only the diff** — typically weight + epoch structure (+ files follow) + newly-dead channels
   (monotonic: yesterday's bad channels stay bad). Confirm.
5. **Validate & export the new day(s).**

### Branch points to design around
Batching (one vs range vs scattered) · gaps (carry-forward from last recorded same-config day) ·
config change (re-implant fork) · the tiny real per-day delta (epochs + weight + bad channels; files
derive).

## 3. Per-day export state (what makes correction tractable)

Because the animal is a single source of truth and the YAML is a *snapshot*, the app must track each
day's export state so it can answer "I fixed something — what do I regenerate?":

| State | Meaning |
|---|---|
| **draft** | started, not yet valid |
| **valid** | passes validation, not yet exported |
| **exported · current** | exported, and the file matches current data |
| **exported · stale** | exported, but an upstream edit (animal/config) or a day edit changed inputs since → **needs re-export** |

This state model is the backbone of every correction flow below.

## 4. Secondary states — correcting errors & mistakes

Two ways an error surfaces: **the app caught it** (validation gate) or **the user realizes it** later
(sometimes weeks on). Both need a graceful path. Organized by where the fix lives.

### A. Caught at validation/export
The gate blocks export and names the problem **in the user's language**, located on the offending day/
field: "Epoch 3 has no statescript file"; "`location` is empty on probe 2"; "species must be a binomial
— did you mean *Rattus norvegicus*?"; "device_type *128c-4s8mm6cm-15um-40um-sl* isn't a known probe."
The user jumps to the field, fixes, re-validates. (Corpus: every §5/§6 compliance flag lands here.)

### B. Correcting **animal-static** data after the fact (the blast-radius case)
The user realizes genotype/DOB/subject_id was wrong. Single-source-of-truth means **one edit fixes it
everywhere** — but it also makes every already-exported day **stale**. So the flow is: edit the animal
once → the app shows *"this changes N days; M were already exported"* → offer **batch re-export** of the
affected days. This is the structural answer to the corpus's worst errors (mec10's two genotypes, Seth's
two DOBs): they can't recur (one value), and when the one value is fixed, nothing is left behind.

### C. Correcting a **single day** after creation/export
Typo in epochs, wrong file, wrong weight. Re-open that day → fix → its state flips to *exported · stale*
→ re-export just that day. No effect on siblings.

### D. **Carry-forward gone wrong** (silent inheritance)
The new day inherited a value that should have changed (a swapped camera, a board change that altered
the DIO map, a newly-dead channel left unmarked) — *or* failed to inherit something it should have. The
**diff view** ("changed vs carried from <date>") is the prevention; the correction is editing the
carried value. Design rule: carry-forward is always **visible and diffable**, never silent — so "I
forgot to update X" is catchable before export.

### E. **Configuration** corrections
- *Forgot to start a new config after a re-implant:* later days were recorded against new wiring but
  stamped with the old config. Need to **create the config version and re-assign** the affected day
  range to it (bad-channels reset for those days).
- *Re-assign a day's config:* a day was filed under the wrong configuration.

### F. **Bad-channel** correction (monotonicity)
Marking channels is the most frequent day edit. Un-marking a channel that was bad on an earlier
same-config day is suspicious: the app prompts an **in-context confirm** and records an
acknowledgment; an unacknowledged regression **blocks export**
(`bad_channel_unfailed_without_ack`). (This already exists — `domain/badChannelMonotonicity`.)

### G. **Date / identity** collisions & misfiling
- *Duplicate date:* a day already exists for that date → block/merge prompt.
- *Bad date:* wrong format (corpus: MMDDYYYY `03112024_SC50`), future date, implausible → flag at entry.
- *subject_id case mismatch* with the animal/filename (corpus: `Senor`/`senor`, `RS10`/`rs10`) → normalize.
- *Day under the wrong animal:* created against the wrong subject → **move/reassign** the day.

### H. **Import & repair** an existing file (the legacy-correction journey)
Very common given the corpus. User imports a hand-built or external YAML to standardize it. The app:
1. parses and maps fields into the model;
2. decides **new animal vs another day of an existing animal** (match on normalized subject_id) — and
   whether its config matches;
3. **flags every non-conforming field with a suggested fix** — `Rat`→*Rattus norvegicus*, `Male`→`M`,
   `"541g"`→`460` + unit, space-keys (`electrode groups`→`electrode_groups`), NULL locations,
   genotype-holding-strain, `volume_in_uL`/`_ul` collision, unknown device_type;
4. user reviews/accepts fixes and fills gaps (e.g., missing `date_of_birth`) → it becomes a normal,
   valid day/animal.

### I. **Reversibility & drafts**
Delete a day created by mistake (with confirm + undo); abandon a half-entered day and return to it
later (draft persists); undo an accidental field edit. Destructive actions on exported data warn first.

## 5. Cross-cutting error-handling principles

- **Gate, don't merely warn**, for cost-of-error fields (the silent-failure ones) — block export with a
  located, plain-language reason.
- **Fix in context** — the error links to the exact day/field; no hunting.
- **Propagate + re-export** — fixing shared (animal/config) data marks dependent days stale and offers
  batch re-export; nothing silently left behind.
- **Carry-forward is visible & diffable** — never a silent auto-fill of scientific data.
- **Monotonic-by-default with explicit, acknowledged overrides** (bad channels).
- **Reversible** — drafts persist; deletes/edits are undoable; destructive acts on exported data warn.
