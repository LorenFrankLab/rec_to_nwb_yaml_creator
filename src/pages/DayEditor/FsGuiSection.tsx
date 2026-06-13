import type { Camera } from '../../state/workspaceTypes';

/** Day-level FsGUI protocol entry (a distinct shape from the canonical `FsGuiYaml`). */
interface FsGuiItem {
  name?: string;
  epochs?: number[];
  power_in_mW?: number | string;
  dio_output_name?: string;
  camera_id?: number | string;
}

interface FsGuiSectionProps {
  /** day.fs_gui_yamls. */
  fsGuiYamls?: FsGuiItem[];
  /** animal.cameras (id + camera_name) for the camera select. */
  cameras?: Camera[];
  /** Task-epoch numbers defined on this day. */
  epochOptions?: number[];
  /** Behavioral-event names for the DIO-output select. */
  dioOptions?: string[];
  /** `(nextFsGuiYamls)` updater. */
  onChange: (items: FsGuiItem[]) => void;
}

/** Empty fs_gui protocol item (blank scalars, empty epochs). */
function emptyFsGui(): FsGuiItem {
  return { name: '', epochs: [], power_in_mW: '', dio_output_name: '', camera_id: '' };
}

/**
 * Day-level FsGUI optogenetics protocol editor — the opto stimulation actually RUN
 * on this recording day, distinct from the animal's implanted opto setup (edited once
 * in the Animal Editor's Optogenetics Setup step).
 *
 * `fs_gui_yamls` are a DAY-owned collection (one entry per protocol file) that the
 * export reads from `day.fs_gui_yamls`. Each entry references this day's task epochs and
 * one of the animal's cameras — both controlled choices here (a checkbox list of known
 * epochs, a select of known camera ids) so a scientist can't type a dangling reference.
 *
 * This protocol is OPTIONAL and epoch-scoped: an opto-implanted animal that ran no
 * stimulation on a given day (or only some epochs) is a normal, valid state. Only
 * rendered when the animal has optogenetics enabled — without an implant there is
 * nothing to stimulate.
 */
export default function FsGuiSection({ fsGuiYamls = [], cameras = [], epochOptions = [], dioOptions = [], onChange }: FsGuiSectionProps) {
  const items = Array.isArray(fsGuiYamls) ? fsGuiYamls : [];

  const addItem = () => onChange([...items, emptyFsGui()]);
  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index));
  const updateItem = (index: number, patch: Partial<FsGuiItem>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const toggleEpoch = (index: number, epoch: number, checked: boolean) => {
    const current = (Array.isArray(items[index].epochs) ? items[index].epochs : []) as number[];
    const next = checked
      ? [...new Set([...current, epoch])].sort((a, b) => a - b)
      : current.filter((e) => e !== epoch);
    updateItem(index, { epochs: next });
  };

  return (
    <section className="fs-gui-section" aria-labelledby="fs-gui-heading">
      <h3 id="fs-gui-heading">Optogenetics run this day (FsGUI protocols)</h3>
      <p className="help-text">
        The opto stimulation <strong>actually run</strong> on this recording day — separate from the
        animal&apos;s implanted setup (edited once in Animal Setup → Optogenetics Setup). One entry
        per FsGUI protocol YAML; each applies to the task epochs you select and the camera that
        defines its spatial filters. This is optional and epoch-scoped.
      </p>

      {items.length === 0 && (
        <p className="empty-message">
          <strong>No optogenetic stimulation recorded for this day.</strong> That is a normal, valid
          state — an opto-implanted animal often runs no stimulation on a given day, or only during
          some epochs. Add a protocol only if opto was run.
        </p>
      )}

      {items.map((item, index) => (
        <div key={`fsgui-${index}`} className="fs-gui-item">
          <div className="form-container">
            <label htmlFor={`fsgui-name-${index}`} className="opto-field">
              <span>Protocol file name</span>
              <input
                id={`fsgui-name-${index}`}
                type="text"
                value={item.name ?? ''}
                onChange={(e) => updateItem(index, { name: e.target.value })}
              />
            </label>

            <label htmlFor={`fsgui-power-${index}`} className="opto-field">
              <span>Power (mW)</span>
              <input
                id={`fsgui-power-${index}`}
                type="number"
                step="any"
                value={item.power_in_mW ?? ''}
                onChange={(e) =>
                  updateItem(index, {
                    power_in_mW: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
              />
            </label>

            <label htmlFor={`fsgui-dio-${index}`} className="opto-field">
              <span>DIO output (behavioral event)</span>
              {dioOptions.length === 0 ? (
                <input
                  id={`fsgui-dio-${index}`}
                  type="text"
                  value={item.dio_output_name ?? ''}
                  onChange={(e) => updateItem(index, { dio_output_name: e.target.value })}
                  placeholder="Add behavioral events first"
                />
              ) : (
                <select
                  id={`fsgui-dio-${index}`}
                  value={item.dio_output_name ?? ''}
                  onChange={(e) => updateItem(index, { dio_output_name: e.target.value })}
                >
                  <option value="">— select DIO event —</option>
                  {dioOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              )}
            </label>

            <label htmlFor={`fsgui-camera-${index}`} className="opto-field">
              <span>Camera</span>
              <select
                id={`fsgui-camera-${index}`}
                value={item.camera_id === '' || item.camera_id == null ? '' : String(item.camera_id)}
                onChange={(e) =>
                  updateItem(index, {
                    camera_id: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
              >
                <option value="">— select camera —</option>
                {cameras.map((cam) => (
                  <option key={cam.id} value={String(cam.id)}>
                    {cam.camera_name ? `${cam.camera_name} (id ${cam.id})` : `Camera ${cam.id}`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="fs-gui-epochs">
            <legend>Epochs</legend>
            {(() => {
              // Show a checkbox for every available task epoch PLUS any epoch this
              // protocol already references that is no longer a task epoch (stale, e.g.
              // after a task renumber) — otherwise the user could not uncheck the stale
              // value to clear an orphaned_fs_gui_epoch error.
              const selected = Array.isArray(item.epochs) ? item.epochs : [];
              const available = new Set(epochOptions);
              const shown = [...new Set([...epochOptions, ...selected])].sort((a, b) => a - b);
              if (shown.length === 0) {
                return (
                  <p className="help-text">
                    No task epochs defined yet. Add tasks with epochs above first.
                  </p>
                );
              }
              return shown.map((epoch) => {
                const stale = !available.has(epoch);
                return (
                  <label key={epoch} htmlFor={`fsgui-${index}-epoch-${epoch}`} className="fs-gui-epoch">
                    <input
                      id={`fsgui-${index}-epoch-${epoch}`}
                      type="checkbox"
                      checked={selected.includes(epoch)}
                      onChange={(e) => toggleEpoch(index, epoch, e.target.checked)}
                    />
                    <span>Epoch {epoch}{stale ? ' (no matching task — uncheck to fix)' : ''}</span>
                  </label>
                );
              });
            })()}
          </fieldset>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => removeItem(index)}
            aria-label={`Remove FsGUI protocol ${index + 1}`}
          >
            Remove protocol
          </button>
        </div>
      ))}

      <button type="button" className="btn-secondary" onClick={addItem}>
        + Add FsGUI protocol
      </button>
    </section>
  );
}

