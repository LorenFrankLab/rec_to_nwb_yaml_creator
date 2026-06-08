/**
 * DioContainer — the behavioral-events (DIO) library section.
 *
 * BehavioralEventsSection is already self-contained (it owns its inline edit/delete), so this is
 * a thin container that gives DIO the same `{ animal, onFieldUpdate }` interface as the other
 * setup sections — one implementation for both the (temporary) stepper-hosted HardwareConfigStep
 * and the tabbed Animal View.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { rawArray } from '../../../components/rawPropTypes';
import BehavioralEventsSection from '../BehavioralEventsSection';

/**
 * @param {object} props
 * @param {object} props.animal - Animal record.
 * @param {Function} props.onFieldUpdate - Field-update callback (writes `behavioral_events`).
 * @returns {JSX.Element}
 */
export default function DioContainer({ animal, onFieldUpdate }) {
  return <BehavioralEventsSection animal={animal} onFieldUpdate={onFieldUpdate} />;
}

DioContainer.propTypes = {
  animal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    behavioral_events: rawArray(PropTypes.object),
  }).isRequired,
  onFieldUpdate: PropTypes.func.isRequired,
};
