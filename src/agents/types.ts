export interface AgentConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export interface CWEContext {
  id: string;
  name: string;
  description: string;
}

export interface SourceSinkSpec {
  sources: string[];
  sinks: string[];
  sanitizers: string[];
}

export interface CallEdge {
  callSite: { file: string; line: number; calleeName: string };
  resolvedTarget: { functionName: string; file: string; line: number };
  confidence: number;
  reasoning: string;
}

export interface FlowSummary {
  libraryCall: string;
  propagatesTaint: boolean;
  confidence: number;
  reasoning: string;
}
