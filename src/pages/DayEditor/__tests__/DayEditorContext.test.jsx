/**
 * DayEditorContext precedence contract.
 *
 * A day-editor section reads its shared bundle through `useDayEditorContext(props)`: when a
 * `DayEditorProvider` is present (the real Day Editor) the provider value wins; with no provider
 * (isolated unit tests) it falls back to the section's own props. These two tests pin that
 * precedence directly — the rest of the suite only exercises each path transitively (step unit
 * tests use the props fallback; DayEditorStepper tests use the provider).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DayEditorProvider, useDayEditorContext } from '../DayEditorContext';

/**
 * A minimal section that surfaces whichever `day.id` it resolved (provider vs props).
 * @param props
 */
function Probe(props) {
  const { day } = useDayEditorContext(props);
  return <span>{day.id}</span>;
}

describe('useDayEditorContext', () => {
  it('reads the bundle from the provider, ignoring the section’s own props', () => {
    render(
      <DayEditorProvider value={{ day: { id: 'from-provider' } }}>
        <Probe day={{ id: 'from-props' }} />
      </DayEditorProvider>
    );
    expect(screen.getByText('from-provider')).toBeInTheDocument();
  });

  it('falls back to the section’s props when no provider is present', () => {
    render(<Probe day={{ id: 'from-props' }} />);
    expect(screen.getByText('from-props')).toBeInTheDocument();
  });
});
