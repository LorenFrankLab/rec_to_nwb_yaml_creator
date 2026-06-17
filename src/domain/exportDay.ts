/**
 * @fileoverview The shared single-day export core.
 *
 * `exportDayFile(animal, day, { actions, strict })` is the one place that turns a recording day into a
 * downloaded YAML file: it runs the encoder-stability/parity gate (`checkShadowExport`), and — when the
 * gate passes (or is debug-overridden) — builds the deterministic filename, downloads the canonical
 * bytes, and marks the day exported in its display-only lifecycle state. It is the SINGLE byte-producing
 * export unit shared by the Validation Summary's "Export Valid Only" batch and the animal page's
 * "Export selected" batch, so the parity behavior can never fork between them.
 *
 * It does NOT decide whether a day is *eligible* to export (validity / recovery status) — the caller
 * filters to exportable days first (the skip-on-invalid behavior). This function assumes the day is a
 * valid, in-place recording day and performs the download.
 */

import { mergeDayMetadata } from '../state/workspaceUtils';
import type { Animal, Day } from '../state/workspaceTypes';
import { checkShadowExport } from './shadowExport';
import { formatDeterministicFilename, downloadYamlFile } from '../io/yaml';

/** Whether a value is a non-null, non-array object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** The store write the export needs (marking the day exported in its lifecycle state). */
export interface ExportDayActions {
  updateDay: (dayId: string, patch: { state: Record<string, unknown> }) => void;
}

/** Options controlling the export gate. */
export interface ExportDayOptions {
  /** The store actions (to persist the exported flag). */
  actions: ExportDayActions;
  /** Strict mode (the `shadowExportStrict` flag): a parity mismatch blocks the download. */
  strict: boolean;
}

/**
 * The outcome of a single-day export:
 *  - `exported`   — the parity gate passed and the file downloaded.
 *  - `overridden` — a parity mismatch was downloaded anyway (strict off): the bytes shipped, but the
 *                   mismatch must be surfaced loudly (never silent).
 *  - `skipped`    — a parity mismatch in strict mode: NOT downloaded.
 *  - `failed`     — the encode/merge threw (corrupt config): NOT downloaded.
 */
export type ExportDayOutcome =
  | { kind: 'exported' }
  | { kind: 'overridden'; diff: string }
  | { kind: 'skipped'; diff: string }
  | { kind: 'failed'; message: string };

/**
 * Export ONE recording day to a downloaded YAML file, running the encoder-stability/parity gate first.
 *
 * @param animal - The owning animal (provides the shared metadata the day merges with).
 * @param day - The recording day to export.
 * @param options - The store actions + the strict-mode flag.
 * @param options.actions - The store's `updateDay` (to persist the exported flag).
 * @param options.strict - Strict mode: a parity mismatch blocks the download.
 * @returns The export outcome (exported / overridden / skipped / failed) for the caller to report.
 */
export function exportDayFile(animal: Animal, day: Day, { actions, strict }: ExportDayOptions): ExportDayOutcome {
  try {
    const { ok, yaml, diff } = checkShadowExport(animal, day);

    // Parity mismatch in strict mode: skip and report, never download.
    if (!ok && strict) return { kind: 'skipped', diff: diff as string };

    // ok, or the debug override (strict off): inject the filename-only EXPERIMENT_DATE key the merge
    // does not carry, then download the canonical bytes.
    const fileName = formatDeterministicFilename({
      ...mergeDayMetadata(animal, day),
      EXPERIMENT_DATE_in_format_mmddYYYY: (day as { experimentDate?: string }).experimentDate as string,
    });
    downloadYamlFile(fileName, yaml);

    // Persist the export into the day's lifecycle state (display-only — `state` is never part of the
    // exported YAML, so byte-identity holds). Guarded so a failed write does not lose the download.
    try {
      const prevState = isRecord(day.state) ? day.state : {};
      actions.updateDay(day.id as string, {
        state: { ...prevState, validationDeferred: false, deferredEpochs: [], exported: true },
      });
    } catch (persistErr) {
      // eslint-disable-next-line no-console
      console.error(`[export-day] could not mark day "${day.id}" exported:`, persistErr);
    }

    return ok ? { kind: 'exported' } : { kind: 'overridden', diff: diff as string };
  } catch (err) {
    // A throw (e.g. encoder/merge failure on a corrupt config) must not crash the batch.
    // eslint-disable-next-line no-console
    console.error(`[export-day] export failed for "${day.id}":`, err);
    return { kind: 'failed', message: (err as Error).message };
  }
}
