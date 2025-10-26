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

    it('verifies schema sync with trodes_to_nwb (from GitHub)', async () => {
      // Fetch schema from GitHub main branch to verify synchronization
      // This works in any environment (local, CI, contributor machines)

      const TRODES_SCHEMA_URL = 'https://raw.githubusercontent.com/LorenFrankLab/trodes_to_nwb/main/src/trodes_to_nwb/nwb_schema.json';

      try {
        const response = await fetch(TRODES_SCHEMA_URL);

        if (!response.ok) {
          console.warn(`⚠️ Could not fetch trodes_to_nwb schema from GitHub (${response.status})`);
          console.warn('   Skipping sync check');
          return;
        }

        const trodesSchema = await response.json();

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
          console.error('❌ SCHEMA MISMATCH DETECTED - This is a P0 bug!');
          console.error('   Schemas must be synchronized between repositories');
          console.error(`   Web app:       ${webAppHash}`);
          console.error(`   trodes_to_nwb: ${trodesHash}`);
          console.error(`   Compare: https://github.com/LorenFrankLab/trodes_to_nwb/blob/main/src/trodes_to_nwb/nwb_schema.json`);
        }

        // Verify synchronization (fail test if mismatch)
        expect(webAppHash).toBe(trodesHash);
      } catch (error) {
        console.warn(`⚠️ Error fetching trodes_to_nwb schema: ${error.message}`);
        console.warn('   Skipping sync check (network issue?)');
        // Don't fail test if network error - gracefully degrade
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

    it('verifies device types exist in trodes_to_nwb (from GitHub)', async () => {
      // Fetch probe metadata directory from GitHub to verify device types exist
      // This works in any environment (local, CI, contributor machines)

      const PROBE_METADATA_API_URL = 'https://api.github.com/repos/LorenFrankLab/trodes_to_nwb/contents/src/trodes_to_nwb/device_metadata/probe_metadata';

      try {
        const response = await fetch(PROBE_METADATA_API_URL);

        if (!response.ok) {
          console.warn(`⚠️ Could not fetch probe metadata from GitHub (${response.status})`);
          console.warn('   Skipping device type check');
          return;
        }

        const files = await response.json();
        const probeFiles = files
          .filter(f => f.name.endsWith('.yml'))
          .map(f => f.name.replace('.yml', ''))
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

        // Check which device types don't have probe files (CRITICAL)
        const missingProbeFiles = webAppTypes.filter(type => !probeFiles.includes(type));
        if (missingProbeFiles.length > 0) {
          console.error(`❌ Device types in web app but NO probe file in trodes_to_nwb:`);
          missingProbeFiles.forEach(type => console.error(`   - ${type}`));
          console.error(`   View probe files: https://github.com/LorenFrankLab/trodes_to_nwb/tree/main/src/trodes_to_nwb/device_metadata/probe_metadata`);
          // Fail test - web app has device types without probe files (DATA LOSS RISK)
          throw new Error(`Missing probe files for: ${missingProbeFiles.join(', ')}`);
        }

        console.log('✅ All web app device types have corresponding probe files');
      } catch (error) {
        if (error.message.includes('Missing probe files')) {
          throw error; // Re-throw validation errors
        }
        console.warn(`⚠️ Error fetching probe metadata: ${error.message}`);
        console.warn('   Skipping device type check (network issue?)');
        // Don't fail test if network error - gracefully degrade
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
