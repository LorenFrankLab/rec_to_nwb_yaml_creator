/**
 * @fileoverview Behavioral-event (DIO) uniqueness rules (extracted from rulesValidation.js, Phase split).
 *
 * trodes_to_nwb keys DIO channels by behavioral_events[].name (DIOEvents primary key) AND by
 * `description` (convert_dios), raising on a duplicate of either. These rules share the same
 * `duplicateBehavioralEvent*` helpers as the inline day-event grid gate so the two can never drift.
 * Pure; moved verbatim.
 */

import {
  duplicateBehavioralEventDescriptions,
  duplicateBehavioralEventNames,
} from '../behavioralEvents';

/**
 * Rule 14: behavioral-event names unique within the day.
 *
 * @param {object} model - The form data to validate.
 * @returns {object[]} Validation issues.
 */
export function uniqueBehavioralEventNames(model) {
  const issues = [];
  // A duplicate dio_event name is a hard Spyglass DIOEvents primary-key violation
  // and a trodes_to_nwb ValueError. Shares duplicateBehavioralEventNames with the inline
  // grid gate so the two can never disagree on what "the same name" means.
  if (Array.isArray(model.behavioral_events) && model.behavioral_events.length > 0) {
    duplicateBehavioralEventNames(model.behavioral_events).forEach((name) => {
      issues.push({
        path: 'behavioral_events',
        field: 'name',
        step: 'behavioral',
        actionLabel: 'Rename behavioral event',
        code: 'duplicate_behavioral_event_name',
        repairSurface: 'day',
        severity: 'error',
        message:
          `Duplicate behavioral event name "${name}". Each behavioral (DIO) event name ` +
          `must be unique — duplicates collide on the Spyglass DIOEvents primary key.`,
      });
    });
  }

  return issues;
}

/**
 * Rule 17: behavioral-event DESCRIPTION uniqueness.
 *
 * @param {object} model - The form data to validate.
 * @returns {object[]} Validation issues.
 */
export function uniqueBehavioralEventDescriptions(model) {
  const issues = [];
  // trodes_to_nwb (convert_dios) keys DIO channels by behavioral_events[].description
  // and raises a ValueError on a duplicate description. (Rule 14 covers `name`.)
  if (Array.isArray(model.behavioral_events) && model.behavioral_events.length > 0) {
    // Shared helper so the inline day-event gate (BehavioralEventsDisplay) can never drift from
    // this export gate — raw-string compare, exactly as the converter keys descriptions.
    duplicateBehavioralEventDescriptions(model.behavioral_events).forEach((desc) => {
      issues.push({
        path: 'behavioral_events',
        field: 'description',
        step: 'behavioral',
        actionLabel: 'Rename behavioral event description',
        code: 'duplicate_behavioral_event_description',
        repairSurface: 'day',
        severity: 'error',
        message:
          `Duplicate behavioral event description "${desc}". The converter keys DIO ` +
          `channels by description and fails on duplicates — each must be unique.`,
      });
    });
  }

  return issues;
}
