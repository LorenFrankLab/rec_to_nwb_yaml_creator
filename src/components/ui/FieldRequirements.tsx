/** Visible requirement marker; the input carries the accessible required state. */
export function RequiredMark() {
  return <span className="required-marker" aria-hidden="true">*</span>;
}

export function FieldRequirements({ when = 'save' }: { when?: 'save' | 'export' }) {
  return <p className="form-requirements">* Required {when === 'export' ? 'before export. You can save an unfinished draft.' : 'to save.'}</p>;
}

/** Explain disabled saves next to the fields, including on touch devices without hover. */
export function MissingFields({ fields }: { fields: string[] }) {
  return fields.length ? <p className="form-requirements" role="status">To save: complete {fields.join(', ')}.</p> : null;
}
