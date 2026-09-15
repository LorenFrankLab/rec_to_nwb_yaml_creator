/**
 * Finding F5 — a multi-date import preserves each source file's SESSION facts.
 *
 * Two files for the same animal with different experimenter lists (the real Emmett 2026-01-18 vs
 * 2026-02-04 shape) import into one animal with each day keeping its own team; re-exporting each
 * day reproduces its file, not the latest file's team. The animal-level default becomes the latest
 * file's team (for days created later).
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { encodeYaml, decodeYaml } from '../../io/yaml';
import { mergeDayMetadata, createDefaultWorkspace } from '../workspaceUtils';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';
import { useStore } from '../store';
import { planImport } from '../yamlImportPlan';
import { applyImportPlan } from '../yamlImportApply';

/**
 * @param {string} date
 * @param {string[]} names
 * @param {object|undefined} opto
 * @returns {{sourceName: string, flatModel: object}}
 */
function fileFor(date, names, opto) {
  const { animal, day } = buildRealisticWorkspace();
  animal.experimenters = { ...animal.experimenters, experimenter_name: names };
  if (opto) animal.optogenetics = opto;
  day.id = `remy-${date}`;
  day.date = date;
  day.session = { ...day.session, session_id: `remy_${date.replace(/-/g, '')}` };
  const flat = decodeYaml(encodeYaml(mergeDayMetadata(animal, day)));
  return { sourceName: `${date.replace(/-/g, '')}_remy_metadata.yml`, flatModel: flat };
}

const OPTO = {
  opto_excitation_source: [{ name: 'laser', model_name: 'X', description: 'd', wavelength_in_nm: 470, power_in_W: 0.01, intensity_in_W_per_m2: 1 }],
  optical_fiber: [{ name: 'f', hardware_name: 'h', implanted_fiber_description: 'i', location: 'CA1', hemisphere: 'left', ap_in_mm: 1, ml_in_mm: 1, dv_in_mm: 1, roll_in_deg: 0, pitch_in_deg: 0, yaw_in_deg: 0, reference: 'bregma', excitation_source: 'laser' }],
  virus_injection: [{ name: 'v', description: 'd', hemisphere: 'left', location: 'CA1', ap_in_mm: 1, ml_in_mm: 1, dv_in_mm: 1, roll_in_deg: 0, pitch_in_deg: 0, yaw_in_deg: 0, reference: 'bregma', virus_name: 'AAV', titer_in_vg_per_ml: 1e12, volume_in_uL: 0.5 }],
  optogenetic_stimulation_software: 'fsgui',
};

describe('multi-date import preserves per-file session facts (F5)', () => {
  it('two files with different teams keep their own team per day; the latest is only the default', () => {
    const jan = fileFor('2026-01-18', ['Doe, Jane', 'Roe, Richard']);
    const feb = fileFor('2026-02-04', ['Doe, Jane', 'Roe, Richard', 'Poe, Edgar']);
    const plan = planImport([feb, jan], createDefaultWorkspace());
    expect(plan.animals).toHaveLength(1);
    const divergence = plan.animals[0].divergences.find((d) => d.field === 'experimenters');
    expect(divergence?.detail).toMatch(/each day keeps its own file/i);

    const { result } = renderHook(() => useStore());
    act(() => {
      applyImportPlan(plan, result.current.actions, { workspace: result.current.model.workspace });
    });
    const ws = result.current.model.workspace;
    const animal = ws.animals.remy;
    const dJan = ws.days['remy-2026-01-18'];
    const dFeb = ws.days['remy-2026-02-04'];
    expect(dJan.experimenters.experimenter_name).toEqual(['Doe, Jane', 'Roe, Richard']);
    expect(dFeb.experimenters.experimenter_name).toEqual(['Doe, Jane', 'Roe, Richard', 'Poe, Edgar']);
    expect(dJan.provenance.fields.experimenters).toBe('import');
    // The animal default (for NEW days) is the latest file's team.
    expect(animal.experimenters.experimenter_name).toEqual(['Doe, Jane', 'Roe, Richard', 'Poe, Edgar']);
    // Re-export reproduces each file's team.
    expect(mergeDayMetadata(animal, dJan).experimenter_name).toEqual(jan.flatModel.experimenter_name);
    expect(mergeDayMetadata(animal, dFeb).experimenter_name).toEqual(feb.flatModel.experimenter_name);
  });

  it('a later edit of the animal default team does not change an imported day', () => {
    const jan = fileFor('2026-01-18', ['Doe, Jane']);
    const plan = planImport([jan], createDefaultWorkspace());
    const { result } = renderHook(() => useStore());
    act(() => {
      applyImportPlan(plan, result.current.actions, { workspace: result.current.model.workspace });
    });
    act(() => {
      result.current.actions.updateAnimal('remy', { experimenters: { experimenter_name: ['Someone, New'] } });
    });
    const ws = result.current.model.workspace;
    expect(mergeDayMetadata(ws.animals.remy, ws.days['remy-2026-01-18']).experimenter_name).toEqual(['Doe, Jane']);
  });

  it('an opto file and a non-opto file for the same animal each keep their own setup', () => {
    const plain = fileFor('2026-01-18', ['Doe, Jane']);
    const opto = fileFor('2026-02-04', ['Doe, Jane'], OPTO);
    const plan = planImport([plain, opto], createDefaultWorkspace());
    const { result } = renderHook(() => useStore());
    act(() => {
      applyImportPlan(plan, result.current.actions, { workspace: result.current.model.workspace });
    });
    const ws = result.current.model.workspace;
    const plainDay = ws.days['remy-2026-01-18'];
    const optoDay = ws.days['remy-2026-02-04'];
    expect(plainDay.optogenetics).toBeNull();
    expect(optoDay.optogenetics.optogenetic_stimulation_software).toBe('fsgui');
    expect(mergeDayMetadata(ws.animals.remy, plainDay).opto_excitation_source).toEqual([]);
    expect(mergeDayMetadata(ws.animals.remy, optoDay).opto_excitation_source).toHaveLength(1);
  });
});
