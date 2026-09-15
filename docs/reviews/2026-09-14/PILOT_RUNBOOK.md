# Pilot runbook — first useful release (set up once → log another day → leave/resume → export → convert)

For the person running the pilot sessions. Goal: watch 3–5 scientists do the four covered tasks with their
own animals, compare against how they do it today, and record every place they needed help or were about
to make a wrong-date / wrong-setup / copied-measurement error. This is a target to test, not a claim.

Status: **not yet run**. Nothing in this file is an observation.

## 0. Before the first session

1. Build and serve the working tree (the release is *not* deployed; the legacy form is still the default route):
   ```bash
   nvm use && npm ci && npm run build && npx vite preview --port 4173
   # open http://localhost:4173/#/workspace
   ```
   Or use `npm run start` (port 3000). Use one browser profile per participant — the workspace lives in
   that browser's storage.
2. Have each participant's real inputs ready: subject id **exactly as it appears in their `.rec` filenames**
   (case-sensitive, no underscore), one existing metadata YAML for that animal, their weights and team for
   three dates (see §2), the probe-change date if they had one.
3. Ask participants to keep doing the task the way they do it today for one of the days (their spreadsheet,
   copied YAML, text editor …) so there is a same-day baseline timing.

## 1. What to time and record (per participant, per task)

Copy this table once per participant.

| Task | Their current method: time | App: time | Needed help? (what) | Wrong date / wrong setup / copied weight caught by app? by observer? | Verbatim friction |
| --- | --- | --- | --- | --- | --- |
| A. Set up once (animal + setup from an existing YAML) | | | | | |
| B. Routine day (Log today) | | | | | |
| C. Backfill a day before a probe change entered later | | | | | |
| D. Leave / resume (close tab, reopen; second tab) | | | | | |
| E. Correction (past weight) → re-download | | | | | |
| F. Convert the downloaded file | | | | | |

Timing starts when the participant says they are starting and stops when the file is downloaded (B, C, E)
or the state is visibly restored (D). Note interruptions separately. Record what the participant *says*
they expected when it differed from what happened — that is the finding, not the timing.

## 2. Session script

### A. Set up once (≈ the rare journey)
1. `#/workspace` → **Import YAML** with the participant's existing file. Check the import preview names the
   subject and the per-file team; confirm.
2. Open the animal → the **Electrode Groups** section (the configuration card at the top). If the probe setup was entered from the YAML it shows
   "entered <date> (effective date not recorded)". Ask: *when was this implant/setup actually in effect?*
   → **Set effective date**. (This is the one fact the file cannot know; observe whether the question
   makes sense to them.)
3. Animal profile → confirm **Subject ID (exact spelling in the recording filenames)** matches a `.rec`
   filename they have. An underscore is refused with the reason; note whether they understand why.

### B. Routine day
1. Animal page → **Log today (<date>)**. The day opens on **Daily log**.
2. They enter today's weight (the field is empty; the previous measurement is shown as "Previous
   measurement: N g on <date>" with **Use N g**). Watch whether they reach for **Use N g** when the animal
   was *not* weighed — that is the copied-measurement error the design is meant to prevent. Do not prompt.
3. Team: pre-filled from the nearest earlier day; they edit if different.
4. Epochs/tasks: pre-filled from the earlier day; they adjust.
5. **Export** → **Download**. Filename must be `YYYYMMDD_<subject>_metadata.yml`. The card reads
   "Downloaded … as <filename>".

### C. Backfill before a probe change
Pick a date *before* the setup change recorded in A2 (or before the newest setup if none).
1. Animal page → **Choose recording date** → type the date. The preview must say it starts from the nearest
   *earlier* day and names the setup effective on that date (older version). If the only setup became
   effective later it says so and the day will ask for confirmation.
2. **Create & open**. The provenance line under "Daily log" should read "Started from <earlier date> ·
   Probe setup v<old>". Ask the participant which setup they *expected* and record it verbatim.
3. Weight is empty again (a backfill never copies a measurement). They enter the dated weight.
4. Export → Download.

### D. Leave / resume / transfer
1. Mid-entry (cursor still in the team field, text typed, not tabbed out), have them close the tab.
   Reopen `#/workspace` → animal → **Unfinished days → Resume <date>**. The typed text must be there.
2. Open the same URL in a second tab. It must show "Another tab is editing this workspace" and be
   read-only; typing there does nothing to storage. **Edit in this tab instead** moves editing; the first
   tab shows "Editing moved to another tab".
3. `#/workspace` → **Download workspace backup**. On a second machine/profile: **Restore from backup…** →
   preview lists animals, days, incomplete days → **Replace workspace**. Unfinished days, setup history and
   provenance survive.

### E. Correction
1. Open the day from B → change the weight → Ctrl/Cmd+S → **Export**. The card must read
   **Changed since download** and **Show what changed** must list the weight line.
2. Download again. Same filename (the corrected file overwrites the old one on disk — say so).

### F. Convert (observer, not participant)
Put the downloaded file next to that day's `.rec`/video files and run the real converter:
```bash
# groups with the recordings? (real trodes_to_nwb scanner, one temp dir per filename)
/Users/edeno/Documents/GitHub/trodes_to_nwb/.venv/bin/python scripts/check-scanner-grouping.py

# convert (edit `session`/`out`; pattern from docs/reviews/2026-09-14/downstream-checks/run_convert.py)
/Users/edeno/Documents/GitHub/trodes_to_nwb/.venv/bin/python docs/reviews/2026-09-14/downstream-checks/run_convert.py

# inspect values written to the NWB (subject, weight, electrodes/bad_channel, cameras, tasks, epochs)
/Users/edeno/Documents/GitHub/trodes_to_nwb/.venv/bin/python docs/reviews/2026-09-14/downstream-checks/inspect_nwb.py
/Users/edeno/Documents/GitHub/trodes_to_nwb/.venv/bin/nwbinspector out/<animal><date>.nwb --config dandi
```
Then, in a **disposable** database only (never `spyglass-db`):
```bash
docker run -d --name rec2nwb-disposable-mysql -e MYSQL_ROOT_PASSWORD=tutorial -p 3399:3306 datajoint/mysql:8.0
until [ "$(docker inspect -f '{{.State.Health.Status}}' rec2nwb-disposable-mysql)" = healthy ]; do sleep 2; done
mkdir -p tests/spyglass_base/raw && cp out/<animal><date>.nwb tests/spyglass_base/raw/
DJ_SUPPORT_FILEPATH_MANAGEMENT=TRUE /Users/edeno/miniconda3/envs/spyglass_spikesorting_v2/bin/python \
  docs/reviews/2026-09-14/downstream-checks/spyglass_ingest.py   # edit the nwb filename inside
docker rm -f rec2nwb-disposable-mysql
```
Both blockers met while validating this release are already handled by the script: DataJoint needs
`DJ_SUPPORT_FILEPATH_MANAGEMENT=TRUE`, and Spyglass `test_mode` requires the base dir to contain a `tests`
path component.

## 3. Decisions the pilot must return

1. **Unknown weight.** Today a day without a measured weight cannot be exported (the converter requires
   `subject.weight`). Do participants hit this? What do they do today (skip, previous value, estimate)?
2. **Bad-channel marks.** Do they use marks for permanent failure, temporary exclusion, or both? (The app
   carries marks forward within one setup version and asks before un-marking.)
3. **Subject id spelling.** Did any animal's recordings use a spelling the profile rule refuses (underscore,
   mixed case across days)?
4. **Effective dates.** Could they answer "when was this setup in effect?" from memory, or did they need
   their notes? How often was the "confirm this setup" notice right?

## 4. Exit criteria for this pilot (from FIX_PLAN "Pilot acceptance")

- Covered tasks (B, C, E) faster than the participant's current method for most participants — record the
  numbers, do not summarise them away.
- Zero unnoticed wrong-date, wrong-setup or copied-measurement errors in the sessions (an error the app
  caught and the participant fixed counts as caught; one the observer had to point out counts as missed).
- Every downloaded file grouped with its recordings and converted without renaming.
- Friction list written down before any new surface is started (bulk catch-up is next, not before).
