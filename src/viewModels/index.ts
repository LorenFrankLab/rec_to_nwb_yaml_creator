/**
 * @fileoverview Public surface of the view-model layer.
 *
 * Builders and (eventually) pages import the shared vocabulary from here (`../viewModels`). Page
 * composite view-models live in their own builder modules and are re-exported here as they land.
 */

export { buildDayRowViewModel } from './dayRowViewModel';
export type { DayRowInput } from './dayRowViewModel';
export { buildValidationSummaryViewModel } from './validationSummaryViewModel';
export type {
  ValidationSummaryViewModel,
  DayStatusRowViewModel,
} from './validationSummaryViewModel';
export { buildAnimalWorkspaceViewModel } from './animalWorkspaceViewModel';
export type {
  AnimalWorkspaceViewModel,
  AnimalCardViewModel,
  ExistingDataReviewViewModel,
} from './animalWorkspaceViewModel';
export { buildAnimalViewModel } from './animalViewModel';
export type {
  AnimalViewModel,
  AnimalHeaderViewModel,
  AnimalSectionGroupViewModel,
  AnimalActivePanelViewModel,
} from './animalViewModel';
export { buildDayEditorViewModel } from './dayEditorViewModel';
export type { DayEditorViewModel } from './dayEditorViewModel';

export type {
  WorkflowSeverity,
  DayStatus,
  StepStatus,
  WorkflowAction,
  WorkflowCommand,
  IssueViewModel,
  SectionViewModel,
  DayRowViewModel,
  DayRecoveryViewModel,
  DayPreflightViewModel,
  BatchRunReportViewModel,
  BatchRunResultViewModel,
  StepViewModel,
  FieldValueViewModel,
  ExportGateViewModel,
  BadChannelMarkViewModel,
  BreadcrumbViewModel,
  DayEditorShellViewModel,
  RecoveryNoticeViewModel,
} from './types';
