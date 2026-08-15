/**
 * lib/agent/index.ts
 *
 * Public entry point for the BakeSync agent worker.
 * Import this in API routes — don't import the sub-modules directly.
 */

export { buildAgentContext } from "./context-builder";
export { runPlanner }        from "./planner";
export { writeSchedule }     from "./schedule-writer";
export { enqueue }           from "./enqueue";
export type {
  AgentBakeryContext,
  AgentSchedulePlan,
  AgentPlannedBatch,
  AgentRunResult,
  AgentShiftType,
} from "./types";
