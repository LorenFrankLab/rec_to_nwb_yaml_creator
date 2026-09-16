import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from xml.etree import ElementTree as ET
from trodes_to_nwb import convert_rec_header, convert_ephys
OUT = Path(__file__).resolve().parent
w = json.loads((OUT / 'first-day-generated.json').read_text())
a = w['animals']['UxRat01']
spike = ET.fromstring('<SpikeConfiguration><SpikeNTrode id="7"><SpikeChannel/><SpikeChannel/><SpikeChannel/><SpikeChannel/></SpikeNTrode></SpikeConfiguration>')
r = {'ntrode': {'generated_ids': [m['ntrode_id'] for m in a['devices']['ntrode_electrode_group_channel_map']], 'header_id': 7}}
try:
    convert_rec_header.validate_yaml_header_electrode_map(a['devices'], spike)
    r['ntrode']['result'] = 'passed'
except Exception as e:
    r['ntrode']['result'] = f'{type(e).__name__}: {e}'
# Invoke the real converter function. Only recording I/O and NWB object creation are stubbed.
class NWB:
    electrodes = SimpleNamespace(to_dataframe=lambda: {'hwChan': [0]})
    def create_electrode_table_region(self, **kw): return None
    def add_acquisition(self, series): self.series = series
r['voltage'] = []
for raw in [a['technicalDefaults']['raw_data_to_volts'], 1.95e-7]:
    record = {'metadata_raw_data_to_volts': raw}
    header = ET.fromstring('<Configuration><SpikeConfiguration><SpikeNTrode id="7"/></SpikeConfiguration></Configuration>')
    def iterator(*args, **kw):
        record['iterator_conversion_microvolts_per_count'] = kw['conversion']
        return SimpleNamespace(n_channel=1, timestamps=[])
    def series(**kw):
        record['electrical_series_conversion_volts_per_microvolt'] = kw['conversion']
        return kw
    with patch.object(convert_rec_header, 'read_header', return_value=header), patch.object(convert_ephys, 'RecFileDataChunkIterator', side_effect=iterator), patch.object(convert_ephys, 'H5DataIO', side_effect=lambda *a,**kw: None), patch.object(convert_ephys, 'ElectricalSeries', side_effect=series):
        convert_ephys.add_raw_ephys(NWB(), ['synthetic.rec'], [0], metadata={'raw_data_to_volts': raw})
    r['voltage'].append(record)
r['voltage_ratio'] = r['voltage'][0]['iterator_conversion_microvolts_per_count'] / r['voltage'][1]['iterator_conversion_microvolts_per_count']
real_header = convert_rec_header.read_header('/Users/edeno/Downloads/trodes_to_nwb_test_data/20230622_sample_01_a1.rec')
r['sample_header_ids'] = [x.attrib['id'] for x in real_header.find('SpikeConfiguration')]
(OUT / 'contract-probes.json').write_text(json.dumps(r, indent=2))
print(json.dumps(r, indent=2))
