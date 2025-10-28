import PropTypes from 'prop-types';

/**
 * Error State - Displays error message for missing data
 *
 * @param {object} props
 * @param {string} props.message - Error message to display
 * @returns {JSX.Element}
 */
export default function ErrorState({ message }) {
  return (
    <div className="error-state">
      <h2>Error</h2>
      <p>{message}</p>
      <p>
        <a href="#/workspace">Return to Workspace</a>
      </p>
    </div>
  );
}

ErrorState.propTypes = {
  message: PropTypes.string.isRequired,
};
