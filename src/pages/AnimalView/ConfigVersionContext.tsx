/**
 * ConfigVersionContext — human-readable electrode reconfiguration history (Task 3.4, ephys slice).
 *
 * The electrode-groups panel is the home of the animal's VERSIONED probe identity: editing a group
 * forks a configuration version, and recording days pin to the version that was active when they
 * ran. A bare "v2" badge is illegible — it doesn't say WHEN the change happened or WHICH days use
 * which version. This renders one plain-language line per reconfiguration boundary, sourced from
 * `getConfigHistory`, so the scientist can read the timeline instead of decoding version numbers.
 *
 * Single-version animals (no reconfiguration) render nothing — there is no boundary to explain.
 */
import { getConfigHistory } from '../../state/workspaceSelectors';
import styles from './ConfigVersionContext.module.css';

interface ConfigVersionContextProps {
  /** The animal whose configuration history to describe (read through the tolerant selector). */
  animal: unknown;
}

export default function ConfigVersionContext({ animal }: ConfigVersionContextProps) {
  const history = getConfigHistory(animal);
  // Sort by version so an out-of-order persisted history still reads as a timeline. A single
  // version (or none) means no reconfiguration ever happened — nothing to explain.
  if (history.length < 2) return null;
  const ordered = [...history].sort((a, b) => (a.version ?? 0) - (b.version ?? 0));
  // A pinned-only version (an imported back-fill) is not a point on the timeline: it belongs only to
  // the imported days pinned to it, so it gets its own line instead of a "changed on" boundary.
  const timeline = ordered.filter((snapshot) => snapshot.pinnedOnly !== true);
  const pinnedOnly = ordered.filter((snapshot) => snapshot.pinnedOnly === true);
  // The current setup is the LAST stored version (what Animal Setup edits). An older importer
  // appended an older file's setup there, dated from that file: it then starts before a version it
  // follows, and it can be chosen for recording days after its date. Not re-dated automatically.
  const current = history[history.length - 1];
  const laterStart = current?.pinnedOnly === true || typeof current?.date !== 'string'
    ? undefined
    : timeline
      .filter((snapshot) => snapshot !== current && typeof snapshot.date === 'string' && snapshot.date > current.date)
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0];

  return (
    <section className={styles.context} role="note" aria-label="Electrode configuration history">
      <p className={styles.intro}>
        {timeline.length > 1 ? (
          <>
            This animal&apos;s electrode configuration was changed during the study. Recording days keep
            the version that was active when they ran:
          </>
        ) : (
          <>Some imported recordings used a different electrode configuration. Each keeps its own:</>
        )}
      </p>
      <ul className={styles.list}>
        {timeline.slice(1).map((snapshot, index) => {
          const previous = timeline[index];
          // Render the whole sentence as ONE text node so it reads as a single sentence (and so
          // screen readers / tests see it as one phrase rather than fragmented spans).
          const line =
            `Electrode configuration changed on ${snapshot.date || 'an unknown date'} — ` +
            `earlier recording days use v${previous.version}, this and later days use v${snapshot.version}.` +
            (snapshot.description ? ` (${snapshot.description})` : '');
          return <li key={snapshot.version ?? index}>{line}</li>;
        })}
        {pinnedOnly.map((snapshot, index) => {
          const line =
            `v${snapshot.version} is used only by the imported recording days pinned to it; other days never get it.` +
            (snapshot.description ? ` (${snapshot.description})` : '');
          return <li key={snapshot.version ?? `pinned-${index}`}>{line}</li>;
        })}
      </ul>
      {laterStart && (
        <p className={styles.advisory}>
          {`v${current.version} is the current setup (the one Animal Setup edits) but starts on ` +
            `${current.date}, before v${laterStart.version} (${laterStart.date}), so it can be chosen for ` +
            'recording days after its date. An earlier version of the importer filed an older ' +
            "file's setup this way. Check which recording days use each version before editing electrode groups."}
        </p>
      )}
    </section>
  );
}

