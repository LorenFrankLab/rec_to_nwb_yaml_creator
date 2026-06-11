import { describe, it, expect } from 'vitest';
import { mergeDayMetadata } from '../workspaceUtils';
import { encodeYaml } from '../../io/yaml';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';

/**
 * A blank (unused) behavioral-event channel must not be written to the exported YAML. The DIO
 * editor presents every hardware channel; only the ones the user actually names are real events.
 * An empty/whitespace-only name is "unused" and is excluded from `behavioral_events` on export
 * (the schema requires a non-empty name, and a blank one would otherwise emit an invalid event).
 */
describe('export excludes blank-named behavioral events', () => {
  it('drops events whose name is empty or whitespace-only, keeps the named ones', () => {
    const { animal, day } = buildRealisticWorkspace();
    day.behavioral_events = [
      { description: 'Din1', name: 'Poke1' },
      { description: 'Din2', name: '' }, // unused channel
      { description: 'Din3', name: '   ' }, // whitespace-only → unused
      { description: 'Dout7', name: 'Pump1' },
    ];

    const merged = mergeDayMetadata(animal, day);

    expect(merged.behavioral_events).toEqual([
      { description: 'Din1', name: 'Poke1' },
      { description: 'Dout7', name: 'Pump1' },
    ]);
  });

  it('encodes byte-identically whether or not blank channels sit between the named ones', () => {
    // Filtering a blank middle element must not perturb key order / indentation of the surviving
    // events — the golden-baseline (data-corruption) safety net for the new filter path.
    const a = buildRealisticWorkspace();
    a.day.behavioral_events = [
      { description: 'Din1', name: 'Poke1' },
      { description: 'Din5', name: '' }, // blank in the middle
      { description: 'Dout7', name: 'Pump1' },
    ];
    const b = buildRealisticWorkspace();
    b.day.behavioral_events = [
      { description: 'Din1', name: 'Poke1' },
      { description: 'Dout7', name: 'Pump1' },
    ];

    expect(encodeYaml(mergeDayMetadata(a.animal, a.day))).toBe(
      encodeYaml(mergeDayMetadata(b.animal, b.day))
    );
  });
});
