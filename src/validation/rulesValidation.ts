/**
 * Custom Business Rules Validation — composer.
 *
 * Validates business logic that is not easily expressed in JSON schema. Phase split: the ~20 rules
 * (formerly inline in one ~1100-LOC function) now live in focused family modules under
 * `validation/rules/*` as pure `(model) => Issue[]` functions; this composer runs them in the SAME
 * order and concatenates, with no behavior change. Order is preserved exactly (even though
 * `validate()` re-sorts the combined schema+rules issues by path/code) so any direct caller of
 * `rulesValidation` sees a byte-identical list.
 *
 * Rules enforced:
 * 1. Tasks with camera_ids require cameras to be defined
 * 2. Associated video files with camera_ids require cameras to be defined
 * 3. Optogenetics configuration must be complete (all or none of the 4 fields) + single source + refs
 * 4. Ntrode channel mappings must have unique physical channels (no duplicates)
 * 5. Ntrode channel mappings must be sequential (no missing channels)
 * 6. Electrode-group ids must be unique within a session
 * 7. Ntrode ids must be unique across the animal's whole channel map
 * 8. DANDI subject conformance: species is a Latin binomial / NCBI URI; ids have no slashes
 * 9–20. Camera/file/task/FsGUI references, probe/channel geometry, identity divergence, DIO uniqueness
 */

import {
  missingCameraRules,
  danglingCameraReferences,
  taskEpochReferences,
  associatedFileIntegrity,
  fsGuiReferences,
  cameraIdUniqueness,
} from './rules/referenceRules';
import { optogeneticsRules } from './rules/optoRules';
import {
  duplicateChannelMappings,
  sequentialChannelMappings,
  uniqueNtrodeIds,
  channelBounds,
  danglingElectrodeGroupRefs,
  multishankBadChannels,
} from './rules/channelMapRules';
import {
  uniqueElectrodeGroupIds,
  missingChannelMapRows,
  electrodeGroupLocations,
  knownDeviceTypes,
  consistentProbeCatalog,
} from './rules/electrodeGroupRules';
import { dandiSubjectConformance } from './rules/dandiSubjectRules';
import { identityDivergences } from './rules/identityRules';
import {
  uniqueBehavioralEventNames,
  uniqueBehavioralEventDescriptions,
} from './rules/behavioralEventRules';
import type { ValidationIssue, ValidationModel } from './issueTypes';

/**
 * Custom business logic validation rules.
 *
 * @param model - The form data to validate
 * @returns Array of validation issues with format:
 *   {
 *     path: string,       // Normalized path: "tasks", "optogenetics", etc.
 *     code: string,       // Rule code: "missing_camera", "partial_configuration", etc.
 *     severity: "error",  // Usually "error" (a few rules emit "warning")
 *     message: string     // User-friendly message
 *   }
 */
export const rulesValidation = (model: ValidationModel): ValidationIssue[] => {
  // Handle null/undefined model gracefully
  if (!model || typeof model !== 'object') {
    return [];
  }

  // Run the rule families in the SAME order the rules historically ran (the comments give the
  // original rule numbers). The order is preserved exactly for direct callers; `validate()` re-sorts.
  return [
    ...missingCameraRules(model),                 // 1, 2
    ...optogeneticsRules(model),                  // 3, 3c, 3b
    ...duplicateChannelMappings(model),           // 4
    ...sequentialChannelMappings(model),          // 5
    ...uniqueElectrodeGroupIds(model),            // 6
    ...uniqueNtrodeIds(model),                    // 7
    ...dandiSubjectConformance(model),            // 8
    ...danglingCameraReferences(model),           // 9
    ...channelBounds(model),                      // 11
    ...missingChannelMapRows(model),              // 11b
    ...electrodeGroupLocations(model),            // 12
    ...knownDeviceTypes(model),                   // 13
    ...consistentProbeCatalog(model),             // 20
    ...uniqueBehavioralEventNames(model),         // 14
    ...taskEpochReferences(model),                // 15
    ...associatedFileIntegrity(model),            // 15b
    ...fsGuiReferences(model),                    // 15c
    ...identityDivergences(model),                // 16
    ...danglingElectrodeGroupRefs(model),         // 10
    ...uniqueBehavioralEventDescriptions(model),  // 17
    ...cameraIdUniqueness(model),                 // 18
    ...multishankBadChannels(model),              // 19
  ];
};
