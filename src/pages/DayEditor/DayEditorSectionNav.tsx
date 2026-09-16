import type { StepStatus } from '../../domain/stepStatus';
import type { StepViewModel } from '../../viewModels/types';
import { useMediaQuery, COMPACT_NAV_QUERY } from '../../hooks/useMediaQuery';

interface SectionNavGroup {
  /** Group heading (Session / Recording / Finish). */
  label: string;
  /** The group's steps, from the day-editor view-model (status + active + the validation count). */
  steps: StepViewModel[];
}

interface DayEditorSectionNavProps {
  /** Grouped section view-models, in display order. */
  groups: SectionNavGroup[];
  /** Section-switch callback: (stepId) => void. */
  onNavigate: (stepId: string) => void;
}

/**
 * Day Editor Section Nav — a tabbed, free-navigation section nav for the Day Editor.
 *
 * Structurally mirrors AnimalView's grouped `section-nav` (a navigation landmark whose
 * active item carries `aria-current="page"`), but the Day Editor is a SINGLE route
 * (`#/day/:id`) whose active section is LOCAL STATE — so each item is a `<button>` that
 * calls `onNavigate(id)`, NOT an `<a href>` link.
 *
 * There is no nav-level gating: EVERY section (including Export) is freely reachable. The
 * export gate survives as a blocked DOWNLOAD ACTION inside the export-preview surface (which
 * gates on the authoritative `vm.export`), not as a nav lock. Each item renders the view-model's
 * step status as visible text plus a small decorative marker, so status is not encoded by glyph or
 * color alone.
 *
 * Keyboard model: plain Tab order. This is NOT an ARIA tabs widget, so no item carries a
 * `tabIndex` — a roving `tabIndex={-1}` without an arrow-key handler would make the inactive
 * sections unreachable by keyboard. Alt+←/→ still steps sections (see `useGlobalShortcuts`).
 */
export default function DayEditorSectionNav({ groups, onNavigate }: DayEditorSectionNavProps) {
  const compact = useMediaQuery(COMPACT_NAV_QUERY);

  // Narrow screens: the long rail would push the day's content below the fold, so it collapses
  // into one labelled select (same items, same status words) — a native control that is keyboard-
  // and screen-reader-friendly without any custom widget.
  if (compact) {
    const active = groups.flatMap((g) => g.steps).find((s) => s.active);
    return (
      <nav className="section-nav section-nav-compact" aria-label="Day editor sections">
        <label className="section-nav-compact-label" htmlFor="day-editor-section-select">
          Section
        </label>
        <select
          id="day-editor-section-select"
          className="section-nav-compact-select"
          value={active?.key ?? groups[0]?.steps[0]?.key ?? ''}
          onChange={(e) => onNavigate(e.target.value)}
        >
          {groups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.steps.map((step) => (
                <option key={step.key} value={step.key}>
                  {step.label} — {step.statusLabel}
                  {step.issueCount != null && step.issueCount > 0 ? ` (${step.issueCount} remaining)` : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </nav>
    );
  }

  return (
    <nav className="section-nav" aria-label="Day editor sections">
      {groups.map((group) => (
        <div className="section-nav-group" key={group.label}>
          <div className="section-nav-group-label">{group.label}</div>
          {group.steps.map((step) => {
            // The to-fix count is information scent on the Validation step only, and only when there
            // is something remaining (the view-model sets `issueCount` then). The status glyph carries
            // the meaning everywhere else.
            const countLabel =
              step.issueCount != null && step.issueCount > 0 ? `${step.issueCount} remaining` : null;
            return (
              <button
                key={step.key}
                type="button"
                className={`section-nav-item ${step.active ? 'is-active' : ''} step-${step.status}`}
                aria-current={step.active ? 'page' : undefined}
                aria-label={`${step.label} — ${step.statusLabel}${countLabel ? `, ${countLabel}` : ''}`}
                onClick={() => onNavigate(step.key)}
              >
                <span className="section-nav-item-name">{step.label}</span>
                {countLabel && (
                  <span className="section-nav-count" aria-hidden="true">{countLabel}</span>
                )}
                <span className="section-nav-status">
                  <span className="section-nav-status-icon" aria-hidden="true">
                    {getStatusIcon(step.status)}
                  </span>
                  <span className="section-nav-status-text">{step.statusLabel}</span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/**
 * Visual status glyph for a section.
 *
 * @private
 */
function getStatusIcon(status: StepStatus): string {
  switch (status) {
    case 'valid': return '✓';
    case 'incomplete': return '○';
    case 'error': return '✗';
    default: return '○';
  }
}
