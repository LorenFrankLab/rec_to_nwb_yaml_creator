/**
 * Script to generate golden YAML fixtures
 *
 * This script parses each source YAML and re-exports it via encodeYaml to establish
 * deterministic byte baselines. Most fixtures are sourced from their hand-authored
 * valid/ file; realistic-session.yml is re-encoded from its own frozen golden bytes
 * (see the selfSourcedFixtures note below for why).
 *
 * YAML Library Version: 2.8.1 (as of 2025-10-26)
 * Note: Golden fixtures are tied to this YAML library version. If the library is
 * upgraded, review the output diff and regenerate golden fixtures if needed.
 *
 * Usage: node src/__tests__/fixtures/golden/generate-golden.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
// Explicit `.ts` extension: this maintenance script is run with plain `node`
// (Node 26, per .nvmrc, strips TypeScript types natively), and Node's ESM loader
// does not resolve extensionless relative imports. Vitest's baseline test imports
// this same module extension-less because Vite resolves extensions.
import { encodeYaml as convertObjectToYAMLString } from '../../../io/yaml.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define source and destination paths
const validFixturesDir = path.join(__dirname, '../valid');
const goldenFixturesDir = __dirname;

// Most golden fixtures are (re)generated from their hand-authored valid/ source.
const validSourcedFixtures = [
  '20230622_sample_metadata.yml',
  '20230622_sample_metadataProbeReconfig.yml',
  'minimal-valid.yml',
];

// realistic-session.yml is a deliberate exception (the Phase 6 "intentional semantic split"):
// its golden is a FROZEN, never-validated byte-baseline that encodes KNOWN-INVALID legacy data
// (a globally-incrementing tetrode channel map `0..31`, and epoch-specific sleep descriptions).
// The validated valid/ source and the new-path builder are the CORRECTED source of truth and
// intentionally diverge — so this golden must NOT be regenerated from valid/ (that would clobber
// the split). It is instead re-encoded IN PLACE from its own current golden bytes, which keeps it
// byte-stable across a yaml-library upgrade WITHOUT pulling in the corrected content. See the
// header of src/pages/DayEditor/__tests__/exportParity.integration.test.js (and its "rejects the
// legacy globally-incrementing channel map" test) and src/__tests__/fixtures/workspaceBuilders.js.
const selfSourcedFixtures = ['realistic-session.yml'];

// Pair each fixture with the file the regeneration READS. The write target is always the golden dir.
const fixtures = [
  ...validSourcedFixtures.map((filename) => ({
    filename,
    sourcePath: path.join(validFixturesDir, filename),
  })),
  ...selfSourcedFixtures.map((filename) => ({
    filename,
    sourcePath: path.join(goldenFixturesDir, filename),
  })),
];

console.log('🔄 Generating golden YAML fixtures...');
console.log(`📦 Using YAML library version: ${YAML.version || '2.8.1'}\n`);

let hasErrors = false;

fixtures.forEach(({ filename, sourcePath }) => {
  try {
    const goldenPath = path.join(goldenFixturesDir, filename);

    // Read and parse the source YAML
    const sourceContent = fs.readFileSync(sourcePath, 'utf8');
    const parsedData = YAML.parse(sourceContent);

    // Re-export using our export function to establish deterministic format
    const goldenYaml = convertObjectToYAMLString(parsedData);

    // Write golden fixture
    fs.writeFileSync(goldenPath, goldenYaml, 'utf8');

    // Verify round-trip
    const verifyContent = fs.readFileSync(goldenPath, 'utf8');
    const verifyParsed = YAML.parse(verifyContent);
    const verifyExported = convertObjectToYAMLString(verifyParsed);

    if (verifyExported === verifyContent) {
      console.log(`✅ Generated: ${filename} (verified round-trip)`);
      console.log(`   Source: ${sourcePath}`);
      console.log(`   Golden: ${goldenPath}\n`);
    } else {
      console.error(`⚠️  Warning: ${filename} failed round-trip verification`);
      console.error(`   Source: ${sourcePath}`);
      console.error(`   Golden: ${goldenPath}\n`);
      hasErrors = true;
    }
  } catch (error) {
    console.error(`❌ Failed to generate ${filename}:`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    console.error(`   Attempted to read: ${path.join(validFixturesDir, filename)}`);
    console.error(`   Attempted to write: ${path.join(goldenFixturesDir, filename)}\n`);
    hasErrors = true;
  }
});

if (hasErrors) {
  console.error('⚠️  Some fixtures failed to generate!');
  process.exit(1);
} else {
  console.log('✨ Golden fixture generation complete!');
}
