import type { AnimalSummaryViewModel } from '../../viewModels/animalViewModel';
import styles from './AnimalScopeChips.module.css';

interface AnimalScopeChipsProps {
  /** The animal-static summary built by the animal view-model. */
  summary: AnimalSummaryViewModel;
}

/**
 * AnimalScopeChips — the read-only animal-static scope shown under the AnimalView header: the
 * identity facts, the probe summary, the current configuration version, the team, and (only for an
 * opto animal) an optogenetics chip. Renders the summary it is handed; computes nothing.
 */
export default function AnimalScopeChips({ summary }: AnimalScopeChipsProps) {
  const dob = summary.dateOfBirth ? summary.dateOfBirth.split('T')[0] : null;
  const facts: string[] = [];
  if (summary.genotype) facts.push(summary.genotype);
  if (summary.sex) facts.push(summary.sex);
  if (summary.species) facts.push(summary.species);
  if (dob) facts.push(`b. ${dob}`);
  if (summary.probeCount > 0) {
    const noun = summary.probeCount === 1 ? 'probe' : 'probes';
    facts.push(`${summary.probeCount} ${noun} — ${summary.probeSummary}`);
  }
  if (summary.configVersion != null) facts.push(`Config v${summary.configVersion}`);
  if (summary.team) facts.push(`Team: ${summary.team}`);

  return (
    <div className={styles.chips} aria-label="Animal summary">
      {facts.map((fact) => (
        <span key={fact} className={styles.chip}>
          {fact}
        </span>
      ))}
      {summary.isOpto && <span className={`${styles.chip} ${styles.chipOpto}`}>Optogenetics</span>}
    </div>
  );
}
