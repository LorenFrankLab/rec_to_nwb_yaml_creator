/**
 * RecordingSystemContainer — the data-acquisition device + technical defaults section.
 *
 * Owns the dataset-wide data-acq identity registry (so DataAcqSection can flag a divergent reuse
 * of a device name) and renders DataAcqSection. One implementation for both the (temporary)
 * stepper-hosted HardwareConfigStep and the tabbed Animal View.
 */
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useStoreContext } from '../../../state/StoreContext';
import DataAcqSection from '../DataAcqSection';
import { collectDataAcqIdentities } from '../identitySafety';

/**
 * @param {object} props
 * @param {object} props.animal - Animal record.
 * @param {Function} props.onFieldUpdate - Field-update callback (writes `data_acq_device`).
 * @returns {JSX.Element}
 */
export default function RecordingSystemContainer({ animal, onFieldUpdate }) {
  const { model } = useStoreContext();
  // Data-acq identities elsewhere in the dataset (plus any other items on this animal), for the
  // DataAcqSection divergent-reuse check.
  const dataAcqRegistry = useMemo(
    () => collectDataAcqIdentities(model.workspace, { animalId: animal.id, index: 0 }),
    [model.workspace, animal.id]
  );
  return (
    <DataAcqSection animal={animal} onFieldUpdate={onFieldUpdate} dataAcqRegistry={dataAcqRegistry} />
  );
}

RecordingSystemContainer.propTypes = {
  animal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    devices: PropTypes.object,
    technicalDefaults: PropTypes.object,
  }).isRequired,
  onFieldUpdate: PropTypes.func.isRequired,
};
