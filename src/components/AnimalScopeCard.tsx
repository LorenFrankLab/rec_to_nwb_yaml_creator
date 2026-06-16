import styles from './AnimalScopeCard.module.css';

/**
 * The animal-static summary the scope card renders. The animal view-model builds the real value
 * object; this minimal interface is the render contract the card depends on.
 */
export interface AnimalScopeSummary {
  /** Identity line, e.g. "Laurent · Rattus norvegicus · M". */
  identity: string;
  /** Probe summary, e.g. "2× tetrode_12.5". */
  probes: string;
  /** Configuration line, e.g. "v1 · current · since 2023-06-22". */
  config: string;
  /** Team line, e.g. "Alice, Bob". */
  team: string;
}

export interface AnimalScopeCardProps {
  /** The pre-built animal-static summary (rendered read-only). */
  summary: AnimalScopeSummary;
  /** Where the quiet "Edit animal setup" link points. */
  editHref: string;
}

/**
 * AnimalScopeCard — the read-only animal-static scope boundary shown on the day editor: the
 * identity · probes · configuration · team that every day inherits, with a quiet link out to the
 * animal setup. It only renders a summary it is handed; it computes nothing.
 */
const AnimalScopeCard = ({ summary, editHref }: AnimalScopeCardProps) => (
  <aside className={styles.card} aria-label="Animal setup (shared by every day)">
    <dl className={styles.lines}>
      <div className={styles.line}>
        <dt className={styles.label}>Animal</dt>
        <dd className={styles.value}>{summary.identity}</dd>
      </div>
      <div className={styles.line}>
        <dt className={styles.label}>Probes</dt>
        <dd className={styles.value}>{summary.probes}</dd>
      </div>
      <div className={styles.line}>
        <dt className={styles.label}>Configuration</dt>
        <dd className={styles.value}>{summary.config}</dd>
      </div>
      <div className={styles.line}>
        <dt className={styles.label}>Team</dt>
        <dd className={styles.value}>{summary.team}</dd>
      </div>
    </dl>
    <a className={styles.editLink} href={editHref}>
      Edit animal setup
    </a>
  </aside>
);

export default AnimalScopeCard;
