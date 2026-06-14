/**
 * @file CalendarLegend - Visual legend for calendar states
 *
 * Shows color-coded legend explaining calendar day states.
 */

/**
 * CalendarLegend - Visual legend component
 */
export function CalendarLegend() {
  return (
    <div className="calendar-legend" role="region" aria-label="Calendar legend">
      <div className="legend-title">Legend:</div>
      <div className="legend-items">
        <div className="legend-item">
          <span className="legend-indicator legend-indicator--existing" aria-hidden="true">✓</span>
          <span className="legend-label">Existing recording</span>
        </div>
        <div className="legend-item">
          <span className="legend-indicator legend-indicator--selected" aria-hidden="true"></span>
          <span className="legend-label">Selected</span>
        </div>
        <div className="legend-item">
          <span className="legend-indicator legend-indicator--today" aria-hidden="true"></span>
          <span className="legend-label">Today</span>
        </div>
        <div className="legend-item">
          <span className="legend-indicator legend-indicator--available" aria-hidden="true"></span>
          <span className="legend-label">Available</span>
        </div>
      </div>
    </div>
  );
}
