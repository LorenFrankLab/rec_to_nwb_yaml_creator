import React from 'react';
import { useStoreContext } from '../state/StoreContext';
import InputElement from '../element/InputElement';
import DataListElement from '../element/DataListElement';
import SelectElement from '../element/SelectElement';
import { species, genotypes, genderAcronym } from '../valueList';

/**
 * SubjectFields component
 *
 * Renders the subject information section of the form, including fields for
 * description, species, genotype, sex, subject ID, date of birth, and weight.
 *
 * Uses the shared store context to access form data and actions, eliminating
 * the need for prop drilling from App.js.
 *
 * @returns {JSX.Element} The subject fields section
 */
export default function SubjectFields() {
  const { model: formData, actions } = useStoreContext();
  const { handleChange, onBlur, itemSelected } = actions;

  return (
    <div id="subject-area" className="area-region">
      <details open>
        <summary>Subject</summary>
        <div id="subject-field" className="form-container">
          <InputElement
            id="subject-description"
            type="text"
            name="description"
            title="Description"
            value={formData.subject.description}
            onChange={handleChange('description', 'subject')}
            required
            placeholder="Summary of animal model/patient/specimen being examined"
            onBlur={(e) => onBlur(e, { key: 'subject' })}
            validation={{ type: 'required' }}
          />
          <DataListElement
            id="subject-species"
            name="species"
            title="Species"
            value={formData.subject.species}
            onChange={handleChange('species', 'subject')}
            placeholder="Type to find a species"
            dataItems={species()}
            onBlur={(e) => itemSelected(e, { key: 'subject' })}
          />
          <DataListElement
            id="subject-genotype"
            name="genotype"
            title="Genotype"
            value={formData.subject.genotype}
            onChange={handleChange('genotype', 'subject')}
            required
            placeholder="Genetic strain. If absent, assume Wild Type (WT)"
            dataItems={genotypes()}
            onBlur={(e) => itemSelected(e, { key: 'subject' })}
          />
          <SelectElement
            id="subject-sex"
            name="sex"
            title="Sex"
            placeholder="Sex of subject, single letter identifier	"
            dataItems={genderAcronym()}
            value={formData.subject.sex}
            onChange={handleChange('sex', 'subject')}
          />
          <InputElement
            id="subject-subjectId"
            type="text"
            name="subject_id"
            title="Subject Id"
            required
            value={formData.subject.subject_id}
            onChange={handleChange('subject_id', 'subject')}
            placeholder="ID of animal/person used/participating in experiment (lab convention)"
            onBlur={(e) => onBlur(e, { key: 'subject' })}
            validation={{
              type: 'pattern',
              pattern: /^[a-zA-Z0-9_-]+$/,
              patternMessage: 'Subject ID must contain only letters, numbers, underscores, or hyphens'
            }}
          />
          <InputElement
            id="subject-dateOfBirth"
            type="date"
            name="date_of_birth"
            title="Date of Birth"
            value={formData.subject.date_of_birth ? formData.subject.date_of_birth.split('T')[0] : ''}
            onChange={handleChange('date_of_birth', 'subject')}
            placeholder="Date of birth of subject"
            required
            onBlur={(e) => {
              const { value, name, type } = e.target;
              const date = !value ? '' : new Date(value).toISOString();
              const target = {
                name,
                value: date,
                type,
              };
              onBlur({ target }, { key: 'subject' });
            }}
            validation={{ type: 'required' }}
          />
          <InputElement
            id="subject-weight"
            type="number"
            name="weight"
            title="Weight (grams)"
            required
            min="0"
            value={formData.subject.weight}
            onChange={handleChange('weight', 'subject')}
            placeholder="Weight at time of experiment, at time of surgery and at other important times (in grams)"
            onBlur={(e) => onBlur(e, { key: 'subject' })}
            validation={{ type: 'numberRange', min: 0, unit: 'g' }}
          />
        </div>
      </details>
    </div>
  );
}
