import { validateDay } from './dayValidationComposer';
import { computeStepStatus } from './stepStatus';
import type { StepStatus } from './stepStatus';
import type { RepairableIssue } from './repairRouting';
import { mergeDayMetadata } from '../state/workspaceUtils';
import type { Animal, Day } from '../state/workspaceTypes';

const FAIL_CLOSED_STEP_STATUS: Record<string, StepStatus> = {
  overview: 'error',
  devices: 'error',
  epochs: 'error',
  behavioral: 'error',
  validation: 'error',
  export: 'error',
};

/** One authoritative evaluation shared by the frame, section summaries, and export gate. */
export interface DayEvaluation {
  merged: Record<string, unknown>;
  issues: RepairableIssue[];
  stepStatus: Record<string, StepStatus>;
  mergeFailed: boolean;
}

export function evaluateDay(
  animal: Animal,
  day: Day,
  animalDays: Day[] = []
): DayEvaluation {
  let merged: Record<string, unknown> = {};
  let mergeFailed = false;
  try {
    merged = mergeDayMetadata(animal, day);
  } catch {
    mergeFailed = true;
  }

  try {
    const issues = validateDay(
      day as unknown as Record<string, unknown>,
      merged,
      animal,
      animalDays
    ) as RepairableIssue[];
    return {
      merged,
      issues,
      stepStatus: mergeFailed
        ? { ...FAIL_CLOSED_STEP_STATUS }
        : computeStepStatus(day, merged, animal, animalDays, issues),
      mergeFailed,
    };
  } catch (error) {
    // A routing-contract failure is a programming error, but the scientist still gets a fail-closed
    // screen rather than losing access to the day.
    // eslint-disable-next-line no-console
    console.error(`[day-evaluation] validation could not complete for day "${day.id}":`, error);
    return {
      merged: {},
      issues: [],
      stepStatus: { ...FAIL_CLOSED_STEP_STATUS },
      mergeFailed: true,
    };
  }
}
