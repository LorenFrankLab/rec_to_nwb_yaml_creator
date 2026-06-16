# Day / Animal editor — mockups

**Date:** 2026-06-15 · **Branch:** `modern` · Throwaway design mockups (not wired to the app).
Companion to [../../research/action-by-action-ux.md](../../research/action-by-action-ux.md),
[mental-model-and-ui.md](../../research/mental-model-and-ui.md), and
[existing-app-invariants.md](../../research/existing-app-invariants.md).

A navigable mockup set — **Animals home → animal page → day editor**, plus the new-animal wizard.
Open [animals.html](./animals.html) and click through (rows and breadcrumbs are wired). The detailed
screens use one **opto** animal (Laurent) to cover the full experience.

| File | What it shows |
| --- | --- |
| [animals.html](./animals.html) | **Animals home** (top-level landing): every animal with genotype, day count, last recording, status (drafts / needs-review / all-exported), opto badge; search + filters; "+ New animal"; a **load/recovery banner** → review screen; sidebar **keyboard-shortcuts** help. Row → animal page. |
| [animal-page.html](./animal-page.html) | Animal page: **Days** table + full **Setup** tab (setup-progress + blast-radius bar; identity, configuration/probes, cameras, **tasks** task-type catalog, **optogenetics** w/ completeness meter, team, recording system — DIO is **day-owned**, not here). Days tab has a **calendar/batch day creator** (pick one date or a block; existing days marked). Configuration card shows the **version** (v1 · current · since…). Lifecycle ops: **create-animal** modal (scratch / import / copy-from), **new configuration** (re-implant) modal, **delete animal** modal. Header **animal-switcher** dropdown; **animal-profile** edit modal; per-day status **legend**. |
| [copy-from-animal.html](./copy-from-animal.html) | **Copy from another animal** (from the create modal): pick a same-rig source, choose which setup to copy (probes / cameras / task types / opto) — identity, days, and DIO are **not** copied — name the new animal, continue to setup. |
| [recovery-review.html](./recovery-review.html) | **Review recovered data** (from the home's load banner): records that didn't fit on load — auto-recovered (FYI) + needs-review (dangling day → unknown animal, malformed `bad_channels`, orphaned file, unknown camera) each with repair actions; nothing silently dropped. |
| [import-repair.html](./import-repair.html) | **Import & repair** (from the create modal's "Import a YAML"): parse a legacy file, decide **new animal vs existing-day**, and **flag every non-conforming field with a suggested fix** (`Rat`→`Rattus norvegicus`, `Male`→`M`, `"541g"`→`541 g`, NULL `None`/`NotInBrain` locations, experimenter shape) + **required-but-missing** (e.g. `date_of_birth`) blocking import. Benign format normalizations (`task_epoch`→`task_epochs`) auto-applied + listed; nothing silently dropped. |
| [create-animal.html](./create-animal.html) | Guided **new-animal wizard** (reached from the animal page's "Start from scratch"): Identity → **Electrodes/probes** → Cameras → Optogenetics → Tasks → Recording system → Team. Embeds the current-UI lessons: binomial species / single-letter sex / genotype-as-picker / subject_id collision; **device_type picker** (known probes, human summaries) + single **targeted_location** (brain-region autocomplete, modern-style) + AP/ML/DV coords + **replicate-N** + auto channel-maps + **behavior-only skip**; camera calibration warning; opto **4-field all-or-nothing** + completeness + power guard + required references; task-type catalog. |
| [export-preview.html](./export-preview.html) | **Export / preview** (from a day's Preview/Export button): the readiness **gate** (located issues block export, or "ready"), the derived **filename** (`20260514_Laurent_metadata.yml`), a read-only **YAML preview**, Download/Copy, and a **batch** "export all days" option. |
| [day-editor.html](./day-editor.html) | Day editor: a **"✓ Saved"** autosave indicator + an **export-readiness** bar + a read-only **animal scope-boundary card** (identity · probes · config · team, with an "Edit animal setup" link) + tabs — **Epochs** (grid + per-epoch drill-in for task/cameras/statescript/videos; per-epoch **opto power + pulse** columns), **Failed channels** (probe-wide grid, multi-shank marks consolidate to the first ntrode row), **DIO** (carry-forward summary by default → on-demand editor), **Day** (`session_id` auto-derived, weight, description, experimenters, **opto-protocol** card: laser DIO / FSGui file / camera). Covers every day-level field in the scope model. |
| [empty-states.html](./empty-states.html) | **First-run / empty states** the populated screens don't show: Animals home with **no animals** (＋ New animal / Import a YAML CTAs) and an animal whose setup is done but has **no recording days** (＋ Add recording day(s) CTA). What a brand-new user / freshly-created animal actually lands on. |

## Design bets these embody (decided)

- **Epochs:** the grid is the spine; you author the **task sequence**, and epoch #, per-type tag
  (`s1`/`r1`/`s2`), camera, and both filenames **derive** (`{date}_{animal}_{epoch:02d}_{tag}`). Per-epoch
  drill-in to add/edit cameras → one video per camera, statescript, opto power.
- **DIO:** **carry-forward summary by default** (edited only on a rewire); stems **Poke / Light / Pump /
  Laser** + **free custom entry** + **direction-aware** suggestions (Poke→Din, Light/Pump/Laser→Dout);
  full 64-channel ECU grid available under "Show all". **No preset lab template** — DIO sets are
  experimenter-specific (see [yaml-corpus-analysis.md §8](../../research/yaml-corpus-analysis.md)).
- **Channels:** probe-wide grid; multi-shank bad-channel marks consolidate to the first ntrode row.
- **Opto:** hardware in animal Setup (4-field completeness meter); a per-epoch power column appears on
  opto animals **only**.
- **Scope:** show each concern only at its scope, and only when present (a non-opto animal shows no opto;
  failed channels & DIO are day-level siblings, not epoch columns).

## Resolved UX-completeness gaps (2026-06-16)

A pass against the [UX rubric](../../research/ux-principles.md) + general web-app conventions, **scoped by
the fact that an animal lives only ~1–2 months (≤~60 recording days)** — so list-at-scale concerns don't
apply. Resolutions:

- **Empty / first-run states — ADDED** ([empty-states.html](./empty-states.html)). The populated screens
  never showed what a new user or a freshly-created animal lands on; now both have an onboarding state with
  the right primary CTAs. (Real at any scale.)
- **Undo — ADDED.** Frequent, reversible day actions (multi-select **Delete** / discard) use an **undo
  toast**, not a confirm dialog. **Delete-animal keeps a hard confirm** (rare, catastrophic). The
  "undo-for-reversible / confirm-for-catastrophic" split. (Mockup: animal-page Days table.)
- **Days-table bulk ops — ADDED multi-select + "Export selected"** (animal-page). **Dropped**
  search / filter / sort / pagination / virtualization — unneeded at ≤~60 rows. Batch-export-a-block stays
  first-class (matches the export journey); the 200-day scale machinery does not.
- **Save-state visibility — ADDED** a **"✓ Saved" autosave** indicator (day-editor header). This is also
  why **no navigate-away "unsaved changes" guard** is needed — autosave makes it moot. (The shipping app
  already has a `SaveIndicator`; this just shows where it lives.)

**Deferred (called out on purpose):** multi-user / accounts (data model is already person-independent;
single-user UI is intentional); lab-wide settings/preferences (boilerplate stays pre-filled); mobile /
responsive (desktop-first fits the audience).

**Folded into the implementation plan as per-phase acceptance criteria (not mockups):** the 128-cell
**channel grid** and **DIO grid** must be **keyboard-operable + screen-reader labelled** (axe-verified;
they're click-only here); **async progress** for batch export / large import; **post-download success
confirmation** ("wrote `…_metadata.yml`").

## Must reuse the existing correctness substrate

The redesign is a new **input surface** over the same validation rules / `mergeDayMetadata` /
normalization / bad-channel monotonicity / orphan-visibility — not a rewrite. See
[existing-app-invariants.md](../../research/existing-app-invariants.md). Exported YAML shape unchanged;
golden baselines byte-identical.

## Scope checklist (run against any mockup/spec)

| Concern | Scope / where it lives | Shows only when |
| --- | --- | --- |
| task, statescript, video(s), per-epoch opto power | **epoch row** (grid) | always (opto power column: opto animals only) |
| failed channels | **day** (Failed channels tab) | always; probe-wide grid |
| DIO / behavioral_events | **day** (DIO tab) | always; summary by default |
| opto hardware (source/fiber/virus/software) | **animal setup** + completeness meter | opto animals only |
| subject identity, electrode geometry | **animal setup** | never in the day grid |

Rule: **show each concern only at its scope, and only when present for this animal.**
