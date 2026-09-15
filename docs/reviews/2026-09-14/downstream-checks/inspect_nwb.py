from pynwb import NWBHDF5IO
import numpy as np, yaml
meta = yaml.safe_load(open("session/20230622_sample_metadata.yml"))
with NWBHDF5IO("out/sample20230622.nwb", "r") as io:
    nwb = io.read()
    s = nwb.subject
    print("SUBJECT", s.subject_id, s.species, s.sex, s.genotype, s.weight, s.date_of_birth)
    print("SESSION", nwb.session_id, nwb.session_description, nwb.experimenter, nwb.lab, nwb.institution)
    print("SESSION_START", nwb.session_start_time)
    et = nwb.electrodes.to_dataframe()
    print("ELECTRODES", len(et), "columns:", [c for c in et.columns if c in ("bad_channel","probe_shank","probe_electrode","ref_elect_id","group_name","location")])
    bad = et[et.bad_channel]
    print("BAD_CHANNELS rows:", len(bad), "groups:", sorted(set(bad.group_name)))
    print("YAML bad_channels:", [(n["ntrode_id"], n["bad_channels"]) for n in meta["ntrode_electrode_group_channel_map"] if n["bad_channels"]])
    print("ELECTRODE_GROUPS", len(nwb.electrode_groups), "vs yaml", len(meta["electrode_groups"]))
    print("DEVICES", sorted(nwb.devices.keys())[:8], "...")
    cams = [d for d in nwb.devices.values() if type(d).__name__ == "CameraDevice"]
    print("CAMERAS", [(c.name, getattr(c,'camera_name',None), c.meters_per_pixel) for c in cams])
    tasks = nwb.processing["tasks"] if "tasks" in nwb.processing else None
    if tasks:
        for name, t in tasks.data_interfaces.items():
            df = t.to_dataframe()
            print("TASK", name, df[["task_name","task_environment","camera_id","task_epochs"]].to_dict("records"))
    print("EPOCHS", nwb.epochs.to_dataframe()[["start_time","stop_time","tags"]].to_dict("records"))
    af = nwb.processing.get("associated_files")
    if af: print("ASSOCIATED", list(af.data_interfaces.keys()))
    dio = nwb.processing.get("behavior")
    if dio: print("BEHAVIOR interfaces", list(dio.data_interfaces.keys()))
    print("OPTO_EPOCHS", "optogenetic_epochs" in str(list(nwb.intervals.keys())) or list(nwb.intervals.keys()))
