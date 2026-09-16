import { useState } from 'react';
import { Modal } from '../../components/Modal';
import Button from '../../components/ui/Button';
import { channelBounds, uniqueNtrodeIds, duplicateChannelMappings } from '../../validation/rules/channelMapRules';
import { compareTrodesHeader, parseTrodesHeader } from '../../domain/trodesHeaderMapping';
import type { HeaderNtrode } from '../../domain/trodesHeaderMapping';
import type { ElectrodeGroup, NtrodeMap } from '../../state/workspaceTypes';
import styles from './ChannelMappingModal.module.css';

interface Props {
  maps: NtrodeMap[];
  groups: ElectrodeGroup[];
  version?: number;
  dayCount: number;
  onClose: () => void;
  onSave: (maps: NtrodeMap[]) => void;
}

/** Draft mapping changes are reviewed as a whole before changing the configuration. */
export default function ChannelMappingModal({ maps, groups, version, dayCount, onClose, onSave }: Props) {
  const [rows, setRows] = useState(() => maps.map((map) => ({
    id: String(map.ntrode_id), channels: Object.keys(map.map).sort((a, b) => Number(a) - Number(b)).map((key) => map.map[key]).join(', '),
  })));
  const [header, setHeader] = useState<{ name: string; rows: HeaderNtrode[] } | null>(null);
  const [fileError, setFileError] = useState('');
  const parsed = rows.map((row, index) => ({
    ...maps[index], ntrode_id: Number(row.id),
    map: Object.fromEntries(row.channels.split(',').map((value, channel) => [String(channel), Number(value.trim())])),
  }));
  const syntaxErrors = rows.flatMap((row, index) => {
    const errors = [];
    if (!/^\d+$/.test(row.id) || !Number.isSafeInteger(Number(row.id))) errors.push(`Row ${index + 1}: enter a nonnegative integer Trodes ntrode ID.`);
    if (!/^\s*\d+(\s*,\s*\d+)*\s*$/.test(row.channels)) errors.push(`Row ${index + 1}: enter comma-separated probe electrode IDs.`);
    return errors;
  });
  const model = { electrode_groups: groups, ntrode_electrode_group_channel_map: parsed };
  const errors = syntaxErrors.length ? syntaxErrors : [
    ...uniqueNtrodeIds(model), ...duplicateChannelMappings(model), ...channelBounds(model),
  ].map((issue) => issue.message);
  const comparison = header ? compareTrodesHeader(header.rows, parsed) : [];
  const canSave = errors.length === 0 && comparison.length === 0 && !fileError;
  return (
    <Modal isOpen onClose={onClose} title="Trodes channel mapping" titleId="channel-mapping-title" className={styles.dialog}
      footer={<div className="form-actions">
        <Button variant="neutral" onClick={onClose}>Cancel</Button>
        <Button disabled={!canSave} onClick={() => onSave(parsed)}>Save channel mapping</Button>
      </div>}>
      <p>This corrects configuration {version ? `v${version}` : 'in setup'} and {dayCount} recording days using it.
        For a physical hardware change, cancel and create a new configuration first.</p>
      <p>Use the ntrode IDs in the recording’s Trodes configuration. Each comma-separated value is a
        probe electrode ID, in local channel order: <code>2, 0, 3, 1</code> means channel 0 → electrode 2,
        channel 1 → electrode 0, and so on. These are not global hardware channel numbers.</p>
      <label className={styles.file}>
        Compare with recording’s Trodes configuration (.trodesconf or XML header)
        <input type="file" accept=".trodesconf,.xml" onChange={async (event) => {
          const file = event.target.files?.[0];
          setHeader(null);
          setFileError('');
          if (!file) return;
          try {
            if (file.size > 5 * 1024 * 1024) throw new Error('Choose a text configuration under 5 MB, not a binary .rec recording.');
            setHeader({ name: file.name, rows: parseTrodesHeader(await file.text()) });
          } catch (error) { setFileError(error instanceof Error ? error.message : 'Could not read the configuration.'); }
        }} />
      </label>
      {header && <section aria-label="Trodes header comparison">
        <p><strong>{header.name}</strong>: {header.rows.map((row) => `${row.id} (${row.channels} channels)`).join('; ')}</p>
        {comparison.length === 0 && !errors.length && <p role="status">Ntrode IDs and channel counts match. Verify electrode order against your wiring records; the header cannot establish probe electrode positions.</p>}
        {!!comparison.length && <ul>{comparison.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
        <Button variant="neutral" size="small" onClick={() => { setHeader(null); setFileError(''); }}>Clear header comparison</Button>
      </section>}
      <div className={styles.scroll}><table>
        <caption>Mapping rows, ordered by shank within each electrode group</caption>
        <thead><tr><th>Electrode group</th><th>Trodes ntrode ID</th><th>Probe electrode IDs in local channel order</th></tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>
          <th scope="row">{maps[index].electrode_group_id}</th>
          <td><input aria-label={`Row ${index + 1} Trodes ntrode ID`} inputMode="numeric" value={row.id}
            onChange={(event) => setRows(rows.map((item, i) => i === index ? { ...item, id: event.target.value } : item))} /></td>
          <td><textarea rows={2} aria-label={`Row ${index + 1} probe electrode IDs`} value={row.channels}
            onChange={(event) => setRows(rows.map((item, i) => i === index ? { ...item, channels: event.target.value } : item))} /></td>
        </tr>)}</tbody>
      </table></div>
      {fileError && <p role="alert">{fileError}</p>}
      {!!errors.length && <ul aria-label="Mapping errors">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
      {!header && <p>Header comparison has not been performed. Confirm these IDs and their electrode order from your acquisition records before converting.</p>}
    </Modal>
  );
}
