import { describe, it, expect } from 'vitest';
import { behavioralEventsNames } from '../../valueList';

/**
 * Behavioral-event name suggestions are direction-specific, verified against the 98-file lab corpus:
 * Poke and Run_Camera_Ticks only ever appear on Din (inputs the animal triggers); Light and Pump
 * only ever appear on Dout (outputs you drive). Offering an output name on an input channel (or vice
 * versa) would suggest a physically wrong wiring, so each direction lists only its real events.
 */
describe('behavioralEventsNames — direction-specific suggestions', () => {
  it('offers only INPUT events for a Din channel', () => {
    expect(behavioralEventsNames('Din')).toEqual(['Poke', 'Run_Camera_Ticks']);
  });

  it('offers only OUTPUT events for a Dout channel', () => {
    expect(behavioralEventsNames('Dout')).toEqual(['Light', 'Pump']);
  });

  it('offers the union for an unknown/Other direction and the no-arg (legacy) call', () => {
    const union = ['Poke', 'Run_Camera_Ticks', 'Light', 'Pump'];
    expect(behavioralEventsNames()).toEqual(union);
    expect(behavioralEventsNames('Accel')).toEqual(union);
  });

  it('does not suggest names that never appear in real data (Home box camera, Sleep)', () => {
    const all = behavioralEventsNames();
    expect(all).not.toContain('Home box camera');
    expect(all).not.toContain('Sleep');
  });
});
