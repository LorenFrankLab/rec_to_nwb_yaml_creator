import { useState } from 'react';
import Button from '../../components/ui/Button';
import { DEFAULT_STATESCRIPT_TEMPLATE, deriveEpochStatescript, statescriptTemplateError } from '../../domain/fileNaming';
import { STATESCRIPT_DESCRIPTION } from '../../domain/associatedFiles';
import type { EpochGrid } from '../../viewModels/epochGridViewModel';
import type { AssociatedFile } from '../../state/workspaceTypes';
import styles from './StatescriptPathEditor.module.css';

interface Props {
  grid: EpochGrid;
  files: AssociatedFile[];
  disabled?: boolean;
  onApply: (folder: string, pattern: string, files: AssociatedFile[]) => void;
}

/** An explicit, previewed application preserves imported paths until the scientist selects them. */
export default function StatescriptPathEditor({ grid, files, disabled, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [folder, setFolder] = useState(grid.dataFolder);
  const [pattern, setPattern] = useState(grid.pathTemplate ?? DEFAULT_STATESCRIPT_TEMPLATE);
  const [selected, setSelected] = useState<number[]>([]);
  const error = statescriptTemplateError(pattern.trim());
  const previews = grid.rows.map((row) => ({ row, ...deriveEpochStatescript({
    ...grid, dataFolder: folder.trim(), pathTemplate: pattern.trim(), epoch: row.epoch, tag: row.tag,
  }) }));
  const selectedPreviews = previews.filter(({ row }) => selected.includes(row.epoch));
  const conflict = new Set(selectedPreviews.map((file) => file.path)).size !== selectedPreviews.length;
  const apply = () => {
    if (error || conflict || !folder.trim() || disabled) return;
    const next = files.map((file) => ({ ...file }));
    for (const { row, name, path } of selectedPreviews) {
      if (row.statescript) next[row.statescript.index] = { ...next[row.statescript.index], name, path };
      else next.push({ name, path, description: STATESCRIPT_DESCRIPTION, task_epochs: row.epoch });
    }
    onApply(folder.trim(), pattern.trim(), next);
    setOpen(false);
  };
  return <div className={styles.editor}>
    <Button variant="secondary" onClick={() => {
      setFolder(grid.dataFolder);
      setPattern(grid.pathTemplate ?? DEFAULT_STATESCRIPT_TEMPLATE);
      setSelected([]);
      setOpen(!open);
    }}>Set epoch path pattern</Button>
    {open && <fieldset disabled={disabled}>
      <legend>StateScript path pattern</legend>
      <label>Base folder<input value={folder} onChange={(event) => setFolder(event.target.value)} placeholder="/stelmo/denisse/Peter/20260918" /></label>
      <label>Relative path pattern<input value={pattern} onChange={(event) => setPattern(event.target.value)} /></label>
      <p>Use {'{date}'}, {'{subject}'}, {'{epoch:02d}'} (two digits), {'{epoch}'}, {'{tag}'}, or {'{stem}'}.
        {' '}{'{stem}'} combines date, subject, padded epoch and tag.</p>
      <Button variant="neutral" size="small" onClick={() => setPattern('{stem}/{stem}.stateScriptLog')}>Use an epoch subfolder</Button>
      <p>The pattern applies to new StateScript entries. Select existing epochs below to replace their paths, or select an epoch without a log to add one.</p>
      {error && <p role="alert">{error}</p>}
      {conflict && <p role="alert">Selected epochs have the same path. Include an epoch token in the pattern.</p>}
      {!error && <div className={styles.preview}><table>
        <caption>Path preview — files on disk are not moved</caption>
        <thead><tr><th>Apply</th><th>Current path</th><th>Proposed path</th></tr></thead>
        <tbody>{previews.map(({ row, path }) => <tr key={row.epoch}>
          <td><label><input type="checkbox" checked={selected.includes(row.epoch)}
            onChange={(event) => setSelected(event.target.checked ? [...selected, row.epoch] : selected.filter((epoch) => epoch !== row.epoch))} />Epoch {row.epoch}</label></td>
          <td>{row.statescript?.entry.path || 'No linked StateScript log'}</td><td>{path}</td>
        </tr>)}</tbody>
      </table></div>}
      <Button onClick={apply} disabled={!!error || conflict || !folder.trim()}>
        {selectedPreviews.length ? `Apply paths to ${selectedPreviews.length} ${selectedPreviews.length === 1 ? 'epoch' : 'epochs'}` : 'Save pattern for new files'}
      </Button>
    </fieldset>}
  </div>;
}
