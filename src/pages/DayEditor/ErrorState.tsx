import '../../components/ErrorState.css';

interface ErrorStateProps {
  /** Error message to display. */
  message: string;
}

/**
 * Error State - Displays error message for missing data
 */
export default function ErrorState({ message }: ErrorStateProps) {
  // The normal DayEditor <main> is not rendered on the error path, so this screen
  // supplies its own landmark + focus target and never dead-ends (escape links).
  return (
    <main id="main-content" role="main" tabIndex={-1} aria-label="Error" className="error-state">
      <h2>Error</h2>
      <p>{message}</p>
      <a href="#/workspace" className="error-state-action">
        ← Back to Workspace
      </a>
    </main>
  );
}
