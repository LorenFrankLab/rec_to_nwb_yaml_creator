import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";


/**
 *  Displays info icon
 *
 * @param {react prop} prop
 * @returns
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
