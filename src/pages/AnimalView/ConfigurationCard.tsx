import type { AnimalConfigCardViewModel } from '../../viewModels/animalViewModel';
import Button from '../../components/ui/Button';
import styles from './ConfigurationCard.module.css';

interface ConfigurationCardProps {
  /** The current-configuration card data built by the animal view-model. */
  card: AnimalConfigCardViewModel;
  /** Open the re-implant (new-configuration) flow. When omitted, the action button is hidden. */
  onNewConfiguration?: () => void;
}

/**
 * ConfigurationCard — the current hardware configuration on the Electrode Groups setup surface: the
 * version + since-date + day count, the per-probe list (device type + coordinates), and the
 * re-implant action. Renders the card data it is handed.
 */
export default function ConfigurationCard({ card, onNewConfiguration }: ConfigurationCardProps) {
  const since = card.sinceDate ? ` · since ${card.sinceDate}` : '';
  const dayNoun = card.dayCount === 1 ? 'day' : 'days';
  const versionLabel =
    card.version != null
      ? `v${card.version} (current)${since} · ${card.dayCount} ${dayNoun}`
      : 'No configuration yet';

  return (
    <section className={styles.card} aria-label="Configuration">
      <div className={styles.head}>
        {/* h2: the panel's top-level heading follows the page h1 (avoids a heading-order skip). */}
        <h2 className={styles.title}>
          Configuration <span className={styles.meta}>· {versionLabel}</span>
        </h2>
        {onNewConfiguration && (
          <Button variant="secondary" size="small" onClick={onNewConfiguration}>
            {card.newConfigurationLabel}
          </Button>
        )}
      </div>
      {card.probes.length > 0 ? (
        <ul className={styles.probes}>
          {card.probes.map((probe) => (
            <li key={probe.label} className={styles.probe}>
              <span className={styles.probeLabel}>{probe.label}</span>
              <span className={styles.probeMeta}>
                {[probe.deviceType, probe.coords].filter(Boolean).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.noProbes}>No probes configured (behavior-only animal).</p>
      )}
    </section>
  );
}
