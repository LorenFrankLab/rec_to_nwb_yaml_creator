/**
 * Parse helper for the YAML import UI: turn the raw File[] the picker/drop-zone hands us into
 * `{ decodedFiles, parseFailures }` for `planImport`. It must NEVER throw on a bad file — a parse
 * error or a non-object document is collected into `parseFailures` with a reason so failures are
 * visible, never silent.
 */
import { describe, it, expect } from 'vitest';
import { parseImportFiles } from '../importYaml';

/**
 * Build a minimal File-like object whose `.text()` resolves to the given string. The helper models
 * the browser's `File.text()` directly (jsdom's File constructor does not always expose it), which
 * is exactly the API the parse helper relies on at runtime.
 * @param {string} name - The file name.
 * @param {string} text - The file contents.
 * @returns {{ name: string, text: () => Promise<string> }}
 */
function makeFile(name, text) {
  return { name, text: () => Promise.resolve(text) };
}

describe('parseImportFiles', () => {
  it('decodes a valid YAML object file into decodedFiles with its flatModel + sourceName', async () => {
    const file = makeFile('06222023_remy_metadata.yml', 'subject:\n  subject_id: remy\nsession_id: remy_20230622\n');

    const { decodedFiles, parseFailures } = await parseImportFiles([file]);

    expect(parseFailures).toEqual([]);
    expect(decodedFiles).toHaveLength(1);
    expect(decodedFiles[0].sourceName).toBe('06222023_remy_metadata.yml');
    expect(decodedFiles[0].flatModel).toMatchObject({
      subject: { subject_id: 'remy' },
      session_id: 'remy_20230622',
    });
  });

  it('collects a syntactically invalid YAML file into parseFailures with a reason (never throws)', async () => {
    const bad = makeFile('broken.yml', 'subject: [unterminated\n  : : :');

    const { decodedFiles, parseFailures } = await parseImportFiles([bad]);

    expect(decodedFiles).toEqual([]);
    expect(parseFailures).toHaveLength(1);
    expect(parseFailures[0].sourceName).toBe('broken.yml');
    expect(parseFailures[0].reason).toBeTruthy();
  });

  it('collects a non-object YAML document (scalar/array) into parseFailures', async () => {
    const scalar = makeFile('scalar.yml', '"just a string"\n');
    const list = makeFile('list.yml', '- one\n- two\n');

    const { decodedFiles, parseFailures } = await parseImportFiles([scalar, list]);

    expect(decodedFiles).toEqual([]);
    expect(parseFailures.map((f) => f.sourceName).sort()).toEqual(['list.yml', 'scalar.yml']);
    for (const failure of parseFailures) {
      expect(failure.reason).toBeTruthy();
    }
  });

  it('partitions a mixed batch: valid files decode, bad files fail, order preserved', async () => {
    const good1 = makeFile('06222023_remy_metadata.yml', 'subject:\n  subject_id: remy\n');
    const bad = makeFile('oops.yml', ': : :\n  bad');
    const good2 = makeFile('06222023_totoro_metadata.yml', 'subject:\n  subject_id: totoro\n');

    const { decodedFiles, parseFailures } = await parseImportFiles([good1, bad, good2]);

    expect(decodedFiles.map((f) => f.sourceName)).toEqual([
      '06222023_remy_metadata.yml',
      '06222023_totoro_metadata.yml',
    ]);
    expect(parseFailures.map((f) => f.sourceName)).toEqual(['oops.yml']);
  });

  it('returns empty arrays for an empty / non-array input', async () => {
    expect(await parseImportFiles([])).toEqual({ decodedFiles: [], parseFailures: [] });
    expect(await parseImportFiles(null)).toEqual({ decodedFiles: [], parseFailures: [] });
  });
});
