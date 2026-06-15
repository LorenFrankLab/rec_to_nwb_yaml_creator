/**
 * The descriptor command layer: resolves the plain-data {@link WorkflowCommand} descriptors the
 * view-model builders emit into the existing store actions / repair executor. The write-side
 * counterpart to the read-side builders.
 */
export { commandHandlers, toRepairCommand, applyRepair, REPAIR_COMMAND_IDS } from './commandHandlers';
export type { CommandActions, CommandContext, CommandHandler, CommandInput } from './commandHandlers';
export { WORKFLOW_COMMAND_CATALOG } from './commandCatalog';
export type { CommandCategory } from './commandCatalog';
