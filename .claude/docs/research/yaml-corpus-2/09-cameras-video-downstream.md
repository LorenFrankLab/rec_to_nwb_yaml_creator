# Cameras & Video: data model across YAML → trodes_to_nwb → NWB → Spyglass

Scope: how `cameras[]`, `tasks[].camera_id`, and `associated_video_files[]` in the
rec_to_nwb_yaml_creator YAML become NWB objects and then Spyglass rows, with primary keys,
join keys, and every silent-break point. All citations are to the local readable checkouts.

---

## 0. The data model in words (diagram)

```
YAML cameras[ {id, camera_name, meters_per_pixel, manufacturer, model, lens} ]
   │  add_cameras()  (trodes_to_nwb/convert_yaml.py:127-154)
   │    NWB device.name  = "camera_device {id}"     ← keyed by id
   │    NWB camera_name  = camera_name              ← carries identity downstream
   ▼
NWB ndx_franklab_novela.CameraDevice  (name="camera_device {id}", camera_name=…, meters_per_pixel=…, lens=…, model→DeviceModel{manufacturer})
   │  CameraDevice.make ingest (spyglass/common/common_device.py:290-331)
   ▼
Spyglass common_device.CameraDevice
        PK = camera_name (varchar 80)               ← GLOBAL, lab-wide namespace
        secondary: meters_per_pixel, manufacturer, model, lens, camera_id(=int parsed from name)


YAML tasks[ {task_name, task_description, task_environment, camera_id:[…], task_epochs:[…]} ]
   │  add_tasks()  (convert_yaml.py:361-414) → DynamicTable "task_i" in processing["tasks"]
   ▼
NWB tasks DynamicTable (columns: task_name, task_description, camera_id, task_epochs, task_environment)
   │  TaskEpoch.make  (spyglass/common/common_task.py:206-312)
   │    camera_id (int)  →  device "camera_device {id}".camera_name   (lookup, common_task.py:219-223)
   │    task_epochs (int) → epoch → interval_list_name (get_epoch_interval_name)
   ▼
Spyglass common_task.TaskEpoch
        PK = (nwb_file_name[Session], epoch)
        FK = Task(task_name), CameraDevice(camera_name nullable), IntervalList(interval_list_name)
        blob camera_names = [ {camera_name:…}, … ]   ← the FULL camera list for the task


YAML associated_video_files[ {name, camera_id:int(scalar), task_epochs:int(scalar)} ]
   │  add_associated_video_files()  (trodes_to_nwb/convert_position.py:1204-1305)
   │    device = nwb_file.devices["camera_device {camera_id}"]   ← HARD lookup, line 1291-1293
   │    timestamps from epoch's .cameraHWSync; ImageSeries.name = video name
   ▼
NWB ImageSeries (device → CameraDevice, external_file=[…], timestamps=…) under processing["video_files"]/BehavioralEvents "video"
   │  VideoFile.make  (spyglass/common/common_behav.py:451-819)
   │    epoch via TaskEpoch (FK)  ;  camera via video_obj.device.camera_name  (common_behav.py:502-509)
   │    timestamp-overlap gate ≥0.9 vs the epoch's IntervalList valid_times (common_behav.py:475,588)
   ▼
Spyglass common_behav.VideoFile
        PK = (nwb_file_name, epoch)[TaskEpoch] + video_file_num
        secondary: camera_name, video_file_object_id
```

---

## 1. CameraDevice identity / uniqueness in Spyglass

**PK = `camera_name`** (single varchar(80)), declared at
`spyglass/src/spyglass/common/common_device.py:291-300`:

```python
@schema
class CameraDevice(SpyglassIngestion, dj.Manual):
    definition = """
    camera_name: varchar(80)
    ---
    meters_per_pixel = 0: float  # height / width of pixel in meters
    manufacturer = "": varchar(2000)
    model = "": varchar(2000)
    lens = "": varchar(2000)
    camera_id = -1: int
    """
```

- **It is GLOBAL across all sessions / animals / rigs** — `camera_name` is the entire primary key;
  there is no `nwb_file_name` or session in it. The schema name is `common_device`
  (`common_device.py:18`), so one `CameraDevice` table is shared by the whole DataJoint database.
- **Fields carried:** `meters_per_pixel` (the pixel→meter calibration), `manufacturer`, `model`,
  `lens`, and a derived `camera_id` (int parsed out of the NWB device *name* string by
  `get_camera_id`, `common_device.py:323-331` — `-1` if the name has no integer). There is **no
  `meta_file_path` field** on CameraDevice; calibration lives entirely in `meters_per_pixel`
  (Spyglass DLC/position uses `meters_per_pixel` for px→cm scaling — that is the calibration that
  goes wrong if the name is reused). The "meta_file_path" notion in the prompt does not exist on
  this table; the calibration that matters here is `meters_per_pixel`.
- **Reusing a generic name like `"camera 1"` across rigs/animals MERGES into one row.** Because the
  PK is just the name and `_expected_duplicates = True` (`common_device.py:302`), a second file that
  ships the same `camera_name` does **not** create a second row — it resolves to the existing one
  (see §2 for what happens to the differing settings). So `camera 1` on rig A and `camera 1` on rig
  B are the **same `CameraDevice` row with one calibration**. They collide; they do not coexist.

> Note the deliberate split: the **NWB device name** `"camera_device {id}"` is per-file and id-keyed
> (used for in-file dereferencing of videos/tasks), but the **Spyglass identity** is `camera_name`,
> which is global. The id is only a within-file handle; `camera_name` is the durable identity.

---

## 2. The zoom / position → new-name requirement — REAL

**Yes, it is real, and it is a `meters_per_pixel`-correctness requirement.** A physical camera
re-zoomed or repositioned has a *different pixel→meter calibration* (`meters_per_pixel`), so it is
"a different device" for analysis. If you keep the **same `camera_name`** but change
`meters_per_pixel`, here is exactly what happens on the second ingest:

Ingest path: `CameraDevice` inherits `SpyglassIngestion`; with `_expected_duplicates = True` the
insert routes through `validate_duplicates` → `validate1_duplicate`
(`spyglass/src/spyglass/utils/mixins/ingestion.py:281-282, 367-444`):

1. The new entry's PK (`camera_name`) is looked up. A row already exists (same name)
   → `existing = query.fetch1()` (`ingestion.py:422-425`).
2. Every field is compared (`ingestion.py:427-429`, case-insensitive for strings via
   `_unequal_vals`, `ingestion.py:447-452`). `meters_per_pixel` differs.
3. The differing field is handed to `accept_divergence`
   (`ingestion.py:430-436`, `utils/dj_helper_fn.py:679`):
   - **Non-interactive / `test_mode` → returns `False` → raises `dj.errors.DuplicateError`**
     (`ingestion.py:439-442`). The conversion/ingest **fails loudly**.
   - **Interactive, user types "yes" (accept existing) → returns; `validate1_duplicate` returns
     `None` → nothing is inserted (`ingestion.py:444`).** The **existing (first-written)
     calibration is silently kept**; the new `meters_per_pixel` is discarded. This is
     **first-write-wins**: every later session that reused the name now points at a `CameraDevice`
     whose `meters_per_pixel` is whatever the *first* file wrote — i.e. **silently wrong
     calibration** for the re-zoomed sessions, with no row reflecting the new settings.

**So:** re-zoom with the same name ⇒ either a hard `DuplicateError` (batch/test mode) or a
silent-wrong-calibration first-write-wins merge (interactive accept). The remedy enforced by the
schema is exactly the user's point: **a re-zoomed/repositioned camera needs a NEW distinct
`camera_name`** so it gets its own row and its own `meters_per_pixel`. The CameraDevice insert logic
does not *force* unique-per-settings; it only *detects* divergence and then either fails or keeps
the first. There is no field that records "settings revision" — only the name distinguishes devices.

---

## 3. Video → task → epoch linkage chain (and where it silently breaks)

Trace of one `associated_video_files[]` entry `{name, camera_id, task_epochs}`:

**A. YAML → NWB** (`trodes_to_nwb/convert_position.py:1204-1305`):
- `epoch = video_metadata["task_epochs"][0]` (load_metadata wraps the scalar into a 1-list,
  `convert_yaml.py:69-71`).
- Video file is matched on `name` prefix against `.h264`/`.mp4` paths in `session_df`
  (`convert_position.py:1248-1260`) — **FileNotFoundError if no file matches the name** (1257-1260).
- Timestamps come from the epoch's `.cameraHWSync` file (`convert_position.py:1265-1282`) —
  **ValueError if no cameraHWSync for that epoch** (1271-1274).
- **Camera link (the join):** `device = nwb_file.devices["camera_device " + str(camera_id)]`
  (`convert_position.py:1291-1293`). **This is a hard dict index — `KeyError` if `camera_id` is not
  in `cameras[]`** (no `camera_device {id}` device was created). This is the dangling-camera_id
  crash point.

**B. NWB → Spyglass `VideoFile`** (`common_behav.py:451-819`):
- `VideoFile` FK's `TaskEpoch` (`common_behav.py:467`), so **a video can only import for an epoch
  that already has a TaskEpoch row** (Issue #1444; if no TaskEpoch exists the videos are reported
  as orphaned, `common_task.py:386-416`, and nothing imports).
- Camera join: `camera_name = video_obj.device.camera_name`; if that name is not in `CameraDevice`,
  `_prepare_video_entry` **raises `KeyError`** (`common_behav.py:502-509`) — caught per-video into
  `failed_videos["missing_camera"]` and **logged, not raised** (`common_behav.py:728-739, 806-812`).
  So a missing CameraDevice → the video is **silently skipped** (warning only).
- Epoch join: the epoch's `interval_list_name` comes from `TaskEpoch` (`common_behav.py:692`); the
  video's timestamps must overlap that interval ≥ `_timestamp_overlap_threshold = 0.9`
  (`common_behav.py:475, 569-604`). **Below threshold → the video is dropped** (logged as a
  timestamp mismatch, `common_behav.py:761-804`). An epoch number that points at the *wrong* epoch
  still parses but fails the overlap test → silent drop.

**Join keys summary:**
- video → camera: `associated_video_files[].camera_id` → NWB `camera_device {id}` →
  `device.camera_name` → `CameraDevice.camera_name`.
- video → epoch: `associated_video_files[].task_epochs` (int) → `TaskEpoch.epoch` →
  `IntervalList.interval_list_name` → timestamp overlap.

**Silent / hard break points:**

| Break | Where | Failure mode |
|---|---|---|
| `camera_id` not in `cameras[]` | convert_position.py:1291-1293 | **Hard `KeyError`** (conversion crash) |
| video `name` matches no .h264/.mp4 | convert_position.py:1257-1260 | **Hard FileNotFoundError** |
| no `.cameraHWSync` for the epoch | convert_position.py:1271-1274 | **Hard ValueError** |
| `task_epochs` matches no TaskEpoch | common_behav.py:467; common_task.py:386-416 | Video **silently not imported** (warning) |
| `camera_name` not in CameraDevice (e.g. name typo, name never ingested) | common_behav.py:502-509, 728-739 | Video **silently skipped** (`missing_camera` warning) |
| timestamps overlap < 0.9 with epoch | common_behav.py:588-604, 761-804 | Video **silently dropped** (`timestamp_mismatch`) |

---

## 4. How tasks reference cameras

- YAML `tasks[].camera_id` is an **array** of ints (schema: `tasks/items/camera_id` is
  `type: array` of unique ints). It becomes the NWB tasks DynamicTable `camera_id` column
  (`convert_yaml.py:387-391`, stored as a list-per-row).
- Spyglass `TaskEpoch.make` (`common_task.py:206-312`):
  - Builds `camera_names = {camera_id_int → camera_name}` by walking the NWB CameraDevices and
    parsing the int out of `device.name` (`split()[1]`, `common_task.py:219-223`).
  - `_get_valid_camera_names` (`common_task.py:137-169`) keeps only the `camera_id`s that exist in
    that map, returns `[{camera_name:…}, …]`, and writes them to the `camera_names` **blob** column
    of `TaskEpoch` (`common_task.py:262-269, 134`). `TaskEpoch` also has a single scalar
    `-> [nullable] CameraDevice` FK (`common_task.py:131`) — the blob is the full list, the FK is
    one (nullable) camera.
- **If a task lists a `camera_id` with no matching `cameras[].id`:** that id is filtered out by
  `_get_valid_camera_names`. If **all** of the task's ids are unknown, it logs
  `"No camera device found with ID …"` (`common_task.py:165-168`) and **omits `camera_names`**
  (the TaskEpoch still imports, just without that camera link) — a **silent** loss of the camera
  association, not a crash. (Contrast §3: a *video* with the same bad id crashes at convert time.)

---

## 5. Other fragile / surprising things

1. **`camera_id` is a within-file handle; `camera_name` is the durable identity.** The id keys the
   NWB device name and all in-file dereferencing; `camera_name` keys the global Spyglass row. The
   app's existing guards (`cameraIdUniqueness`, `danglingCameraReferences`,
   `src/validation/rules/referenceRules.ts:365-394, 74-132`) enforce **id** integrity *within a
   file* but say **nothing about `camera_name`** — yet the cross-session/cross-rig collision and the
   zoom→wrong-calibration failure are **`camera_name` problems**. This is the gap.

2. **Asymmetry: array vs scalar `camera_id`.** `tasks[].camera_id` is an array; both
   `associated_video_files[].camera_id` and `fs_gui_yamls[].camera_id` are **scalar ints** (schema
   `associated_video_files/items/camera_id` `type: integer`). The app already handles this
   asymmetry (`referenceRules.ts:46-51, 108-129`); easy to get wrong in new code.

3. **Same id, different name across cameras in one file is legal in YAML but corrupts downstream.**
   Two `cameras[]` rows can share an `id` (caught by `cameraIdUniqueness`,
   `referenceRules.ts:365-394`) — needed because `add_cameras` names the NWB device
   `"camera_device {id}"`, so duplicate ids overwrite each other's device and every video/task
   pointing at that id resolves to whichever survived.

4. **Camera-name capitalization / whitespace is identity.** `_unequal_vals` compares strings
   **case-insensitively** (`ingestion.py:447-452`), but the PK itself is the literal string — so
   `"Camera 1"` vs `"camera 1"` are *different rows* on insert (different PK) yet would be flagged as
   "divergent" only when the PKs happen to collide. Inconsistent camera names fragment the global
   namespace exactly like brain-region names do for `BrainRegion`.

5. **`get_camera_id` needs an integer in the name.** Spyglass derives the secondary `camera_id` by
   pulling the first numeric token out of the NWB device name (`common_device.py:323-331`); the
   converter always names it `"camera_device {id}"`, so this works — but a hand-edited NWB or a
   non-numeric id would set `camera_id = -1` with only a warning.

---

## What the app must guard (cameras/videos)

1. **`camera_name` global-uniqueness *and* zoom/position discipline (NEW — current gap).** Warn
   when two `cameras[]` rows share a `camera_name` but differ in `meters_per_pixel` (or
   manufacturer/model/lens): downstream that is a first-write-wins collision or a `DuplicateError`.
   Encourage a **new distinct `camera_name`** whenever zoom/position/calibration changes, since
   `meters_per_pixel` is the calibration and `camera_name` is the only thing that distinguishes
   devices. Across-day/across-animal name reuse with different calibration is the silent-wrong-data
   case.
2. **`camera_id` uniqueness within a file** — already guarded (`cameraIdUniqueness`).
3. **Every `tasks[].camera_id`, scalar `associated_video_files[].camera_id`, and
   `fs_gui_yamls[].camera_id` resolves to a `cameras[].id`** — already guarded
   (`danglingCameraReferences`, `fsGuiReferences`). A dangling video id is a **hard convert crash**
   (KeyError); a dangling task id is a silent camera-link loss.
4. **Every video/file `task_epochs` matches a defined task epoch, and task epochs are unique** —
   already guarded (`taskEpochReferences`): an orphaned video is silently dropped, and duplicate
   epochs collide on the `TaskEpoch` (session, epoch) PK.
