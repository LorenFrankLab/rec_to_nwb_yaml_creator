import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";


/**
 * Displays info icon
 *
 * @param {object} prop - Component props
 * @param {string} prop.infoText - Tooltip text to display
 * @param {string} [prop.size='2xs'] - Icon size
 * @returns {JSX.Element} Info icon component
 */
const InfoIcon = (prop) => {
  const { infoText, size } = prop;

  return (
    <span title={infoText}>
      <FontAwesomeIcon icon={faCircleInfo} size={size} className="info-icon" />
    </span>
  );
};

InfoIcon.propTypes = {
  infoText: PropTypes.string.isRequired,
  size: PropTypes.string,
};

InfoIcon.defaultProps = {
  size: '2xs',
};

export default InfoIcon;
