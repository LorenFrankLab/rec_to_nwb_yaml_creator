import { useState } from 'react';
import type { AnimalConfigCardViewModel } from '../../viewModels/animalViewModel';
import Button from '../../components/ui/Button';
import styles from './ConfigurationCard.module.css';
import { pluralize } from '../../utils/pluralize';

interface ConfigurationCardProps {
  /** The current-configuration card data built by the animal view-model. */
  card: AnimalConfigCardViewModel;
  /** Open the re-implant (new-configuration) flow. When omitted, the action button is hidden. */
  onNewConfiguration?: () => void;
  /** Record the current version's effective date (when omitted, the control is hidden). */
  onSetEffectiveDate?: (version: number, date: string) => void;
}

/**
 * ConfigurationCard — the current hardware configuration on the Electrode Groups setup surface: the
 * version + since-date + day count, the per-probe list (device type + coordinates), and the
 * re-implant action. Renders the card data it is handed.
 */
export default function ConfigurationCard({ card, onNewConfiguration, onSetEffectiveDate }: ConfigurationCardProps) {
  const [effectiveDate, setEffectiveDate] = useState('');
  const dateUnknown = card.sinceDate != null && card.effectiveDateKnown === false;
  const since = card.sinceDate
    ? dateUnknown
      ? ` · entered ${card.sinceDate} (effective date not recorded)`
      : ` · effective ${card.sinceDate}`
    : '';
  const dayNoun = pluralize(card.dayCount, 'day');
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
      {dateUnknown && card.version != null && onSetEffectiveDate && (
        <form
          className={styles.effectiveForm}
          onSubmit={(e) => {
            e.preventDefault();
            if (/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) onSetEffectiveDate(card.version as number, effectiveDate);
          }}
        >
          <label htmlFor="config-effective-date" className={styles.effectiveLabel}>
            When did this setup (v{card.version}) become effective? Recording days before the entry
            date otherwise need per-day confirmation.
          </label>
          <span className={styles.effectiveRow}>
            <input
              id="config-effective-date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
            <Button variant="secondary" size="small" type="submit" disabled={!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)}>
              Set effective date
            </Button>
          </span>
        </form>
      )}
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
