# Phase 1 — `.trodesconf` parser (pure)

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts §1](shared-contracts.md#1-parsedtrodesconfig) · [appendix §1](appendix.md#1-trodesconf-xml-structure-trodes)

A total, dependency-free parser: `.trodesconf` XML string → `ParsedTrodesConfig`. No app types, no UI,
no workspace coupling — just the read side, fully unit-tested against real config fixtures.

**Inputs to read first:**

- [shared-contracts §1](shared-contracts.md#1-parsedtrodesconfig) — the exact `ParsedTrodesConfig` /
  `TrodesconfParseResult` shapes to produce.
- [appendix §1](appendix.md#1-trodesconf-xml-structure-trodes) — the XML element structure
  (`<SpikeNTrode>` nesting `<SpikeChannel hwChan>`; digital `<Channel id="Din1" input bit>`;
  `<SingleModuleConfiguration moduleName="cameraModule">`); board-dependent `Din*` vs `MCU_Din*`.
- `trodes/Resources/SampleWorkspaces/*.trodesconf` — the real configs to copy as fixtures.

**Contracts referenced:** [`ParsedTrodesConfig`](shared-contracts.md#1-parsedtrodesconfig) — this phase
is its sole producer.

## Tasks

- **New pure module `src/state/trodesconfParse.ts`** exporting
  `parseTrodesconf(xml: string): TrodesconfParseResult`. Use the browser-native `DOMParser`
  (`new DOMParser().parseFromString(xml, 'application/xml')`); detect a parse failure via a
  `<parsererror>` node and return `{ ok: false, error }` (never throw). The module is otherwise pure
  (no DOM globals beyond `DOMParser`, which jsdom/vitest provides).
- **ntrodes:** select every `<SpikeNTrode>` (in document order); for each, read `id` (Number),
  `refNTrodeID`/`refChan` (Number, optional — `refNTrodeID <= 0` ⇒ omit), and its nested
  `<SpikeChannel>` elements → `channelCount = count`, `hwChans = [Number(hwChan)…]` in order.
- **dio:** select `<Channel dataType="digital">`; resolve `direction` **exactly per**
  [shared-contracts §1](shared-contracts.md#1-parsedtrodesconfig): if an `input` attr is present,
  `input="1"`⇒`in`, **`input="0"` (or any non-`1`)⇒`out`** (matching `convert_dios.py`); **else** (no
  `input` attr — e.g. `BlankWorkspace.trodesconf`'s `Controller_Din*`) by id token **after stripping a
  leading `ECU_`/`MCU_`/`Controller_` prefix**: `…Din…`⇒`in`, `…Dout…`⇒`out`; else `'unknown'`. **Never
  treat a missing `input` as output.** Preserve board-native ids **verbatim** (`Din1`, `ECU_Din1`,
  `ECU_Dout1`, `MCU_Din3`, `Controller_Din1`, `Dout2`). De-duplicate by `id`.
- **header metadata:** read `numChannels` + `samplingRate` from `<HardwareConfiguration>` (or
  `<GlobalOptions>` in older configs — check both) as Numbers; absent → omit. (`numChannels` powers the
  Phase 2 integrity check; `samplingRate` is provenance only.)
- **systemHint / sourceName:** best-effort `systemHint` from the presence of `MCU_*` ids (MCU) vs
  `Din*`/ECU markers vs default `SpikeGadgets`; `sourceName` is passed in by the caller (the upload file
  name) — accept it as a second arg `parseTrodesconf(xml, sourceName='')`.
- **Robustness (total parser):** empty string, non-XML, XML with no `<SpikeNTrode>`, MCU-only configs,
  and configs with no digital channels each return a well-formed result (`ok:false` with a clear message
  for unparseable input; `ok:true` with empty `ntrodes`/`dio` for structurally-valid-but-sparse input).
  No uncaught throw reaches a caller.
- **No app-facing docs needed** (internal module); add a module-level docstring describing the shape and
  that `hwChans`/refs are reference-only (not written to YAML).

## Deliberately not in this phase

- Any mapping to app types (`ProbeConfiguration`/`ElectrodeGroup`/`NtrodeMap`) — that's
  [Phase 2](phase-2-plan.md).
- `device_type`/geometry inference, the count↔device_type check, the diff — Phase 2.
- Reading the config out of a `.rec` binary — out of scope ([overview Non-Goals](overview.md#non-goals)).
- Any UI / file upload — [Phase 5](phase-5-ui.md).

## Validation slice

| Test | Asserts |
| --- | --- |
| `trodesconfParse` — real tetrode config | `128_Tetrodes_ECU_Sensors.trodesconf` → 32 ntrodes, each `channelCount === 4`, `hwChans` length 4; `ntrodes[0].id === 1`. |
| `trodesconfParse` — DIO inventory | ECU config → `Din*`/`Dout*` with correct `direction`; MCU sample → `MCU_Din*`; `BlankWorkspace`'s `Controller_Din*` (no `input` attr) → `direction:'in'` via the id token (NOT `'out'`); ids kept verbatim; de-duped. |
| `trodesconfParse` — refs | an ntrode with `refNTrodeID="1" refChan="1"` parses both; `refNTrodeID="0"` ⇒ omitted. |
| `trodesconfParse` — malformed/empty | `''`, `'<not-xml'`, and `'<Configuration/>'` return `{ok:false}` / `{ok:true, ntrodes:[], dio:[]}` respectively; never throws. |
| `trodesconfParse` — multi-shank counts | a probe config with N-channel ntrodes reports the real per-ntrode counts (not assumed 4). |
| `trodesconfParse` — header metadata | `numChannels`/`samplingRate` read from `<HardwareConfiguration>` (and from `<GlobalOptions>` in the older `Config128_FSGui.trodesconf` shape); absent → omitted, not `0`. |

## Fixtures

Copy real `.trodesconf` files into the test fixtures dir, spanning the board/id variants so the DIO
direction + id rules are exercised: from `trodes/Resources/SampleWorkspaces/` a tetrode+ECU config, an
MCU-only config, `BlankWorkspace.trodesconf` (`Controller_Din*`, **no `input` attr**), and a
multi-shank/probe config; **and** from `trodes_to_nwb/src/trodes_to_nwb/tests/test_data/` (e.g.
`reconfig_probeDevice.trodesconf`) for `ECU_Din*`/`ECU_Dout*` + a real probe layout. Add a hand-written
malformed snippet inline. The committed configs are the real data (no separate real-data slice).

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- Parser is total (the malformed/empty/sparse tests prove no throw escapes).
- Output matches [`ParsedTrodesConfig`](shared-contracts.md#1-parsedtrodesconfig) exactly; `hwChans`/refs
  are parsed but documented as reference-only.
- Direction matches §1 (`input="0"`⇒out; missing `input`⇒id-token); all id variants handled (`Din*`,
  `ECU_Din*`/`ECU_Dout*`, `MCU_Din*`, `Controller_Din*`), kept verbatim.
- No app-type coupling; no plan/phase references in code or test names.
