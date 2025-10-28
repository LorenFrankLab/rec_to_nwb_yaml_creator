/**
 * BASELINE TEST - Documents current performance metrics
 *
 * This test establishes performance baselines for critical operations.
 * Thresholds are set to detect performance regressions during refactoring.
 *
 * Purpose: Catch performance degradation before it reaches production
 *
 * IMPORTANT: Uses threshold assertions (not exact snapshots) to allow
 * for normal performance variation while catching regressions.
 */

import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '../helpers/test-utils';
import App from '../../App';
import { jsonschemaValidation } from '../helpers/baseline-compatibility';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

// Load test fixtures for realistic performance testing
const fixturesPath = path.join(__dirname, '../fixtures/valid');
const minimalYaml = yaml.parse(
  fs.readFileSync(path.join(fixturesPath, 'minimal-valid.yml'), 'utf8')
);
const realisticYaml = yaml.parse(
  fs.readFileSync(path.join(fixturesPath, 'realistic-session.yml'), 'utf8')
);
const completeYaml = yaml.parse(
  fs.readFileSync(path.join(fixturesPath, 'complete-valid.yml'), 'utf8')
);

/**
 * Helper to create large form data with many electrode groups
 * @param electrodeGroupCount
 */
function createLargeFormData(electrodeGroupCount = 100) {
  return {
    experimenter_name: ['Test, User'],
    lab: 'Test Lab',
    institution: 'Test Institution',
    data_acq_device: [
      { name: 'Test', system: 'Test', amplifier: 'Test', adc_circuit: 'Test' },
    ],
    times_period_multiplier: 1.5,
    raw_data_to_volts: 0.195,
    electrode_groups: Array(electrodeGroupCount)
      .fill(null)
      .map((_, i) => ({
        id: i,
        location: 'CA1',
        device_type: 'tetrode_12.5',
        description: `Electrode group ${i}`,
      })),
    ntrode_electrode_group_channel_map: Array(electrodeGroupCount)
      .fill(null)
      .map((_, i) => ({
        ntrode_id: i,
        electrode_group_id: i,
        bad_channels: [],
        map: { '0': i * 4, '1': i * 4 + 1, '2': i * 4 + 2, '3': i * 4 + 3 },
      })),
  };
}

/**
 * Run a benchmark multiple times and return average timing
 * @param fn
 * @param iterations
 */
function benchmark(fn, iterations = 10) {
  const timings = [];

  // Warmup run (not counted)
  fn();

  // Measured runs
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const duration = performance.now() - start;
    timings.push(duration);
  }

  const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
  const min = Math.min(...timings);
  const max = Math.max(...timings);

  return { avg, min, max, timings };
}

describe('BASELINE: Performance Metrics', () => {
  describe('Validation Performance', () => {
    it('validates minimal YAML quickly (fast path)', () => {
      const result = benchmark(() => jsonschemaValidation(minimalYaml), 20);

      console.log(
        `📊 Validation (minimal): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`
      );

      // Threshold: Minimal YAML should validate in < 350ms on average
      // Note: Includes AJV schema compilation overhead on first run
      // CI environments can be slow and variable (local: ~100ms, CI: 200-320ms)
      expect(result.avg).toBeLessThan(350);
      expect(result.max).toBeLessThan(600); // No single run should exceed 600ms
    });

    it('validates realistic YAML with 8 electrode groups', () => {
      const result = benchmark(() => jsonschemaValidation(realisticYaml), 20);

      console.log(
        `📊 Validation (8 electrode groups): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`
      );

      // Threshold: Realistic session should validate in < 350ms on average
      // CI environments are slower than local (local: ~100ms, CI: ~260-330ms)
      expect(result.avg).toBeLessThan(350);
      expect(result.max).toBeLessThan(600);
    });

    it('validates complete YAML with all features', () => {
      const result = benchmark(() => jsonschemaValidation(completeYaml), 20);

      console.log(
        `📊 Validation (complete): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`
      );

      // Threshold: Complete YAML should validate in < 350ms on average
      // CI environments are slower than local (local: ~100ms, CI: ~260-310ms)
      expect(result.avg).toBeLessThan(350);
      expect(result.max).toBeLessThan(600);
    });

    it('validates large YAML with 50 electrode groups', () => {
      const largeData = createLargeFormData(50);
      const result = benchmark(() => jsonschemaValidation(largeData), 20);

      console.log(
        `📊 Validation (50 electrode groups): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`
      );

      // Threshold: 50 electrode groups should validate in < 500ms on average
      expect(result.avg).toBeLessThan(500);
      expect(result.max).toBeLessThan(800);
    });

    it('validates very large YAML with 100 electrode groups', () => {
      const veryLargeData = createLargeFormData(100);
      const result = benchmark(() => jsonschemaValidation(veryLargeData), 10);

      console.log(
        `📊 Validation (100 electrode groups): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`
      );

      // Threshold: 100 electrode groups should validate in < 1000ms on average
      expect(result.avg).toBeLessThan(1000);
      expect(result.max).toBeLessThan(1500);
    });

    it('validates extreme case with 200 electrode groups', () => {
      const extremeData = createLargeFormData(200);
      const result = benchmark(() => jsonschemaValidation(extremeData), 5);

      console.log(
        `📊 Validation (200 electrode groups): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`
      );

      // Threshold: 200 electrode groups (extreme edge case) should validate in < 2000ms
      expect(result.avg).toBeLessThan(2000);
      expect(result.max).toBeLessThan(3000);
    });
  });

  describe('YAML Parsing Performance (Import)', () => {
    it('parses minimal YAML file quickly', () => {
      const yamlString = fs.readFileSync(
        path.join(fixturesPath, 'minimal-valid.yml'),
        'utf8'
      );

      const result = benchmark(() => yaml.parse(yamlString), 50);

      console.log(
        `📊 YAML Parse (minimal): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`
      );

      // Threshold: Parsing small YAML should be < 50ms on average
      expect(result.avg).toBeLessThan(50);
    });

    it('parses realistic YAML file efficiently', () => {
      const yamlString = fs.readFileSync(
        path.join(fixturesPath, 'realistic-session.yml'),
        'utf8'
      );

      const result = benchmark(() => yaml.parse(yamlString), 50);

      console.log(
        `📊 YAML Parse (realistic): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`
      );

      // Threshold: Parsing realistic YAML should be < 100ms on average
      expect(result.avg).toBeLessThan(100);
    });

    it('parses complete YAML file efficiently', () => {
      const yamlString = fs.readFileSync(
        path.join(fixturesPath, 'complete-valid.yml'),
        'utf8'
      );

      const result = benchmark(() => yaml.parse(yamlString), 50);

      console.log(
        `📊 YAML Parse (complete): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`
      );

      // Threshold: Parsing complete YAML should be < 150ms on average
      expect(result.avg).toBeLessThan(150);
    });
  });

  describe('YAML Stringification Performance (Export)', () => {
    it('stringifies minimal data quickly', () => {
      const result = benchmark(() => yaml.stringify(minimalYaml), 50);

      console.log(
        `📊 YAML Stringify (minimal): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`
      );

      // Threshold: Stringifying small YAML should be < 50ms on average
      expect(result.avg).toBeLessThan(50);
    });

    it('stringifies realistic data efficiently', () => {
      const result = benchmark(() => yaml.stringify(realisticYaml), 50);

      console.log(
        `📊 YAML Stringify (realistic): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`
      );

      // Threshold: Stringifying realistic YAML should be < 100ms on average
      expect(result.avg).toBeLessThan(100);
    });

    it('stringifies complete data efficiently', () => {
      const result = benchmark(() => yaml.stringify(completeYaml), 50);

      console.log(
        `📊 YAML Stringify (complete): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`
      );

      // Threshold: Stringifying complete YAML should be < 150ms on average
      expect(result.avg).toBeLessThan(150);
    });

    it('stringifies large data (100 electrode groups) acceptably', () => {
      const largeData = createLargeFormData(100);
      const result = benchmark(() => yaml.stringify(largeData), 20);

      console.log(
        `📊 YAML Stringify (100 electrode groups): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`
      );

      // Threshold: Stringifying 100 electrode groups should be < 500ms on average
      expect(result.avg).toBeLessThan(500);
      expect(result.max).toBeLessThan(800);
    });
  });

  describe('Component Rendering Performance', () => {
    it('measures initial App render time', () => {
      const timings = [];

      // Run 5 render tests (fewer than other benchmarks because rendering is expensive)
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        const { container } = renderWithProviders(<App />);
        const duration = performance.now() - start;
        timings.push(duration);

        // Verify App actually rendered
        expect(container).toBeTruthy();
      }

      const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
      const min = Math.min(...timings);
      const max = Math.max(...timings);

      console.log(
        `📊 Initial App Render: avg=${avg.toFixed(2)}ms, min=${min.toFixed(2)}ms, max=${max.toFixed(2)}ms`
      );

      // Threshold: Initial render should complete within 5 seconds (generous)
      // This is a complex React component with many form elements
      expect(avg).toBeLessThan(5000);
      expect(max).toBeLessThan(10000); // No single render should exceed 10s
    });
  });

  describe('Array Operations at Scale', () => {
    it('creates array with 100 electrode groups quickly', () => {
      const result = benchmark(() => createLargeFormData(100), 50);

      console.log(
        `📊 Create 100 electrode groups: avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`
      );

      // Threshold: Creating large arrays should be < 100ms on average
      expect(result.avg).toBeLessThan(100);
    });

    it('clones large state with structuredClone efficiently', () => {
      const largeState = createLargeFormData(100);
      const result = benchmark(() => structuredClone(largeState), 50);

      console.log(
        `📊 structuredClone (100 electrode groups): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`
      );

      // Threshold: structuredClone should be < 50ms on average for 100 electrode groups
      // This is critical because it happens on every state update
      expect(result.avg).toBeLessThan(50);
      expect(result.max).toBeLessThan(100);
    });

    it('duplicates single electrode group quickly', () => {
      const singleElectrodeGroup = {
        id: 0,
        location: 'CA1',
        device_type: 'tetrode_12.5',
        description: 'Test electrode group',
      };

      const singleNtrodeMap = {
        ntrode_id: 0,
        electrode_group_id: 0,
        bad_channels: [],
        map: { '0': 0, '1': 1, '2': 2, '3': 3 },
      };

      const result = benchmark(() => {
        structuredClone(singleElectrodeGroup);
        structuredClone(singleNtrodeMap);
      }, 100);

      console.log(
        `📊 Duplicate single electrode group: avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`
      );

      // Threshold: Duplicating a single item should be very fast (< 5ms)
      expect(result.avg).toBeLessThan(5);
    });
  });

  describe('Complex Operations', () => {
    it('generates ntrode maps for tetrode device type efficiently', () => {
      // Simulate what happens when user selects device_type for multiple electrode groups
      const result = benchmark(() => {
        const maps = Array(50)
          .fill(null)
          .map((_, i) => ({
            ntrode_id: i,
            electrode_group_id: i,
            bad_channels: [],
            map: { '0': i * 4, '1': i * 4 + 1, '2': i * 4 + 2, '3': i * 4 + 3 },
          }));
        return maps;
      }, 50);

      console.log(
        `📊 Generate 50 ntrode maps: avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`
      );

      // Threshold: Generating ntrode maps should be < 50ms on average
      expect(result.avg).toBeLessThan(50);
    });

    it('filters and removes electrode groups from large arrays', () => {
      const largeData = createLargeFormData(100);

      const result = benchmark(() => {
        // Simulate removing electrode group with id 50
        const filtered = largeData.electrode_groups.filter((eg) => eg.id !== 50);
        const filteredMaps = largeData.ntrode_electrode_group_channel_map.filter(
          (map) => map.electrode_group_id !== 50
        );
        return { filtered, filteredMaps };
      }, 50);

      console.log(
        `📊 Filter arrays (100 items): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`
      );

      // Threshold: Filtering large arrays should be < 10ms on average
      expect(result.avg).toBeLessThan(10);
    });

    it('validates and processes full import/export cycle', () => {
      const result = benchmark(() => {
        // Simulate: Parse YAML → Validate → Stringify back
        const yamlString = yaml.stringify(realisticYaml);
        const parsed = yaml.parse(yamlString);
        const validationResult = jsonschemaValidation(parsed);
        expect(validationResult.valid).toBe(true);
        return yamlString;
      }, 10);

      console.log(
        `📊 Full import/export cycle: avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`
      );

      // Threshold: Full cycle should be < 500ms on average
      // This is what users experience when loading/saving files
      expect(result.avg).toBeLessThan(500);
      expect(result.max).toBeLessThan(1000);
    });
  });

  describe('Performance Summary', () => {
    it('documents all performance baselines for future reference', () => {
      console.log('\n' + '='.repeat(80));
      console.log('PERFORMANCE BASELINES SUMMARY');
      console.log('='.repeat(80));
      console.log('\nThresholds (fail if exceeded):');
      console.log('  Validation:');
      console.log('    - Minimal YAML:        < 350ms avg');
      console.log('    - Realistic (8 EG):    < 350ms avg');
      console.log('    - Complete YAML:       < 350ms avg');
      console.log('    - 50 electrode groups: < 500ms avg');
      console.log('    - 100 electrode groups:< 1000ms avg');
      console.log('    - 200 electrode groups:< 2000ms avg');
      console.log('  YAML Operations:');
      console.log('    - Parse (small):       < 50ms avg');
      console.log('    - Parse (large):       < 150ms avg');
      console.log('    - Stringify (small):   < 50ms avg');
      console.log('    - Stringify (large):   < 500ms avg');
      console.log('  Rendering:');
      console.log('    - Initial App render:  < 5000ms avg');
      console.log('  State Management:');
      console.log('    - structuredClone (100 EG): < 50ms avg');
      console.log('    - Single item duplicate:    < 5ms avg');
      console.log('  Complex Operations:');
      console.log('    - Full import/export cycle: < 500ms avg');
      console.log('='.repeat(80) + '\n');

      // This test always passes - it's just for documentation
      expect(true).toBe(true);
    });
  });
});
