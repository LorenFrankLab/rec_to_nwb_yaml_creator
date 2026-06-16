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
| [animals.html](./animals.html) | **Animals home** (top-level landing): every animal with genotype, day count, last recording, status (drafts / needs-review / all-exported), opto badge; search + filters; "+ New animal". Row → animal page. |
| [animal-page.html](./animal-page.html) | Animal page: **Days** table + full **Setup** tab (setup-progress + blast-radius bar; identity, configuration/probes, cameras, **tasks** task-type catalog, **optogenetics** w/ completeness meter, team, recording system — DIO is **day-owned**, not here). Lifecycle ops: **create-animal** modal (scratch / import / copy-from, guided-step order), **new configuration** (re-implant) modal, **delete animal** modal. |
| [import-repair.html](./import-repair.html) | **Import & repair** (from the create modal's "Import a YAML"): parse a legacy file, decide **new animal vs existing-day**, and **flag every non-conforming field with a suggested fix** (`Rat`→`Rattus norvegicus`, `Male`→`M`, `"541g"`→`541 g`, NULL `None`/`NotInBrain` locations, experimenter shape) + **required-but-missing** (e.g. `date_of_birth`) blocking import. Benign format normalizations (`task_epoch`→`task_epochs`) auto-applied + listed; nothing silently dropped. |
| [create-animal.html](./create-animal.html) | Guided **new-animal wizard** (reached from the animal page's "Start from scratch"): Identity → **Electrodes/probes** → Cameras → Optogenetics → Tasks → Recording system → Team. Embeds the current-UI lessons: binomial species / single-letter sex / genotype-as-picker / subject_id collision; **device_type picker** (known probes, human summaries) + single **targeted_location** (brain-region autocomplete, modern-style) + AP/ML/DV coords + **replicate-N** + auto channel-maps + **behavior-only skip**; camera calibration warning; opto **4-field all-or-nothing** + completeness + power guard + required references; task-type catalog. |
| [export-preview.html](./export-preview.html) | **Export / preview** (from a day's Preview/Export button): the readiness **gate** (located issues block export, or "ready"), the derived **filename** (`20260514_Laurent_metadata.yml`), a read-only **YAML preview**, Download/Copy, and a **batch** "export all days" option. |
| [day-editor.html](./day-editor.html) | Day editor: an **export-readiness** bar + tabs — **Epochs** (grid + per-epoch drill-in for task/cameras/statescript/videos; per-epoch **opto power + pulse** columns), **Failed channels** (probe-wide grid, multi-shank marks consolidate to the first ntrode row), **DIO** (carry-forward summary by default → on-demand editor), **Day** (`session_id` auto-derived, weight, description, experimenters, **opto-protocol** card: laser DIO / FSGui file / camera). Covers every day-level field in the scope model. |

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
