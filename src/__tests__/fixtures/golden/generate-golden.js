/**
 * Script to generate golden YAML fixtures
 *
 * This script reads existing valid YAML files, parses them, and re-exports them
 * using the convertObjectToYAMLString function to establish deterministic output baselines.
 *
 * YAML Library Version: 2.2.2 (as of 2025-10-26)
 * Note: Golden fixtures are tied to this YAML library version. If the library is
 * upgraded, review the output diff and regenerate golden fixtures if needed.
 *
 * Usage: node src/__tests__/fixtures/golden/generate-golden.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import { convertObjectToYAMLString } from '../../../utils/yamlExport.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define source and destination paths
const validFixturesDir = path.join(__dirname, '../valid');
const goldenFixturesDir = __dirname;

// Source files to convert to golden fixtures
const sourceFiles = [
  '20230622_sample_metadata.yml',
  'minimal-valid.yml',
  'realistic-session.yml'
];

console.log('🔄 Generating golden YAML fixtures...');
console.log(`📦 Using YAML library version: ${YAML.version || '2.2.2'}\n`);

let hasErrors = false;

sourceFiles.forEach(filename => {
  try {
    const sourcePath = path.join(validFixturesDir, filename);
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
