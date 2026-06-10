import { describe, it, expect } from 'vitest';
import { behavioralEventTemplates } from '../../valueList';
import { duplicateBehavioralEventDescriptions } from '../../validation/behavioralEvents';

/**
 * The standard-set template reproduces the lab's real behavioral-event set in one click. It is
 * grounded in the actual recorded YAMLs: across the 98-file corpus (4 subjects) every session uses
 * the SAME 19-event set, in order — Poke1–6 on Din1–6, Run_Camera_Ticks on Din13, Light1–6 on
 * Dout1–6, Pump1–6 on Dout7–12. The number in a name is a per-label INSTANCE count, not the DIO
 * channel (Pump1 = Dout7). The channels match an ECU board (Din1–32 / Dout1–32) and are a
 * re-pointable starting point — auto-numbering covers any other board/wiring.
 */
describe('behavioralEventTemplates — the standard set', () => {
  const standard = () => behavioralEventTemplates()[0];

  it('reproduces the real 19-event lab set, in order', () => {
    expect(standard().rows).toEqual([
      { name: 'Poke1', description: 'Din1' },
      { name: 'Poke2', description: 'Din2' },
      { name: 'Poke3', description: 'Din3' },
      { name: 'Poke4', description: 'Din4' },
      { name: 'Poke5', description: 'Din5' },
      { name: 'Poke6', description: 'Din6' },
      { name: 'Run_Camera_Ticks', description: 'Din13' },
      { name: 'Light1', description: 'Dout1' },
      { name: 'Light2', description: 'Dout2' },
      { name: 'Light3', description: 'Dout3' },
      { name: 'Light4', description: 'Dout4' },
      { name: 'Light5', description: 'Dout5' },
      { name: 'Light6', description: 'Dout6' },
      { name: 'Pump1', description: 'Dout7' },
      { name: 'Pump2', description: 'Dout8' },
      { name: 'Pump3', description: 'Dout9' },
      { name: 'Pump4', description: 'Dout10' },
      { name: 'Pump5', description: 'Dout11' },
      { name: 'Pump6', description: 'Dout12' },
    ]);
  });

  it('names pumps by instance count, NOT by channel (Pump1 on Dout7)', () => {
    const pump1 = standard().rows.find((r) => r.name === 'Pump1');
    expect(pump1.description).toBe('Dout7');
  });

  it('includes Run_Camera_Ticks on Din13 (underscored, matching 98/98 real files)', () => {
    const ticks = standard().rows.find((r) => r.description === 'Din13');
    expect(ticks.name).toBe('Run_Camera_Ticks');
  });

  it('has unique names and unique descriptions (no Rule 14 / Rule 17 collision on apply)', () => {
    const { rows } = standard();
    const names = rows.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
    expect(duplicateBehavioralEventDescriptions(rows).size).toBe(0);
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

  it('no numbered name uses the reverted Label_<digits> (underscore-before-number) form', () => {
    behavioralEventTemplates().forEach((template) => {
      template.rows.forEach((row) => {
        // Run_Camera_Ticks has underscores but no trailing number, so it must not match either.
        expect(row.name).not.toMatch(/_\d+$/);
      });
    });
  });
});
