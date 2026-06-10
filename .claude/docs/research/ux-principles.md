# UX principles for rec_to_nwb_yaml_creator — and how they apply

**Date:** 2026-06-10 · **Branch:** `modern` · Companion to
[design-feedback-evaluation.md](./design-feedback-evaluation.md).

Purpose: a **reusable UX rubric** to apply to *every* user-facing change, grounded in Jeffrey Heer's
interaction principles and the broader HCI/cognitive canon, then **applied to each finding** (F1–F6 +
the Post-v3 UX items). The north star is unchanged from the scope-tiers note — *"the user adds
information in the most efficient way possible"* — but here we make the cognitive reasoning explicit so
design decisions are principled, not taste.

## The frame: "think Jeffrey Heer"

Heer & Shneiderman, *Interactive Dynamics for Visual Analysis* (CACM 2012), argue an analysis tool must
support **"the fluent and flexible use of [the interface] at rates resonant with the pace of human
thought,"** and warn — in a line that reads like a direct review of our Tasks & Epochs screen — that
**"confusing widgets, complex dialog boxes, hidden operations, incomprehensible displays, or slow
response times can do more harm than good."** Their taxonomy's third pillar — *process & provenance*,
including **guide** — reminds us the tool should actively *guide the user to the correct answer*, not
just collect input. (This app isn't a viz tool, but it is an analytic-data-entry tool feeding a
scientific pipeline; the same fluency/visibility/guidance demands apply.) [Heer & Shneiderman 2012]

Layered on Heer, four well-established results:

- **Working memory is tiny.** Classic Miller "7±2"; the modern estimate is **~4±1 chunks** (Cowan).
  Design so the user never has to *hold* more than a few things at once. [LogRocket; IxDF]
- **Cognitive Load Theory.** Minimize *extraneous* load (UI cruft, decoration, inconsistency), manage
  *intrinsic* load (chunk the task), to free capacity for the actual scientific judgment. [Aufait; zigpoll]
- **Recognition over recall** (Nielsen heuristic #6). Let users *pick/confirm* from visible, familiar
  options instead of remembering values or formats. [Research Collective; FasterCapital]
- **Mental models & the two gulfs** (Norman). Match the system to the user's model of the experiment
  (animal → day → session — *"what did the animal do?"*, not *"fill the tasks[] array"*); close the
  **gulf of execution** (clear affordances) and the **gulf of evaluation** (clear feedback).

Form-specific craft for complex/scientific input: **"reward early, punish late"** validation (validate
inline, don't punish before a field is left, clear errors instantly on correction, run empty-required
checks on Save not on entry); **sectioned/stepper forms** for context + chunking; **smart defaults that
are visible and overridable** (never a silent auto-fill of scientific data). [Coyle; Perpetual]

## The rubric (apply to every user-facing change)

1. **Mental model first** — does the UI mirror how the scientist thinks, not how the YAML is shaped?
2. **One primary task per screen** — name what the user is here to do; foreground it, defer the rest.
3. **Working-memory budget (~4 chunks)** — count what the user must hold at once; if >4, chunk or disclose.
4. **Recognition over recall** — pick/confirm from visible options; inherit/carry-forward; no retyping.
5. **No hidden operations** — surface consequential behavior *before* it fires; make state visible.
6. **Guide to the correct answer** — examples, constrained inputs, teaching validation, visible defaults.
7. **Feedback & reversibility** — confirm success/failure; make actions undoable; close the eval gulf.
8. **Consistency** — same concept ⇒ same control, label, and visual treatment everywhere (→ F6).
9. **Perceptually honest encoding** — never status-by-color/emoji alone; pair with text/shape (a11y + perception).
10. **Respect the cost of error** — scientific infra: bias toward *preventing* silent/irreversible mistakes (gate, don't merely warn).

## Applying the lens to each finding

### F1 — Remove channel maps
The Channel Maps tab is, for ~all users, **extraneous load + a recall burden** ("what am I supposed to
do here?"). Removing it is a cognitive-load win (rubric 1–3). But don't delete *silently* — that opens a
gulf of evaluation ("did wiring get set?"). Replace it with a **recognizable reassurance**: a small
read-only line/summary "Channel maps are generated automatically from each electrode group's device
type" (rubric 5,7). So: remove the *editing* affordance; keep a quiet confirmation of the auto-state.

### F2 — Days always ordered
Days are inherently chronological; an unordered list **violates the user's mental model** and forces
re-scanning to locate a date (working-memory tax, rubric 1,3). Canonical date order = consistency +
recognition. Unambiguous win; no UX downside.

### F3 — Hidden logo / shortcuts
This is **visibility of system status + discoverability** (rubric 5,7). An occluded shortcuts entry point
makes power features undiscoverable, forcing recall ("was there a shortcut?") instead of recognition.
Fix the layering, and while there, make the shortcuts affordance *legible* (it's a tiny trigger today).

### F4 — Tasks & Epochs (the headline)
Almost every rubric item is violated, which is *why* it's the worst screen — and it's the textbook case
of Heer's "do more harm than good":
- **Overload (rubric 3):** ~7 stacked editors (Tasks, Videos, Files, Behavioral events, FsGUI, repair
  dialogs, camera banner) far exceed ~4 chunks. → **chunk + progressive disclosure**: lead with Tasks,
  collapse the rest until relevant.
- **Mental-model mismatch (rubric 1):** the screen mirrors the data schema, not "what did the animal do
  this day?". → add a one-line framing + an intro defining *task* and *epoch* in plain terms.
- **Recall burden (rubric 4):** task definitions are re-typed every day. → the **task-type catalog**
  (define once on the animal; each day *picks + orders* epochs) is the recognition-over-recall fix. This
  is the 🟡 merge-changing piece — overlaps scope-tiers Thread 2.
- **Hidden operations (rubric 5):** the "repair-before-orphaning" constraint and the
  epoch→video/file/FsGUI coupling are invisible until a delete triggers a surprise dialog. → make the
  coupling visible and warn *before* acting.
- **Extraneous load + dishonest encoding (rubric 8,9):** decorative emoji (🧩/📹/🔒) and status-by-glyph
  (✓/⚠/❌ where ⚠ means two different things). → remove decorative emoji; replace glyphs with text+color labels.

Two-tier plan: **🟢 quick wins** (emoji, intro copy, text status, progressive disclosure, surface the
coupling) deliver most of the relief in-place; the **🟡 task-catalog** model change delivers the rest and
is planned separately (baseline-gated).

### F5 — DIO Type + Index
The free-text Description forces **recall** of a hardware-naming convention (`Din1`) and invites a
**silent** downstream failure (description matching no `.rec` channel → empty event series). The legacy
**Type-select + Index-number** control is recognition-over-recall + error-prevention by construction
(rubric 4,6,10). Restore it (it emits the identical string — merge-neutral), label it "DIO line index",
keep the example hint. High value *because* the failure is silent — rubric 10.

### F6 — Styling consistency
Inconsistency is **extraneous cognitive load**: every divergent button/label/icon is a micro-recall task
("is this the same thing as that?") and erodes trust (rubric 8). Two different validation-error icons is
also **dishonest encoding** (rubric 9). A design-token system + shared components delivers
**consistency-by-construction** — the structural fix for a UX problem.

### Post-v3 UX items through the lens
- **device_type human summaries** (`128c-4s8mm6cm-20um-40um-sl` → "128-ch, 4-shank…"): opaque IDs are a
  pure recall burden; human summaries = recognition (rubric 4,6). Keep option *values* selector-stable.
- **#2 reconfig wizard** (select-all + human day labels + success confirm): chunking + feedback for
  60–200-day studies (rubric 3,7).
- **#4 persisted-"Validated" indicator**: visibility of system status — distinguish *persisted-valid* from
  *live-valid* so the user isn't unsure what's saved (rubric 7).

## Sources

- Heer, J. & Shneiderman, B. (2012). *Interactive Dynamics for Visual Analysis.* CACM. [PDF](https://idl.cs.washington.edu/files/2012-InteractiveDynamics-CACM.pdf) · [ACM Queue](https://queue.acm.org/detail.cfm?id=2146416)
- [14 cognitive principles every UX designer should know — LogRocket](https://blog.logrocket.com/ux-design/cognitive-principles-for-ux-designers/)
- [Cognitive Load Theory in UI Design — Aufait UX](https://www.aufaitux.com/blog/cognitive-load-theory-ui-design/) · [Cognition in UX/UI — IxDF](https://ixdf.org/literature/topics/cognition)
- [Recognition Over Recall — Research Collective](https://research-collective.com/recognition-over-recall/)
- [Form Design for Complex Applications — Andrew Coyle](https://www.andrewcoyle.com/blog/form-design-for-complex-applications) · [Designing Forms for Complex Data Input — Perpetual](https://www.perpetualny.com/blog/how-to-design-forms-for-complex-data-input)
