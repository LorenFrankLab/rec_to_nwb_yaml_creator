# Scientist walkthrough evidence

Reviewed app commit: `5c053415`. See [the report](../SCIENTIST_SCREEN_REVIEW.md) for findings, reproduction steps and limits.

All workspace records here come from isolated browser review sessions. The source metadata files were read, not edited. Screenshot names describe the capture stage; names such as `29-day-complete` and `48-import-ready-export` do **not** assert that export was working at those stages.

## Captures

- `01`–`16`: empty workspace and all seven manual setup steps.
- `17`–`31`: first historical recording, configuration confirmation, templates, generation and the statescript repair dead end.
- `32`–`42`: failed channels, DIO, follow-up creation, room reset and phone daily/epoch views.
- `43`–`48`: import repair and the warning-only export blocker.
- `50`–`54`: profile correction, successful download and a post-download weight correction.
- `55`–`60`: configuration change dialog, animal optogenetics, validation and phone setup.

Text and JSON records accompany the retained captures. Only selected full-page PNGs are included. JSON contains viewport/page dimensions, automated axe results where run, and observed application page exceptions. It does not record every browser-driver selector retry.

## Persisted state and checks

- `first-day-generated.json`: the manually entered animal/day after file generation, including the two blank statescript descriptions.
- `followup-workspace.json`: initial next-day state, before correcting its failed-channel mark.
- `manual-final-workspace.json` and `followup-correction-check.json`: confirm the earlier day retains Room B and channel 2 while the later day uses its default context and has the channel explicitly unmarked. The DIO mapping is present on the later day.
- `import-final-workspace.json` and `warning-gate-probe.json`: warning-only imported day with the overview prerequisite incorrectly in error.
- `import-corrected-workspace.json`: after correcting the sample subject token and downloading.
- `20230622_sample_metadata.yml`: the actual downloaded file. This is a test artifact; three no-video declarations and a path correction were made to exercise the UI, not to characterize the real experiment.
- `download-validation.json`: local converter metadata validation of that downloaded file, including the retained task definitions and voltage constant.
- `contract-probes.py` / `contract-probes.json`: calls to the real converter's ntrode validator and raw-ephys function. The latter stubs raw-recording I/O and NWB construction to capture unit conversions. This is not a full NWB conversion.

To rerun the converter probes in the original environment:

```sh
/Users/edeno/Documents/GitHub/trodes_to_nwb/.venv/bin/python docs/reviews/2026-09-15/scientist-screen-review-evidence/contract-probes.py
```

The probe requires the local converter and the supplied sample recording path. It reads the archived manually created workspace and rewrites only its result JSON. Browser interactions are documented in the report's reproduction steps; these captures are evidence, not a new screenshot baseline.
