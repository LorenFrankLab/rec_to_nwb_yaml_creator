import os, sys
from pathlib import Path
base = Path(__file__).parent / "tests" / "spyglass_base"
os.environ["SPYGLASS_BASE_DIR"] = str(base)
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
import datajoint as dj
# Disposable database ONLY: a fresh container on port 3399; the user's dj_local_conf.json is not in cwd.
dj.config.update({"database.host": "localhost", "database.port": 3399, "database.user": "root", "database.password": "tutorial", "safemode": False, "custom": {"test_mode": True, "debug_mode": False, "spyglass_dirs": {"base": str(base)}}})
assert dj.config["database.port"] == 3399
dj.conn()
from spyglass.data_import import insert_sessions
from spyglass.common import Session, Subject, Electrode, ElectrodeGroup, CameraDevice, Task, TaskEpoch, IntervalList, DataAcquisitionDevice, Probe, BrainRegion, DIOEvents
insert_sessions(["sample20230622.nwb"], raise_err=True)
print("SESSION", Session().fetch(as_dict=True))
print("SUBJECT", Subject().fetch(as_dict=True))
print("DATA_ACQ", DataAcquisitionDevice().fetch("data_acquisition_device_name"))
print("PROBE", Probe().fetch("probe_id"))
print("BRAIN_REGION", BrainRegion().fetch("region_name"))
print("ELECTRODE_GROUPS", len(ElectrodeGroup()), "ELECTRODES", len(Electrode()), "probe_id nulls:", len(ElectrodeGroup & 'probe_id IS NULL'))
el = (Electrode() & 'bad_channel = "True"').fetch(as_dict=True)
print("BAD_ELECTRODES", [(e["electrode_group_name"], e["probe_electrode"], e["bad_channel"]) for e in el])
print("CAMERAS", CameraDevice().fetch("camera_name"))
print("TASKS", Task().fetch("task_name", "task_description"))
print("TASK_EPOCHS", TaskEpoch().fetch("epoch", "task_name", "camera_names", as_dict=True))
print("DIO", DIOEvents().fetch("dio_event_name"))
print("INTERVALS", IntervalList().fetch("interval_list_name")[:10])
