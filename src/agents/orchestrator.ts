import { FlowVisitor } from '../analysis/flow-visitor.js';
import { Scope } from '../analysis/scope.js';
import { FlowAnalyzer, type AnalyzeOptions } from '../analysis/taint.js';
import type { AnalyzeResult } from '../index.js';
import { parse } from '../parser/parse.js';
import { CWE_79_XSS } from '../specs/cwe.js';
import { AgentClient } from './client.js';
import { CallGraphAgent } from './callgraph.js';
import { FlowSummaryAgent } from './flow-summary.js';
import { SourceSinkAgent } from './source-sink.js';
import type { AgentConfig, CallEdge, CWEContext, FlowSummary } from './types.js';

export interface EnhancedAnalyzeOptions extends AnalyzeOptions {
  agentConfig?: AgentConfig;
  cwe?: CWEContext;
  code: string;
}

export interface EnhancedAnalyzeResult extends AnalyzeResult {
  agentEnhancements?: {
    discoveredSources: string[];
    discoveredSinks: string[];
    discoveredSanitizers: string[];
    resolvedCalls: CallEdge[];
    flowSummaries: FlowSummary[];
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function runStaticAnalyze(code: string, options: AnalyzeOptions): AnalyzeResult {
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

export async function enhancedAnalyze(options: EnhancedAnalyzeOptions): Promise<EnhancedAnalyzeResult> {
  const { code } = options;
  const staticOptions: AnalyzeOptions = {
    sources: options.sources,
    sinks: options.sinks,
    specialSinks: options.specialSinks,
    filters: options.filters,
  };

  const initialResult = runStaticAnalyze(code, staticOptions);

  if (options.agentConfig === undefined || options.agentConfig.apiKey.trim().length === 0) {
    return initialResult;
  }

  const client = new AgentClient(options.agentConfig);
  const sourceSinkAgent = new SourceSinkAgent(client);
  const callGraphAgent = new CallGraphAgent(client);
  const flowSummaryAgent = new FlowSummaryAgent(client);

  const cwe = options.cwe ?? CWE_79_XSS;
  const discovered = await sourceSinkAgent.discover({
    code,
    cwe,
  });

  const mergedOptions: AnalyzeOptions = {
    ...staticOptions,
    sources: unique([...staticOptions.sources, ...discovered.sources]),
    sinks: unique([...staticOptions.sinks, ...discovered.sinks]),
    filters: unique([...(staticOptions.filters ?? []), ...discovered.sanitizers]),
  };

  const enhancedStaticResult = runStaticAnalyze(code, mergedOptions);

  const resolvedCalls = await callGraphAgent.resolve({
    code,
    unresolvedCalls: [],
  });

  const flowSummaries = await flowSummaryAgent.summarize({
    code,
    libraryCalls: [],
  });

  return {
    ...enhancedStaticResult,
    agentEnhancements: {
      discoveredSources: discovered.sources,
      discoveredSinks: discovered.sinks,
      discoveredSanitizers: discovered.sanitizers,
      resolvedCalls,
      flowSummaries,
    },
  };
}
