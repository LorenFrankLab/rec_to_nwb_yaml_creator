/**
 * Storage-budget gate for keeping the pilot on localStorage (fix plan, increment 1).
 *
 * The persistence layer holds up to FOUR copies of the workspace envelope (autosave blob,
 * last-known-good checkpoint, pre-migration copy, quarantine) plus an export receipt per day.
 * localStorage is ~5 MiB per origin on the smallest supported browser (Safari), so a representative
 * long study — 3 animals × 200 days on a 128-channel implant, every day fully populated, receipts
 * kept — must fit with headroom, and a full-blob save must stay well under a keystroke debounce.
 *
 * Measured 2026-09-14 (M-series Mac, Node 26, jsdom): see IMPLEMENTATION_STATUS.md for the
 * recorded numbers. The assertions are loose bounds, not the measurement.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { buildLongStudyWorkspace } from '../../__tests__/fixtures/longStudyWorkspace';
import { mergeDayMetadata } from '../workspaceUtils';
import { encodeYaml } from '../../io/yaml';
import { saveWorkspace, WORKSPACE_STORAGE_KEY, resetPersistenceForTests } from '../persistence';

/** The conservative per-origin quota we budget against (Safari's Web Storage limit). */
const QUOTA_BYTES = 5 * 1024 * 1024;

const utf8Bytes = (text) => new TextEncoder().encode(text).length;

describe('localStorage budget — representative long study', () => {
  beforeEach(() => {
    resetPersistenceForTests();
    window.localStorage.clear();
  });

  it('MEASUREMENT: four localStorage copies WITH receipt YAML do not fit — which is why copies + YAML live in IndexedDB', () => {
    // Build once without receipts to produce real YAML bytes from the real merge/encoder, then
    // attach those as receipts so the receipt cost is the real per-day YAML size.
    const base = buildLongStudyWorkspace({ withReceipts: false });
    const sampleAnimal = Object.values(base.animals)[0];
    const sampleDay = base.days[sampleAnimal.days[0]];
    const yaml = encodeYaml(mergeDayMetadata(sampleAnimal, sampleDay));
    const workspace = buildLongStudyWorkspace({ withReceipts: true, receiptYaml: () => yaml });

    const blob = JSON.stringify({ schemaVersion: 4, workspace });
    const blobBytes = utf8Bytes(blob);
    const dayCount = Object.keys(workspace.days).length;
    const yamlBytes = utf8Bytes(yaml);
    // eslint-disable-next-line no-console
    console.info(
      `[storage-budget] with-YAML-receipts: days=${dayCount} yaml/day=${yamlBytes}B blob=${(blobBytes / 1024).toFixed(0)}KiB ` +
        `4 copies=${((4 * blobBytes) / 1024 / 1024).toFixed(2)}MiB of ${(QUOTA_BYTES / 1024 / 1024).toFixed(0)}MiB`
    );
    expect(dayCount).toBe(600);
    // Documents the decision: this shape is NOT localStorage-viable (it is ~10× the quota).
    expect(4 * blobBytes).toBeGreaterThan(QUOTA_BYTES);
  });

  it('the autosave blob (receipts WITHOUT YAML bytes) for the long study stays under 60% of the smallest quota', () => {
    const workspace = buildLongStudyWorkspace({ withReceipts: true, receiptYaml: () => '' });
    // Receipt bytes live in the IndexedDB side store; the day carries only the small receipt record.
    for (const day of Object.values(workspace.days)) delete day.exportReceipt.yaml;
    const blobBytes = utf8Bytes(JSON.stringify({ schemaVersion: 4, workspace }));
    // eslint-disable-next-line no-console
    console.info(
      `[storage-budget] autosave blob: days=${Object.keys(workspace.days).length} ` +
        `blob=${(blobBytes / 1024).toFixed(0)}KiB = ${((100 * blobBytes) / QUOTA_BYTES).toFixed(0)}% of ${(QUOTA_BYTES / 1024 / 1024).toFixed(0)}MiB`
    );
    expect(blobBytes).toBeLessThan(QUOTA_BYTES * 0.6);
  });

  it('a full-blob save of the long study completes well inside the autosave debounce', () => {
    const workspace = buildLongStudyWorkspace({ withReceipts: false });
    const t0 = performance.now();
    saveWorkspace(workspace);
    const elapsed = performance.now() - t0;
    // eslint-disable-next-line no-console
    console.info(`[storage-budget] saveWorkspace(600 days) = ${elapsed.toFixed(1)}ms`);
    expect(window.localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeTruthy();
    // The debounce is 500ms; a save must not approach it (jsdom's localStorage is slower than a
    // browser's, so this bound is generous).
    expect(elapsed).toBeLessThan(250);
  });
});
