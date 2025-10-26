/**
 * Script to generate golden YAML fixtures
 *
 * This script reads existing valid YAML files, parses them, and re-exports them
 * using the convertObjectToYAMLString function to establish deterministic output baselines.
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

console.log('🔄 Generating golden YAML fixtures...\n');

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

    console.log(`✅ Generated: ${filename}`);
    console.log(`   Source: ${sourcePath}`);
    console.log(`   Golden: ${goldenPath}\n`);
  } catch (error) {
    console.error(`❌ Failed to generate ${filename}:`);
    console.error(`   Error: ${error.message}\n`);
  }
});

console.log('✨ Golden fixture generation complete!');
