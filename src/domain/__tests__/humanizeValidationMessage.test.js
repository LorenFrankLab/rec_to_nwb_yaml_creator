/**
 * Tests for humanizeValidationMessage — the DISPLAY-ONLY presentation helper that rewrites
 * raw AJV validation jargon into user-facing sentences. It is never called by validate() /
 * schemaValidation (which must keep emitting the raw, parseable message so downstream consumers can
 * extract the field name). It runs only at the point a message is rendered to the user.
 */

import { describe, it, expect } from 'vitest';
import { humanizeValidationMessage } from '../humanizeValidationMessage';

describe('humanizeValidationMessage()', () => {
  describe('required-property jargon', () => {
    it('maps a known property to a friendly label', () => {
      expect(
        humanizeValidationMessage("must have required property 'data_acq_device'")
      ).toBe('A data acquisition device is required');
      expect(
        humanizeValidationMessage("must have required property 'institution'")
      ).toBe('Institution is required');
      expect(
        humanizeValidationMessage("must have required property 'task_environment'")
      ).toBe('Task environment (room/apparatus) is required');
      expect(
        humanizeValidationMessage("must have required property 'camera_id'")
      ).toBe('A camera selection is required');
      expect(
        humanizeValidationMessage("must have required property 'meters_per_pixel'")
      ).toBe('Camera meters-per-pixel calibration is required');
      expect(
        humanizeValidationMessage("must have required property 'targeted_location'")
      ).toBe('A brain region/location is required');
      expect(
        humanizeValidationMessage("must have required property 'location'")
      ).toBe('A brain region/location is required');
    });

    it('humanizes an unknown snake_case property generically', () => {
      expect(
        humanizeValidationMessage("must have required property 'some_other_prop'")
      ).toBe('Some other prop is required');
    });

    it('never leaves raw "must have required property" text in a known/generic case', () => {
      expect(
        humanizeValidationMessage("must have required property 'whatever_key'")
      ).not.toContain('must have required property');
    });
  });

  describe('minItems jargon', () => {
    it('names the collection item when a path is available', () => {
      expect(
        humanizeValidationMessage('must NOT have fewer than 1 items', '/data_acq_device')
      ).toBe('Add at least one data acquisition device');
      expect(
        humanizeValidationMessage('must NOT have fewer than 1 items', 'experimenter_name')
      ).toBe('Add at least one experimenter name');
    });

    it('falls back safely when no path is available', () => {
      expect(humanizeValidationMessage('must NOT have fewer than 1 items')).toBe(
        'Add at least one item'
      );
    });

    it('does not mutate the raw issue message', () => {
      const issue = {
        path: '/data_acq_device',
        message: 'must NOT have fewer than 1 items',
      };
      const rendered = humanizeValidationMessage(issue.message, issue.path);
      expect(rendered).toBe('Add at least one data acquisition device');
      expect(issue.message).toBe('must NOT have fewer than 1 items');
    });
  });

  describe('leading snake_case field token in other messages', () => {
    it('sentence-cases a leading raw field token', () => {
      expect(
        humanizeValidationMessage('experiment_description cannot be empty or contain only whitespace')
      ).toBe('Experiment description cannot be empty or contain only whitespace');
    });

    it('humanizes a dotted-path leading token by its last segment', () => {
      expect(
        humanizeValidationMessage('subject.date_of_birth cannot be empty')
      ).toBe('Date of birth cannot be empty');
    });
  });

  describe('passthrough', () => {
    it('returns already-friendly messages unchanged', () => {
      const friendly = 'Date of birth needs to comply with ISO 8601 format';
      expect(humanizeValidationMessage(friendly)).toBe(friendly);
    });

    it('passes through a message with no leading raw token unchanged', () => {
      const msg = 'must be <= 100000';
      expect(humanizeValidationMessage(msg)).toBe(msg);
    });

    it('tolerates empty / non-string input', () => {
      expect(humanizeValidationMessage('')).toBe('');
      expect(humanizeValidationMessage(undefined)).toBe('');
      expect(humanizeValidationMessage(null)).toBe('');
    });
  });
});
