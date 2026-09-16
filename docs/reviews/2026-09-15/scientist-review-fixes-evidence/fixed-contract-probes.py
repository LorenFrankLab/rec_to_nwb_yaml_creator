"""Actual converter checks on YAML downloaded through the corrected UI. Recording I/O is stubbed for the voltage paths."""
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from xml.etree import ElementTree as ET
import yaml
from trodes_to_nwb import convert_rec_header, convert_ephys
OUT = Path('/tmp/scientist-screen-review')
metadata = yaml.safe_load((OUT / 'fixed-first-recording.yml').read_text())
spike = ET.fromstring('<SpikeConfiguration><SpikeNTrode id="7">' + '<SpikeChannel/>' * 4 + '</SpikeNTrode></SpikeConfiguration>')
convert_rec_header.validate_yaml_header_electrode_map(metadata, spike)
assert metadata['ntrode_electrode_group_channel_map'][0]['map'] == {'0': 2, '1': 0, '2': 3, '3': 1}
assert all('statescript' in file['description'].lower() for file in metadata['associated_files'])
r = {'ntrode_header_check': 'passed', 'ntrode_id': 7, 'statescript_descriptions': [file['description'] for file in metadata['associated_files']], 'voltage': []}
class NWB:
    electrodes = SimpleNamespace(to_dataframe=lambda: {'hwChan': [0]})
    def create_electrode_table_region(self, **kw): return None
    def add_acquisition(self, series): self.series = series
for header_scale in [None, '0.195']:
    record = {'header_rawScalingToUv': header_scale, 'metadata_volts_per_count': metadata['raw_data_to_volts']}
    attribute = '' if header_scale is None else f' rawScalingToUv="{header_scale}"'
    header = ET.fromstring(f'<Configuration><SpikeConfiguration><SpikeNTrode id="7"{attribute}/></SpikeConfiguration></Configuration>')
    def iterator(*args, **kw):
        record['iterator_microvolts_per_count'] = kw['conversion']
        return SimpleNamespace(n_channel=1, timestamps=[])
    def series(**kw):
        record['series_volts_per_microvolt'] = kw['conversion']
        return kw
    with patch.object(convert_rec_header, 'read_header', return_value=header), patch.object(convert_ephys, 'RecFileDataChunkIterator', side_effect=iterator), patch.object(convert_ephys, 'H5DataIO', side_effect=lambda *a, **kw: None), patch.object(convert_ephys, 'ElectricalSeries', side_effect=series):
        convert_ephys.add_raw_ephys(NWB(), ['synthetic.rec'], [0], metadata=metadata)
    record['1000_counts_in_volts'] = 1000 * record['iterator_microvolts_per_count'] * record['series_volts_per_microvolt']
    assert abs(record['1000_counts_in_volts'] - 0.000195) < 1e-12
    r['voltage'].append(record)
(OUT / 'fixed-contract-probes.json').write_text(json.dumps(r, indent=2))
print(json.dumps(r, indent=2))
