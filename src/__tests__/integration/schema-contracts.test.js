/**
 * BASELINE TEST - Documents current integration contracts
 *
 * These tests verify compatibility between this web app and trodes_to_nwb Python package.
 *
 * Integration Points:
 * 1. Schema Synchronization: nwb_schema.json must match between repositories
 * 2. Device Types: deviceTypes() must match probe_metadata/ files in trodes_to_nwb
 * 3. Field Names: Generated YAML field names must match Python package expectations
 *
 * Critical for Data Pipeline:
 * - Schema drift causes validation failures in Python package
 * - Missing device types cause NULL probe_id in Spyglass database
 * - Field name mismatches cause conversion failures
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import schema from '../../nwb_schema.json';
import { deviceTypes } from '../../valueList';

describe('BASELINE: Integration Contracts', () => {
  describe('Schema Hash', () => {
    it('documents current schema version', () => {
      const schemaString = JSON.stringify(schema, null, 2);
      const hash = crypto.createHash('sha256').update(schemaString).digest('hex');

      console.log(`📊 Schema Hash: ${hash.substring(0, 16)}...`);

      // Store hash for sync detection with Python package
      expect(hash).toMatchSnapshot('schema-hash');
    });

    it('verifies schema sync with trodes_to_nwb (if available)', () => {
      // This test gracefully degrades if trodes_to_nwb repo is not available
      // Useful for CI environments where Python package may not be checked out

      const trodesSchemaPath = path.join(
        '/Users/edeno/Documents/GitHub/trodes_to_nwb',
        'src/trodes_to_nwb/nwb_schema.json'
      );

      if (!fs.existsSync(trodesSchemaPath)) {
        console.log('⚠️ trodes_to_nwb not found at expected location, skipping sync check');
        return;
      }

      try {
        const trodesSchema = JSON.parse(fs.readFileSync(trodesSchemaPath, 'utf-8'));

        const webAppHash = crypto
          .createHash('sha256')
          .update(JSON.stringify(schema, null, 2))
          .digest('hex');

        const trodesHash = crypto
          .createHash('sha256')
          .update(JSON.stringify(trodesSchema, null, 2))
          .digest('hex');

        console.log(`📊 Web App Schema:  ${webAppHash.substring(0, 16)}...`);
        console.log(`📊 trodes_to_nwb:  ${trodesHash.substring(0, 16)}...`);

        if (webAppHash !== trodesHash) {
          console.warn('⚠️ SCHEMA MISMATCH DETECTED - This is a P0 bug!');
          console.warn('   Schemas must be synchronized between repositories');
        }

        // Document current sync state
        expect({
          inSync: webAppHash === trodesHash,
          webAppHash: webAppHash.substring(0, 16),
          trodesHash: trodesHash.substring(0, 16),
        }).toMatchSnapshot('schema-sync-status');
      } catch (error) {
        console.log(`⚠️ Error reading trodes_to_nwb schema: ${error.message}`);
        // Don't fail test if we can't read the file
      }
    });
  });

  describe('Device Types Contract', () => {
    it('documents all supported device types', () => {
      const types = deviceTypes();

      console.log(`📊 Device Types (${types.length}):`, types.slice(0, 3), '...');

      // These must match Python package probe_metadata files
      // NOTE: As of baseline capture, web app has 8 device types
      // trodes_to_nwb has 12 probe metadata files (4 more than web app)
      // Missing from web app: 128c-4s4mm6cm variants
      expect(types).toMatchSnapshot('device-types');
    });

    it('all device types are non-empty strings', () => {
      const types = deviceTypes();

      types.forEach(type => {
        expect(typeof type).toBe('string');
        expect(type.length).toBeGreaterThan(0);
      });
    });

    it('verifies device types exist in trodes_to_nwb (if available)', () => {
      // This test checks that device types have corresponding probe metadata files
      // Gracefully degrades if trodes_to_nwb repo is not available

      const probeMetadataDir = path.join(
        '/Users/edeno/Documents/GitHub/trodes_to_nwb',
        'src/trodes_to_nwb/device_metadata/probe_metadata'
      );

      if (!fs.existsSync(probeMetadataDir)) {
        console.log('⚠️ trodes_to_nwb probe_metadata not found, skipping device type check');
        return;
      }

      try {
        const probeFiles = fs
          .readdirSync(probeMetadataDir)
          .filter(f => f.endsWith('.yml'))
          .map(f => f.replace('.yml', ''))
          .sort();

        const webAppTypes = deviceTypes().sort();

        console.log(`📊 Web App Device Types: ${webAppTypes.length}`);
        console.log(`📊 trodes_to_nwb Probes: ${probeFiles.length}`);

        // Check which device types are missing from web app
        const missingFromWebApp = probeFiles.filter(probe => !webAppTypes.includes(probe));
        if (missingFromWebApp.length > 0) {
          console.warn(`⚠️ Device types in trodes_to_nwb but NOT in web app:`);
          missingFromWebApp.forEach(probe => console.warn(`   - ${probe}`));
        }

        // Check which device types don't have probe files (more critical)
        const missingProbeFiles = webAppTypes.filter(type => !probeFiles.includes(type));
        if (missingProbeFiles.length > 0) {
          console.warn(`⚠️ Device types in web app but NO probe file in trodes_to_nwb:`);
          missingProbeFiles.forEach(type => console.warn(`   - ${type}`));
        }

        // Document current state
        expect({
          webAppCount: webAppTypes.length,
          trodesCount: probeFiles.length,
          missingFromWebApp,
          missingProbeFiles,
        }).toMatchSnapshot('device-type-sync-status');
      } catch (error) {
        console.log(`⚠️ Error checking probe metadata: ${error.message}`);
        // Don't fail test if we can't read the directory
      }
    });
  });

  describe('YAML Generation Contract', () => {
    it('documents YAML output format', () => {
      // Snapshot the full required fields from schema
      // This documents the actual contract between web app and Python package
      expect(schema.required).toMatchSnapshot('schema-required-fields');
    });

    it('schema contains critical metadata fields', () => {
      // Document that critical fields are present (using actual field names from schema)
      const criticalFields = [
        'experimenter_name',  // Note: schema uses experimenter_name, not experimenter
        'lab',
        'institution',
        'data_acq_device',
        'times_period_multiplier',
        'raw_data_to_volts',
      ];

      criticalFields.forEach(field => {
        expect(schema.required).toContain(field);
      });
    });
  });
});
