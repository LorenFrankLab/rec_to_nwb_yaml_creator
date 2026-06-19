# Appendix — upstream `.trodesconf` format + trodes_to_nwb consumer

[← back to PLAN.md](PLAN.md)

Authoritative behavior the plan is built against. Both repos are local + readable
(`/Users/edeno/Documents/GitHub/{trodes,trodes_to_nwb}`); re-verify against these commits, and re-read
if the executor's checkout differs.

- **trodes** @ `54ee715` (the SpikeGadgets acquisition app; produces the `.trodesconf`).
- **trodes_to_nwb** @ `65ec81a` (`fix/170-data-scanner-robust-parsing`; consumes YAML + `.rec`).

## 1. `.trodesconf` XML structure (trodes)

Sample files: `trodes/Resources/SampleWorkspaces/*.trodesconf` (e.g.
`128_Tetrodes_ECU_Sensors.trodesconf`, `128_Tetrodes_NoECU_Sensors_PTPcamera.trodesconf`) — copy 2–3 as
Phase 1 fixtures.

Relevant elements (verified against `128_Tetrodes_ECU_Sensors.trodesconf`):

```xml
<Configuration>
  <HardwareConfiguration ...>
    <Device name="MCU_IO" .../>            <!-- hardware sub-devices, NOT data_acq_device metadata -->
    <Channel dataType="digital" id="Din1"  input="1" bit="0"/>   <!-- DIO inventory; ECU board -->
    <Channel dataType="digital" id="MCU_Din1" input="1" bit="0"/><!-- MCU board variant of the ids -->
    ...
  </HardwareConfiguration>
  <ModuleConfiguration>
    <SingleModuleConfiguration moduleName="cameraModule" .../>   <!-- camera only noted as "loaded";
                                                                      NO camera_name/coords/meters -->
  </ModuleConfiguration>
  <SpikeConfiguration>
    <SpikeNTrode id="1" refNTrodeID="1" refChan="1" ...>          <!-- one ntrode; refs are HW -->
      <SpikeChannel hwChan="57" .../>                             <!-- 4 nested channels = a tetrode -->
      <SpikeChannel hwChan="59" .../>
      <SpikeChannel hwChan="61" .../>
      <SpikeChannel hwChan="63" .../>
    </SpikeNTrode>
    ... (32 SpikeNTrode for 128 tetrode channels)
  </SpikeConfiguration>
</Configuration>
```

Key facts:

- `<SpikeChannel>` are **nested inside** `<SpikeNTrode>`; the ntrode's channel **count** = number of
  nested `<SpikeChannel>`, and their ordered `hwChan` is the hardware channel list.
- The config has **no** `device_type`, brain `location`, stereotax coordinates, camera metadata, or
  behavioral-event names — only the hardware skeleton (verified: a grep for `device_type|location|
  rel_x|targeted|probe` on the sample returns nothing).
- Digital `<Channel>` ids are **board-dependent**: `Din*`/`Dout*` (ECU) vs `MCU_Din*` (MCU-only). The
  parser tolerates both.
- The recording (`.rec`) filename — and therefore the statescript/video base names — is
  experimenter-chosen; Trodes imposes no token template (`trodes/Trodes/src-main/mainWindow.cpp:3255`).
  Not used by this importer, noted for context.

## 2. trodes_to_nwb consumer (the channel-map contract) {#2-trodes_to_nwb-consumer}

`trodes_to_nwb/src/trodes_to_nwb/`:

- **`convert_rec_header.py:116-142`** `validate_metadata` — for each `<SpikeNTrode>` in the `.rec`
  header: missing matching `ntrode_id` → `KeyError` (`:128`); **`len(header group) != len(map)` →
  `ValueError`** (`:129-132`); fewer header ntrodes than YAML → `IndexError` (`:137-140`).
- **`convert_rec_header.py:145-182`** `make_hw_channel_map` — builds `{nwb_group_id →
  {nwb_electrode_id → hwChan}}`: `nwb_electrode_id = channel_map["map"][str(config_electrode_id)]`
  (`:178`, key = 0-based position in the header ntrode), `hwChan` from `channel.attrib["hwChan"]`
  (`:179-181`, from the `.rec`, not the YAML).
- **`convert_rec_header.py:185-236`** `make_ref_electrode_map` — references come from the header
  (`refNTrodeID`/`refChan`, `:214-230`), resolved through the YAML `map`; **not** stored in the YAML.
- **`convert_yaml.py:248-296`** — electrode table built by iterating `probe_meta["shanks"]` →
  `electrodes` with `rel_x/y/z` (geometry from the **`device_type` `probe_metadata`**); `hwChan` looked
  up via `hw_channel_map[group][str(electrode_meta["id"])]` (`:281-283`). ⇒ `device_type` is required to
  build electrodes; `map` value = probe-electrode id.
- **`metadata_validation.py`** — `validate(metadata)` returns `(is_valid, errors)` (`:77`) against the
  bundled `nwb_schema.json`; per the project's pipeline notes it **logs, does not raise** — so the app
  (this importer included) is the real gate. Do not rely on it to catch a bad import.

**Net:** the YAML's job for channels is `ntrode_id` + `electrode_group_id` + a `map` whose **length**
matches the header and whose **values** are probe-electrode ids (from `device_type`). The importer owns
the first two + the length; `device_type` owns the values; the `.rec` owns `hwChan`/refs.
