import { FlowVisitor } from './analysis/flow-visitor.js';
import { Scope } from './analysis/scope.js';
import { FlowAnalyzer, type AnalyzeOptions, type TaintPair } from './analysis/taint.js';
import { enhancedAnalyze, type EnhancedAnalyzeOptions, type EnhancedAnalyzeResult } from './agents/orchestrator.js';
import { parse } from './parser/parse.js';

export type { AnalyzeOptions, TaintPair };
export { enhancedAnalyze };
export type { EnhancedAnalyzeOptions, EnhancedAnalyzeResult };

export interface AnalyzeResult {
  assignmentPairs: TaintPair[];
  functionCallPairs: TaintPair[];
  pairs: TaintPair[];
}

export function analyze(code: string, options: AnalyzeOptions): AnalyzeResult {
  const parseOutput = parse(code);
  const flowAnalyzer = FlowAnalyzer.createRoot(options, code);
  const globalScope = new Scope(flowAnalyzer);
  const visitor = new FlowVisitor(globalScope);

  visitor.visitProgram(parseOutput.program);

  const assignmentPairs = [...flowAnalyzer.getAssignmentPairs()];
  const functionCallPairs = [...flowAnalyzer.getFunctionCallPairs()];

  return {
    assignmentPairs,
    functionCallPairs,
    pairs: [...assignmentPairs, ...functionCallPairs],
  };
}
