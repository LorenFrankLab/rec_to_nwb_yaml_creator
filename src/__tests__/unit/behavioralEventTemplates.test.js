import { describe, it, expect } from 'vitest';
import { behavioralEventTemplates } from '../../valueList';

/**
 * Standard-set templates bulk-add canonical DIO event sets so a blank day can be populated in one
 * click. The naming convention is load-bearing (verified against 98 real lab YAMLs): the number is
 * appended to the label with NO separator (`Poke1`, not `Poke_1`), and it is a per-label instance
 * count, NOT the DIO channel index. The `description` is a well-formed `Din`/`Dout` line built via
 * `joinDioDescription`; the channel ranges are a sensible default the user re-points as needed.
 */
describe('behavioralEventTemplates', () => {
  const byId = (id) => behavioralEventTemplates().find((t) => t.id === id);

  it('the "6 pokes" set is Poke1…Poke6 on Din1…Din6 (no separator)', () => {
    expect(byId('pokes-6').rows).toEqual([
      { name: 'Poke1', description: 'Din1' },
      { name: 'Poke2', description: 'Din2' },
      { name: 'Poke3', description: 'Din3' },
      { name: 'Poke4', description: 'Din4' },
      { name: 'Poke5', description: 'Din5' },
      { name: 'Poke6', description: 'Din6' },
    ]);
  });

  it('the "6 lights" set is Light1…Light6 on Dout1…Dout6', () => {
    expect(byId('lights-6').rows).toEqual([
      { name: 'Light1', description: 'Dout1' },
      { name: 'Light2', description: 'Dout2' },
      { name: 'Light3', description: 'Dout3' },
      { name: 'Light4', description: 'Dout4' },
      { name: 'Light5', description: 'Dout5' },
      { name: 'Light6', description: 'Dout6' },
    ]);
  });

  it('the "6 pumps" set is Pump1…Pump6 on Dout7…Dout12 (distinct Dout range from lights, matching real data Pump1=Dout7)', () => {
    expect(byId('pumps-6').rows).toEqual([
      { name: 'Pump1', description: 'Dout7' },
      { name: 'Pump2', description: 'Dout8' },
      { name: 'Pump3', description: 'Dout9' },
      { name: 'Pump4', description: 'Dout10' },
      { name: 'Pump5', description: 'Dout11' },
      { name: 'Pump6', description: 'Dout12' },
    ]);
  });

  it('the light and pump output sets occupy DISJOINT Dout ranges so applying both composes (no collision)', () => {
    const lightDescriptions = byId('lights-6').rows.map((r) => r.description);
    const pumpDescriptions = byId('pumps-6').rows.map((r) => r.description);
    const overlap = lightDescriptions.filter((d) => pumpDescriptions.includes(d));
    expect(overlap).toEqual([]);
  });

  it('every template has a stable id, a human label, and non-empty rows', () => {
    const templates = behavioralEventTemplates();
    expect(templates.length).toBeGreaterThan(0);
    templates.forEach((template) => {
      expect(typeof template.id).toBe('string');
      expect(template.id).not.toBe('');
      expect(typeof template.label).toBe('string');
      expect(template.label).not.toBe('');
      expect(Array.isArray(template.rows)).toBe(true);
      expect(template.rows.length).toBeGreaterThan(0);
    });
  });

  it('no template name uses the reverted Label_<digits> (underscore-before-number) form', () => {
    behavioralEventTemplates().forEach((template) => {
      template.rows.forEach((row) => {
        expect(row.name).not.toMatch(/_\d+$/);
      });
    });
  });
});
