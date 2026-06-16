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

## External UX review — applied (2026-06-16)

A reviewer validated the IA + scope model as the core win and raised six priorities. Outcomes:

**Applied to the mockups:**

- **Issue-driven export readiness** (day-editor). The bar is now a **quiet one-line "✓ Ready to export"**
  when clean and a **loud red "N issues block export"** bar — with plain-language items that **link to the
  offending field** (epoch / Setup) — only when something blocks. (Mockup has a demo toggle to preview both;
  the real app drives it off validation.)
- **Blast-radius at the edit point** (animal-page Setup). An **"affects all N days"** chip sits next to the
  Edit control on the animal-static sections whose edits force re-export — **Identity, Cameras,
  Optogenetics** — in addition to the page banner. *Excluded by design:* Team (past days keep their recorded
  experimenters) and the additive "＋ Add task type".

**Status vocabulary — one set of words per scope (never reuse a word across scopes):**

| Scope | States | Where |
|---|---|---|
| **Epoch completeness** | `Complete` / `Incomplete` | epoch-grid row Status |
| **Setup completeness** | `Opto configured · N of N`; `✓ Identity / ✓ Cameras …` | animal Setup (opto meter, progress checks) |
| **Day lifecycle** | `Draft` (incomplete) → `Ready` (valid, not exported) → `Exported`; `Needs review` (blocking issues) | day header pill · animal Days table |
| **Export readiness** | `Ready to export` / `N issues block export` | day-editor readiness line (a *check*, not a stored status) |
| **Export history** | `Exported` (optional `· stale` if inputs changed since) | export-preview / days table |

`Complete` is **epoch-only**; setup-section completeness uses `configured` / `N of N` (the opto meter is
`Opto configured · 4 of 4`, not `Complete · 4 of 4`) so the word never spans scopes.

`Draft` now means **only** genuinely incomplete (reserved per review). A valid-but-unexported day is
`Ready` — the same concept the readiness line surfaces (`Ready to export`), shown as a persistent day
state so it never collides with `Draft` (the original "Draft + Ready to export" contradiction).

## Second UX review — applied (2026-06-16)

A second pass called the design "close"; resolved its remaining interaction-language issues in the mocks:

- **`Draft` vs `Ready to export` no longer collide** — the valid-but-unexported day is now `Ready`
  (blue pill), and `Draft` is reserved for incomplete days. Aligned across day header, animal Days table
  (+ legend), and the Animals home rollup ("1 ready"). See the status vocabulary above.
- **Blocking links are field-level** — "Fix in Epoch 1 →" switches to Epochs, **expands the row, scrolls
  to, and flashes the exact control** (`gotoEpoch()`); the cross-page Setup link is the spec for the same
  behavior across pages.
- **Larger epoch-expand target** — the tiny `▸` became a 24 px caret button **and** the task cell is now a
  click target for expansion (bigger hit area).
- **Derived vs editable files disambiguated** — statescript/video render as a read-only **generated** value
  (grey chip + "generated" tag) with an explicit **Override / Rename** action, not an editable-looking input.
- **Accessible row navigation** — animal/day rows now contain a **real `<a>` link** on the name/date
  (not row `onclick` alone), important alongside the day-row checkboxes.
- **Setup `Edit` reads as a control** — bordered button-style affordance next to the blast-radius chip.

**Verified:** no horizontal overflow at **1280×800 (13″)** (content caps at 1040 px).

## Third UX review — applied (2026-06-16)

A third pass called the design "very close"; tightened the interaction semantics:

- **Epoch caret is a real `<button aria-expanded aria-controls>`** (not a `<td onclick>`), keyboard-focusable
  with a `:focus-visible` ring and a rotate-on-expand; the task cell stays a secondary mouse target. The
  `<td onclick>` pattern is **not** the implementation spec.
- **Rows use explicit links, not row `onclick`** — the day table's row-level navigation handler is gone
  (it wrapped links *and* checkboxes); navigation is the date `<a>` + a chevron `<a>`, checkboxes are
  independent. The Animals table likewise drops its stray row handler (name link only).
- **Cross-page repair is field-level too** — the Setup blocking link is now `…#cfg-probe2`; arriving on the
  animal page opens Setup, scrolls to, and flashes Probe 2 (same scroll→reveal→flash as the in-page epoch
  path). Real-app spec: also move focus to the field.
- **`Complete` no longer spans scopes** — the opto meter reads `Opto configured · 4 of 4` (see vocabulary).
- **DIO editor `Done` → `← Back to summary`** — it's summary navigation, not a save (the day autosaves).

**Still implementation-only:** real **focus management** (`.focus()` on the target field, focus-trap in
modals) beyond the mock's scroll+flash, and **axe-verified** keyboard operation across the epoch / channel /
DIO grids.

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
