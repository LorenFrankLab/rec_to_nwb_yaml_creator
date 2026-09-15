from pathlib import Path
from trodes_to_nwb.convert import create_nwbs, get_included_device_metadata_paths
session = Path(__file__).parent / "session"
out = Path(__file__).parent / "out"
create_nwbs(path=session, device_metadata_paths=get_included_device_metadata_paths(), output_dir=str(out), n_workers=1, query_expression="animal == 'sample'", fs_gui_dir=session)
print("DONE", sorted(p.name for p in out.iterdir()))
