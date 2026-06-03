import PropTypes from 'prop-types';

/**
 * Error State - Displays error message for missing data
 *
 * @param {object} props
 * @param {string} props.message - Error message to display
 * @returns {JSX.Element}
 */
export default function ErrorState({ message }) {
  // The normal DayEditor <main> is not rendered on the error path, so this screen
  // supplies its own landmark + focus target and never dead-ends (escape links).
  return (
    <main id="main-content" role="main" tabIndex="-1" aria-label="Error" className="error-state">
      <h2>Error</h2>
      <p>{message}</p>
      <p>
        <a href="#/workspace">Return to Workspace</a>
        {' · '}
        <a href="#/home">Go to Home</a>
      </p>
    </main>
  );
}

ErrorState.propTypes = {
  message: PropTypes.string.isRequired,
};
