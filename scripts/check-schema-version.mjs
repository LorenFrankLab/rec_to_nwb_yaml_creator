#!/usr/bin/env node

/**
 * Schema Version Validation Script
 *
 * This script ensures that the nwb_schema.json in the web app matches the expected version
 * from the trodes_to_nwb Python package. This prevents schema drift between the two repositories.
 *
 * Usage:
 *   node scripts/check-schema-version.mjs [--expected-version VERSION]
 *
 * Options:
 *   --expected-version VERSION  Expected schema version (default: read from schema)
 *   --help                      Show this help message
 *
 * Exit Codes:
 *   0 - Schema version is valid
 *   1 - Schema version mismatch or missing
 *   2 - Invalid arguments or file errors
 *
 * Example:
 *   node scripts/check-schema-version.mjs --expected-version 1.0.1
 *
 * CI Integration:
 *   Add to .github/workflows/test.yml:
 *     - name: Check schema version
 *       run: node scripts/check-schema-version.mjs --expected-version 1.0.1
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Print colored message to console
 * @param {string} color - Color name from colors object
 * @param {string} message - Message to print
 */
function print(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
Schema Version Validation Script

Usage:
  node scripts/check-schema-version.mjs [OPTIONS]

Options:
  --expected-version VERSION  Expected schema version (default: read from schema)
  --help                      Show this help message

Description:
  Validates that the nwb_schema.json version field matches the expected version.
  This ensures schema synchronization between the web app and Python package.

Examples:
  # Check schema has version field
  node scripts/check-schema-version.mjs

  # Check schema version matches expected
  node scripts/check-schema-version.mjs --expected-version 1.0.1

Exit Codes:
  0 - Schema version is valid
  1 - Schema version mismatch or missing
  2 - Invalid arguments or file errors
`);
}

/**
 * Parse command line arguments
 * @param {string[]} args - Command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs(args) {
  const options = {
    expectedVersion: null,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--expected-version') {
      if (i + 1 >= args.length) {
        print('red', '❌ Error: --expected-version requires a value');
        process.exit(2);
      }
      options.expectedVersion = args[++i];
    } else {
      print('red', `❌ Error: Unknown argument: ${arg}`);
      print('yellow', 'Run with --help for usage information');
      process.exit(2);
    }
  }

  return options;
}

/**
 * Read and parse schema JSON file
 * @param {string} schemaPath - Path to schema file
 * @returns {Object} Parsed schema
 */
function readSchema(schemaPath) {
  try {
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    return JSON.parse(schemaContent);
  } catch (error) {
    print('red', `❌ Error reading schema file: ${error.message}`);
    print('yellow', `   Path: ${schemaPath}`);
    process.exit(2);
  }
}

/**
 * Validate schema version field exists
 * @param {Object} schema - Parsed schema object
 * @returns {boolean} True if version field exists
 */
function hasVersionField(schema) {
  return 'version' in schema && typeof schema.version === 'string';
}

/**
 * Compare two version strings (semver-lite)
 * @param {string} version1 - First version
 * @param {string} version2 - Second version
 * @returns {boolean} True if versions match
 */
function versionsMatch(version1, version2) {
  // Simple string comparison (can be extended to full semver if needed)
  return version1 === version2;
}

/**
 * Main validation function
 */
function main() {
  // Parse arguments
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  // Show help if requested
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  // Paths
  const projectRoot = path.resolve(__dirname, '..');
  const schemaPath = path.join(projectRoot, 'src', 'nwb_schema.json');

  print('cyan', '🔍 Schema Version Validation');
  print('blue', `   Schema: ${path.relative(projectRoot, schemaPath)}`);

  // Check schema file exists
  if (!fs.existsSync(schemaPath)) {
    print('red', '❌ Schema file not found');
    print('yellow', `   Expected at: ${schemaPath}`);
    process.exit(2);
  }

  // Read schema
  const schema = readSchema(schemaPath);

  // Check version field exists
  if (!hasVersionField(schema)) {
    print('red', '❌ Schema missing "version" field');
    print('yellow', '   Add a "version" field to the schema JSON:');
    print('yellow', '   "version": "1.0.1"');
    process.exit(1);
  }

  const schemaVersion = schema.version;
  print('green', `   Current version: ${schemaVersion}`);

  // If expected version provided, validate it matches
  if (options.expectedVersion) {
    print('blue', `   Expected version: ${options.expectedVersion}`);

    if (!versionsMatch(schemaVersion, options.expectedVersion)) {
      print('red', '❌ Schema version mismatch!');
      print('yellow', '');
      print('yellow', '   This indicates schema drift between repositories.');
      print('yellow', '   Please ensure the web app schema matches trodes_to_nwb:');
      print('yellow', '   https://github.com/LorenFrankLab/trodes_to_nwb');
      print('yellow', '');
      print('yellow', `   Web app version:    ${schemaVersion}`);
      print('yellow', `   Expected version:   ${options.expectedVersion}`);
      process.exit(1);
    }

    print('green', '✅ Schema version matches expected version');
  } else {
    print('green', '✅ Schema has valid version field');
  }

  // Additional validation: Check $id matches version
  if (schema.$id) {
    const idMatch = schema.$id.match(/v(\d+\.\d+\.\d+)/);
    if (idMatch && idMatch[1] !== schemaVersion) {
      print('yellow', `⚠️  Warning: $id version (${idMatch[1]}) differs from version field (${schemaVersion})`);
      print('yellow', '   Consider updating $id to match: ');
      print('yellow', `   "$id": "https://lorenfranklab.github.io/rec_to_nwb_yaml_creator/v${schemaVersion}"`);
    }
  }

  // Success
  print('green', '✅ Schema version validation passed');
  process.exit(0);
}

// Run main function
main();
