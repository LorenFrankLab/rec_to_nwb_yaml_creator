import { useId } from 'react';

type HardwareChange = 'replacement' | 'same-hardware';

/** Keep the consequences of a hardware change visible while choosing its scope. */
export default function HardwareChangeChoice({ value, onChange }: {
  value: HardwareChange;
  onChange: (value: HardwareChange) => void;
}) {
  const name = useId();
  return <fieldset className="form-field-group">
    <legend>Physical hardware change</legend>
    <label className="form-choice">
      <input type="radio" name={name} value="replacement" checked={value === 'replacement'} onChange={() => onChange('replacement')} />
      <span>New or replaced probes<small>Reset failed channels for recordings using this setup.</small></span>
    </label>
    <label className="form-choice">
      <input type="radio" name={name} value="same-hardware" checked={value === 'same-hardware'} onChange={() => onChange('same-hardware')} />
      <span>Same probes and wiring, updated position<small>Keep previously recorded failed channels.</small></span>
    </label>
  </fieldset>;
}
