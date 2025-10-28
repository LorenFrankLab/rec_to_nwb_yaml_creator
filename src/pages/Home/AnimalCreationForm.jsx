import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './Home.css';

/**
 * Validate animal creation form data
 * @param {object} formData - Form data to validate
 * @param {object} existingAnimals - Existing animals for uniqueness check
 * @returns {{ valid: boolean, errors: object }}
 */
function validateAnimalForm(formData, existingAnimals) {
  const errors = {};

  // Subject ID
  if (!formData.subject_id?.trim()) {
    errors.subject_id = 'Subject ID is required';
  } else if (/\s/.test(formData.subject_id)) {
    errors.subject_id = 'Subject ID cannot contain spaces';
  } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.subject_id)) {
    errors.subject_id = 'Use only letters, numbers, underscores, and hyphens';
  } else {
    const normalized = formData.subject_id.toLowerCase().trim();
    if (Object.keys(existingAnimals).includes(normalized)) {
      errors.subject_id = `Animal "${formData.subject_id}" already exists`;
    }
  }

  // Species
  if (!formData.species?.trim()) {
    errors.species = 'Species is required';
  }
  if (formData.species === 'other' && !formData.speciesCustom?.trim()) {
    errors.speciesCustom = 'Custom species name is required';
  }

  // Sex
  if (!formData.sex) {
    errors.sex = 'Sex is required';
  }

  // Genotype
  if (!formData.genotype?.trim()) {
    errors.genotype = 'Genotype is required';
  }

  // Date of birth
  if (!formData.date_of_birth) {
    errors.date_of_birth = 'Date of birth is required';
  } else {
    const dob = new Date(formData.date_of_birth);
    const today = new Date();
    if (dob > today) {
      errors.date_of_birth = 'Date of birth cannot be in the future';
    }
  }

  // Experimenter names
  const validNames = formData.experimenter_names.filter((n) => n.trim());
  if (validNames.length === 0) {
    errors.experimenter_names = 'At least one experimenter is required';
  }

  // Lab
  if (!formData.lab?.trim()) {
    errors.lab = 'Lab is required';
  }

  // Institution
  if (!formData.institution?.trim()) {
    errors.institution = 'Institution is required';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * AnimalCreationForm - Presentational component for creating new animals
 * @param {object} props
 * @param {Function} props.onSubmit - Callback when form is submitted with valid data
 * @param {Function} props.onCancel - Callback when user cancels
 * @param {object} props.defaultExperimenters - Default values for experimenters section
 * @param {object} props.existingAnimals - Existing animals for uniqueness validation
 * @param {boolean} props.showCancelAsSkip - Show "Skip for Now" instead of "Cancel"
 */
function AnimalCreationForm({
  onSubmit,
  onCancel,
  defaultExperimenters,
  existingAnimals,
  showCancelAsSkip,
}) {
  const [formData, setFormData] = useState({
    subject_id: '',
    species: 'Rattus norvegicus',
    speciesCustom: '',
    sex: 'U',
    genotype: '',
    date_of_birth: '',
    description: '',
    experimenter_names: defaultExperimenters.experimenter_names || [''],
    lab: defaultExperimenters.lab || '',
    institution: defaultExperimenters.institution || '',
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [ageWarning, setAgeWarning] = useState('');
  const [showCustomSpecies, setShowCustomSpecies] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if form is valid for submit button state
  const isValid =
    formData.subject_id.trim() &&
    formData.genotype.trim() &&
    formData.date_of_birth &&
    formData.experimenter_names.some((n) => n.trim()) &&
    formData.lab.trim() &&
    formData.institution.trim() &&
    Object.keys(fieldErrors).length === 0;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleBlur = (fieldName) => {
    const { errors } = validateAnimalForm(formData, existingAnimals);

    if (errors[fieldName]) {
      setFieldErrors((prev) => ({ ...prev, [fieldName]: errors[fieldName] }));
    } else {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }

    // Special handling for date of birth age warning
    if (fieldName === 'date_of_birth' && formData.date_of_birth && !errors.date_of_birth) {
      const dob = new Date(formData.date_of_birth);
      const today = new Date();
      const ageYears = (today - dob) / (1000 * 60 * 60 * 24 * 365.25);

      if (ageYears > 5) {
        setAgeWarning(`Subject would be ${Math.round(ageYears)} years old.`);
      } else {
        setAgeWarning('');
      }
    }
  };

  const addExperimenter = () => {
    setFormData((prev) => ({
      ...prev,
      experimenter_names: [...prev.experimenter_names, ''],
    }));
  };

  const removeExperimenter = (idx) => {
    setFormData((prev) => ({
      ...prev,
      experimenter_names: prev.experimenter_names.filter((_, i) => i !== idx),
    }));
  };

  const updateExperimenterName = (idx, value) => {
    setFormData((prev) => ({
      ...prev,
      experimenter_names: prev.experimenter_names.map((name, i) => (i === idx ? value : name)),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (isSubmitting) return; // Prevent double submission

    // Full form validation
    const { valid, errors } = validateAnimalForm(formData, existingAnimals);

    if (!valid) {
      setFieldErrors(errors);

      // Focus first error field
      const firstErrorField = Object.keys(errors)[0];
      const element = document.getElementById(
        firstErrorField === 'experimenter_names' ? 'experimenter-0' : firstErrorField
      );
      element?.focus();
      return;
    }

    setIsSubmitting(true);

    // Prepare final data with trimmed values and filtered arrays
    const finalData = {
      ...formData,
      subject_id: formData.subject_id.trim(),
      species: formData.species === 'other' ? formData.speciesCustom : formData.species,
      experimenter_names: formData.experimenter_names.filter((n) => n.trim()),
    };

    onSubmit(finalData);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape to cancel
      if (e.key === 'Escape') {
        onCancel();
      }
      // Ctrl+Enter to submit (when valid)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && isValid && !isSubmitting) {
        handleSubmit(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isValid, isSubmitting, onCancel]);

  const fieldLabels = {
    subject_id: 'Subject ID',
    species: 'Species',
    speciesCustom: 'Custom Species',
    sex: 'Sex',
    genotype: 'Genotype',
    date_of_birth: 'Date of Birth',
    experimenter_names: 'Experimenter Names',
    lab: 'Lab',
    institution: 'Institution',
  };

  return (
    <form className="animal-creation-form" onSubmit={handleSubmit} aria-label="Animal creation form">
      <h1>Create New Animal</h1>

      {/* Validation Summary */}
      {Object.keys(fieldErrors).length > 0 && (
        <div id="validation-summary" role="alert" aria-live="assertive" className="validation-summary">
          <strong>Please fix the following errors:</strong>
          <ul>
            {Object.entries(fieldErrors).map(([field, error]) => (
              <li key={field}>
                <a
                  href={`#${field === 'experimenter_names' ? 'experimenter-0' : field}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById(field === 'experimenter_names' ? 'experimenter-0' : field)
                      ?.focus();
                  }}
                >
                  {fieldLabels[field]}: {error}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Subject Section */}
      <div className="form-section">
        <h2>Subject Information</h2>

        {/* Subject ID */}
        <div className="form-field">
          <label htmlFor="subject_id" className="required">
            Subject ID
          </label>
          <input
            id="subject_id"
            type="text"
            value={formData.subject_id}
            onChange={(e) => handleChange('subject_id', e.target.value)}
            onBlur={() => handleBlur('subject_id')}
            required
            autoFocus
            placeholder="e.g., remy, bean"
            aria-describedby={
              fieldErrors.subject_id ? 'subject_id-error' : 'subject_id-hint'
            }
            aria-invalid={!!fieldErrors.subject_id}
            className={fieldErrors.subject_id ? 'invalid' : ''}
          />
          <span id="subject_id-hint" className="validation-hint">
            Unique identifier for this animal (letters, numbers, - or _)
          </span>
          {fieldErrors.subject_id && (
            <span id="subject_id-error" className="validation-error" role="alert">
              {fieldErrors.subject_id}
            </span>
          )}
        </div>

        {/* Species */}
        <div className="form-field">
          <label htmlFor="species" className="required">
            Species
          </label>
          <select
            id="species"
            value={formData.species}
            onChange={(e) => {
              handleChange('species', e.target.value);
              setShowCustomSpecies(e.target.value === 'other');
            }}
            required
            aria-describedby="species-hint"
          >
            <option value="Rattus norvegicus">Rat (Rattus norvegicus)</option>
            <option value="Mus musculus">Mouse (Mus musculus)</option>
            <option value="Callithrix jacchus">Marmoset (Callithrix jacchus)</option>
            <option value="Macaca mulatta">Rhesus macaque (Macaca mulatta)</option>
            <option value="other">Other (specify)...</option>
          </select>
          <span id="species-hint" className="validation-hint">
            Biological species of the subject
          </span>

          {showCustomSpecies && (
            <>
              <label htmlFor="speciesCustom" className="required">
                Custom Species
              </label>
              <input
                id="speciesCustom"
                type="text"
                value={formData.speciesCustom}
                onChange={(e) => handleChange('speciesCustom', e.target.value)}
                required={showCustomSpecies}
                placeholder="Enter scientific name (e.g., Homo sapiens)"
                aria-describedby="speciesCustom-hint"
                aria-invalid={!!fieldErrors.speciesCustom}
              />
              <span id="speciesCustom-hint" className="validation-hint">
                Use scientific name (genus species) for NWB compatibility
              </span>
              {fieldErrors.speciesCustom && (
                <span className="validation-error" role="alert">
                  {fieldErrors.speciesCustom}
                </span>
              )}
            </>
          )}
        </div>

        {/* Sex */}
        <fieldset className="form-field">
          <legend className="required">Sex</legend>
          <div className="radio-group">
            {[
              { value: 'M', label: 'Male (M)' },
              { value: 'F', label: 'Female (F)' },
              { value: 'U', label: 'Unknown (U)' },
              { value: 'O', label: 'Other (O)' },
            ].map(({ value, label }) => (
              <label key={value} className="radio-label">
                <input
                  type="radio"
                  name="sex"
                  value={value}
                  checked={formData.sex === value}
                  onChange={(e) => handleChange('sex', e.target.value)}
                  required
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Genotype */}
        <div className="form-field">
          <label htmlFor="genotype" className="required">
            Genotype
          </label>
          <input
            id="genotype"
            type="text"
            value={formData.genotype}
            onChange={(e) => handleChange('genotype', e.target.value)}
            onBlur={() => handleBlur('genotype')}
            required
            placeholder="e.g., Wild-type, Thy1-ChR2-YFP"
            aria-describedby="genotype-hint"
            aria-invalid={!!fieldErrors.genotype}
          />
          <span id="genotype-hint" className="validation-hint">
            Genetic background or transgene expression. Use "Wild-type" for unmodified animals.
          </span>
          {fieldErrors.genotype && (
            <span className="validation-error" role="alert">
              {fieldErrors.genotype}
            </span>
          )}
        </div>

        {/* Date of Birth */}
        <div className="form-field">
          <label htmlFor="date_of_birth" className="required">
            Date of Birth
          </label>
          <input
            id="date_of_birth"
            type="date"
            value={formData.date_of_birth}
            onChange={(e) => handleChange('date_of_birth', e.target.value)}
            onBlur={() => handleBlur('date_of_birth')}
            max={new Date().toISOString().split('T')[0]}
            required
            aria-describedby="date_of_birth-hint"
            aria-invalid={!!fieldErrors.date_of_birth}
          />
          <span id="date_of_birth-hint" className="validation-hint">
            Subject's date of birth. Must not be in the future.
          </span>
          {fieldErrors.date_of_birth && (
            <span className="validation-error" role="alert">
              {fieldErrors.date_of_birth}
            </span>
          )}
          {ageWarning && !fieldErrors.date_of_birth && (
            <div className="validation-warning" role="status">
              ⚠ {ageWarning} Verify date is correct.
            </div>
          )}
        </div>
      </div>

      {/* Experimenters Section */}
      <div className="form-section">
        <h2>Experimenters</h2>

        {/* Experimenter Names */}
        <div className="form-field">
          <label id="experimenter-label" className="required">
            Experimenter Names
          </label>
          <div role="group" aria-labelledby="experimenter-label">
            {formData.experimenter_names.map((name, idx) => (
              <div key={idx} className="list-item">
                <input
                  id={`experimenter-${idx}`}
                  type="text"
                  value={name}
                  onChange={(e) => updateExperimenterName(idx, e.target.value)}
                  onBlur={() => handleBlur('experimenter_names')}
                  required={idx === 0}
                  placeholder="Firstname Lastname"
                  aria-label={`Experimenter ${idx + 1}`}
                />
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={() => removeExperimenter(idx)}
                    aria-label={`Remove experimenter ${idx + 1}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addExperimenter} className="add-item-button">
              + Add Experimenter
            </button>
          </div>
          <span className="validation-hint">At least one experimenter is required</span>
          {fieldErrors.experimenter_names && (
            <span className="validation-error" role="alert">
              {fieldErrors.experimenter_names}
            </span>
          )}
        </div>

        {/* Lab */}
        <div className="form-field">
          <label htmlFor="lab" className="required">
            Lab
          </label>
          <input
            id="lab"
            type="text"
            value={formData.lab}
            onChange={(e) => handleChange('lab', e.target.value)}
            onBlur={() => handleBlur('lab')}
            required
            aria-invalid={!!fieldErrors.lab}
          />
          {fieldErrors.lab && (
            <span className="validation-error" role="alert">
              {fieldErrors.lab}
            </span>
          )}
        </div>

        {/* Institution */}
        <div className="form-field">
          <label htmlFor="institution" className="required">
            Institution
          </label>
          <input
            id="institution"
            type="text"
            value={formData.institution}
            onChange={(e) => handleChange('institution', e.target.value)}
            onBlur={() => handleBlur('institution')}
            required
            aria-invalid={!!fieldErrors.institution}
          />
          {fieldErrors.institution && (
            <span className="validation-error" role="alert">
              {fieldErrors.institution}
            </span>
          )}
        </div>
      </div>

      {/* Form Actions */}
      <div className="form-actions">
        <button type="button" onClick={onCancel} className="btn-secondary">
          {showCancelAsSkip ? 'Skip for Now' : 'Cancel'}
        </button>
        <button type="submit" disabled={!isValid || isSubmitting} className="btn-primary">
          Create Animal
        </button>
      </div>
    </form>
  );
}

AnimalCreationForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  defaultExperimenters: PropTypes.shape({
    experimenter_names: PropTypes.arrayOf(PropTypes.string),
    lab: PropTypes.string,
    institution: PropTypes.string,
  }).isRequired,
  existingAnimals: PropTypes.object.isRequired,
  showCancelAsSkip: PropTypes.bool,
};

AnimalCreationForm.defaultProps = {
  showCancelAsSkip: false,
};

export default AnimalCreationForm;
