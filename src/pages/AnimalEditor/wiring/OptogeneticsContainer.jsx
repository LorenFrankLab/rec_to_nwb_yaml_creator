/**
 * OptogeneticsContainer — binds the animal-level optogenetics editor to the store.
 *
 * Resolves the animal from `animalId` and wires `onUpdate` to `updateAnimal`, so both the
 * (temporary) Animal Editor stepper and the tabbed Animal View render ONE implementation of the
 * optogenetics section without duplicating the store wiring.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { useStoreContext } from '../../../state/StoreContext';
import OptogeneticsStep from '../OptogeneticsStep';

/**
 * @param {object} props
 * @param {string} props.animalId - The animal whose optogenetics setup to edit.
 * @returns {JSX.Element|null}
 */
export default function OptogeneticsContainer({ animalId }) {
  const { model, actions } = useStoreContext();
  const animal = animalId ? model.workspace.animals[animalId] : null;
  if (!animal) return null;
  return (
    <OptogeneticsStep
      animal={animal}
      onUpdate={(updates) => actions.updateAnimal(animalId, updates)}
    />
  );
}

OptogeneticsContainer.propTypes = {
  animalId: PropTypes.string.isRequired,
};
