/**
 * @fileoverview Optogenetics business rules (extracted from rulesValidation.js, Phase split).
 *
 * trodes_to_nwb gates ALL optogenetics on the four sections being present + non-empty and on
 * exactly one excitation source, and unconditionally reads `optical_fiber[].reference` /
 * `virus_injection[].reference`. These rules block the partial / multi-source / missing-reference
 * states that would otherwise silently drop optogenetics or crash conversion. Pure; moved verbatim.
 */

import type { ValidationIssue, ValidationModel } from '../issueTypes';

import { optoFieldsPresence } from '../../domain/optoCompleteness';

const OPTO_POWER_WARNING_THRESHOLD_W = 1;
const TYPICAL_OPTO_POWER_W = 0.02;

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatMagnitude(value: number): string {
  return Number(value.toPrecision(6)).toString();
}

/**
 * The names used by more than one item, compared exactly as the converter compares them (no
 * trimming). Blank names are the schema's required check, never duplicates.
 *
 * @param items - The list to check (anything else counts as empty).
 * @returns The repeated names, each once, in first-seen order.
 */
function repeatedNames(items: unknown): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const name = item?.name;
    if (typeof name !== 'string' || name.trim() === '') return;
    if (seen.has(name)) repeated.add(name);
    seen.add(name);
  });
  return [...repeated];
}

/**
 * Rules 3 / 3c / 3b: optogenetics completeness, coordinate references, source power, single excitation
 * source, distinct device names, and what the NWB file records for several virus injections.
 *
 * @param model - The form data to validate.
 * @returns Validation issues.
 */
export function optogeneticsRules(model: ValidationModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Rule 3: Optogenetics all-or-nothing configuration. trodes_to_nwb gates ALL
  // optogenetics on FOUR keys each being present and non-empty (convert_optogenetics.py:
  // virus_injection, opto_excitation_source, optical_fiber, optogenetic_stimulation_software);
  // if any is missing it logs "No available optogenetic metadata" and silently returns,
  // producing an NWB with no optogenetics at all. So a partial opto session must block
  // export rather than convert to an opto-less file.
  // Field presence comes from the SINGLE shared predicate (domain/optoCompleteness) the
  // section-nav classifier (getAnimalOptoCompleteness) also consumes, so the export gate and the
  // nav count can never drift. The arrays use Array.isArray(...) && length > 0 (a corrupt non-array
  // value is NOT present); the software is a non-empty trimmed string — matching the converter's
  // len()>0 on the string.
  const optoPresence = optoFieldsPresence(model);
  const hasOptoSource = optoPresence.opto_excitation_source;
  const hasOpticalFiber = optoPresence.optical_fiber;
  const hasVirusInjection = optoPresence.virus_injection;
  const hasOptoSoftware = optoPresence.optogenetic_stimulation_software;
  const optoFieldsPresent = optoPresence.count;

  // Partial configuration detected (some but not all FOUR sections present).
  if (optoFieldsPresent > 0 && optoFieldsPresent < 4) {
    issues.push({
      path: 'optogenetics',
      code: 'partial_configuration',
      repairSurface: 'animal',
      severity: 'error',
      message:
        `Partial optogenetics configuration detected. All fields required (or none) — ` +
        `trodes_to_nwb silently drops ALL optogenetics unless every section is present: ` +
        `opto_excitation_source${hasOptoSource ? ' ✓' : ' ✗'}, ` +
        `optical_fiber${hasOpticalFiber ? ' ✓' : ' ✗'}, ` +
        `virus_injection${hasVirusInjection ? ' ✓' : ' ✗'}, ` +
        `optogenetic_stimulation_software${hasOptoSoftware ? ' ✓' : ' ✗'}`
    });
  }

  // Phase 9: `power_in_W` is written verbatim to NWB. Corpus review found milliwatt device
  // ratings (e.g. 200 mW) commonly entered into the Watts field as `200`, so warn-to-confirm above
  // the plausible optogenetics range without blocking genuine high-power sources.
  if (optoFieldsPresent > 0 && Array.isArray(model.opto_excitation_source)) {
    model.opto_excitation_source.forEach((source, i) => {
      const powerInW = finiteNumber(source?.power_in_W);
      if (powerInW == null || powerInW <= OPTO_POWER_WARNING_THRESHOLD_W) return;
      const typicalFactor = formatMagnitude(powerInW / TYPICAL_OPTO_POWER_W);
      const milliwattAlternative = formatMagnitude(powerInW / 1000);
      issues.push({
        path: `opto_excitation_source[${i}].power_in_W`,
        field: 'power_in_W',
        code: 'opto_power_watts_suspicious',
        repairSurface: 'animal',
        severity: 'warning',
        actionLabel: 'Review source power',
        message:
          `power_in_W: ${formatMagnitude(powerInW)} is ~${typicalFactor}x a typical ` +
          `optogenetic source (2-50 mW). If you meant milliwatts, enter ` +
          `${milliwattAlternative}. Confirm Watts to keep.`,
      });
    });
  }

  // Rule 3c: optical fibers and virus injections must carry a `reference`. trodes_to_nwb
  // reads `optical_fiber[].reference` / `virus_injection[].reference` UNCONDITIONALLY
  // (`metadata["reference"]`, KeyError if missing) in make_optical_fiber/make_virus_injection.
  // The schema does NOT require it and the editor must collect it, so an item lacking a
  // non-empty reference would crash conversion — block it here.
  const nonEmptyStr = (v: unknown) => typeof v === 'string' && v.trim() !== '';
  [
    ['optical_fiber', model.optical_fiber],
    ['virus_injection', model.virus_injection],
  ].forEach(([key, items]) => {
    if (!Array.isArray(items)) return;
    items.forEach((item, i) => {
      if (!nonEmptyStr(item?.reference)) {
        issues.push({
          path: `${key}[${i}].reference`,
          field: 'reference',
          code: 'missing_opto_reference',
          repairSurface: 'animal',
          severity: 'error',
          message:
            `${key === 'optical_fiber' ? 'Optical fiber' : 'Virus injection'} ${i + 1}` +
            `${nonEmptyStr(item?.name) ? ` ("${item.name}")` : ''} is missing a coordinate ` +
            `reference (e.g. "Bregma at the cortical surface"). trodes_to_nwb requires it and ` +
            `crashes without it.`,
        });
      }
    });
  });

  // Rule 3b: exactly one excitation source. trodes_to_nwb raises a ValueError when
  // opto_excitation_source has more than one entry ("Multiple optogenetic sources are
  // not supported"), so a 2+-source session must block export.
  if (Array.isArray(model.opto_excitation_source) && model.opto_excitation_source.length > 1) {
    issues.push({
      path: 'opto_excitation_source',
      code: 'multiple_excitation_sources',
      repairSurface: 'animal',
      severity: 'error',
      message:
        `${model.opto_excitation_source.length} optogenetic excitation sources are defined, ` +
        `but trodes_to_nwb supports exactly one (it raises an error on more). Keep a single ` +
        `opto_excitation_source.`
    });
  }

  // Device names: trodes_to_nwb adds the excitation source and every optical fiber to the NWB
  // file as devices named after them, and builds the virus injections into containers keyed by
  // name, so a repeated name (or a fiber named like the source) raises a ValueError.
  repeatedNames(model.optical_fiber).forEach((name) => {
    issues.push({
      path: 'optical_fiber',
      code: 'duplicate_opto_device_name',
      repairSurface: 'animal',
      severity: 'error',
      message:
        `More than one optical fiber is named "${name}". trodes_to_nwb stores each fiber as ` +
        `a device named after it and fails on a repeated name — give each fiber its own name.`,
    });
  });
  repeatedNames(model.virus_injection).forEach((name) => {
    issues.push({
      path: 'virus_injection',
      code: 'duplicate_opto_device_name',
      repairSurface: 'animal',
      severity: 'error',
      message:
        `More than one virus injection is named "${name}". trodes_to_nwb stores each ` +
        `injection under its name and fails on a repeated name — give each injection its own name.`,
    });
  });
  const sourceNames = new Set(
    (Array.isArray(model.opto_excitation_source) ? model.opto_excitation_source : [])
      .map((source) => source?.name)
      .filter((name): name is string => typeof name === 'string' && name.trim() !== '')
  );
  (Array.isArray(model.optical_fiber) ? model.optical_fiber : []).forEach((fiber, i) => {
    if (typeof fiber?.name === 'string' && sourceNames.has(fiber.name)) {
      issues.push({
        path: `optical_fiber[${i}].name`,
        field: 'name',
        code: 'duplicate_opto_device_name',
        repairSurface: 'animal',
        severity: 'error',
        message:
          `Optical fiber ${i + 1} is named "${fiber.name}", the same as the excitation source. ` +
          `trodes_to_nwb stores both as devices, which need different names.`,
      });
    }
  });

  // Several virus injections: trodes_to_nwb links every optical fiber to the FIRST injection, and
  // records each virus once with the titer of its first injection. Advisory: the file converts,
  // but the NWB file does not say what the injections were.
  if (Array.isArray(model.virus_injection) && model.virus_injection.length > 1) {
    const first = model.virus_injection[0];
    issues.push({
      path: 'virus_injection',
      code: 'multiple_virus_injections',
      repairSurface: 'animal',
      severity: 'warning',
      message:
        `${model.virus_injection.length} virus injections are listed. trodes_to_nwb links ` +
        `every optical fiber to the first one${first?.name ? ` ("${first.name}")` : ''}, so the ` +
        `NWB file will say every fiber targets that injection's virus.`,
    });
    const titers = new Map<string, unknown[]>();
    model.virus_injection.forEach((injection) => {
      const virus = injection?.virus_name;
      const titer = injection?.titer_in_vg_per_ml;
      if (typeof virus !== 'string' || virus === '' || titer === undefined || titer === null || titer === '') return;
      const seen = titers.get(virus) ?? [];
      if (!seen.some((value) => Number(value) === Number(titer))) seen.push(titer);
      titers.set(virus, seen);
    });
    titers.forEach((values, virus) => {
      if (values.length < 2) return;
      issues.push({
        path: 'virus_injection',
        code: 'conflicting_virus_titers',
        repairSurface: 'animal',
        severity: 'warning',
        message:
          `Virus "${virus}" is injected with different titers (${values.join(', ')} vg/ml). ` +
          `trodes_to_nwb records the virus once, with the first titer (${String(values[0])}); the ` +
          `others are lost.`,
      });
    });
  }

  return issues;
}
