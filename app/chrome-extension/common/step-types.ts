// step-types.ts — re-export shared constants to keep single source of truth
export { STEP_TYPES } from 'scalemaker-chrome-mcp-shared';
export type StepTypeConst =
  (typeof import('scalemaker-chrome-mcp-shared'))['STEP_TYPES'][keyof (typeof import('scalemaker-chrome-mcp-shared'))['STEP_TYPES']];
