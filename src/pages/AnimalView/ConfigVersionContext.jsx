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
import PropTypes from 'prop-types';
import { getConfigHistory } from '../../state/workspaceSelectors';
import './ConfigVersionContext.css';

/**
 * @param {object} props
 * @param {object} props.animal - The animal whose configuration history to describe.
 * @returns {React.Element|null} A note listing each version boundary, or null when single-version.
 */
export default function ConfigVersionContext({ animal }) {
  const history = getConfigHistory(animal);
  // Sort by version so an out-of-order persisted history still reads as a timeline. A single
  // version (or none) means no reconfiguration ever happened — nothing to explain.
  if (history.length < 2) return null;
  const ordered = [...history].sort((a, b) => (a.version ?? 0) - (b.version ?? 0));

  return (
    <section className="config-version-context" role="note" aria-label="Electrode configuration history">
      <p className="config-version-context-intro">
        This animal&apos;s electrode configuration was changed during the study. Recording days keep
        the version that was active when they ran:
      </p>
      <ul className="config-version-context-list">
        {ordered.slice(1).map((snapshot, index) => {
          const previous = ordered[index];
          // Render the whole sentence as ONE text node so it reads as a single sentence (and so
          // screen readers / tests see it as one phrase rather than fragmented spans).
          const line =
            `Electrode configuration changed on ${snapshot.date || 'an unknown date'} — ` +
            `earlier recording days use v${previous.version}, this and later days use v${snapshot.version}.` +
            (snapshot.description ? ` (${snapshot.description})` : '');
          return <li key={snapshot.version ?? index}>{line}</li>;
        })}
      </ul>
    </section>
  );
}

ConfigVersionContext.propTypes = {
  animal: PropTypes.shape({
    configurationHistory: PropTypes.arrayOf(PropTypes.object),
  }).isRequired,
};
