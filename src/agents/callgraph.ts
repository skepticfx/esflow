import { AgentClient } from './client.js';
import type { CallEdge } from './types.js';

const CALLGRAPH_SYSTEM_PROMPT = `You are a JavaScript static analysis agent. Your task is to resolve function call targets that cannot be determined statically.

Given a call site and the surrounding code context, determine:
1. What function is actually being called
2. How confident you are (0-1)
3. Your reasoning

Focus on common JavaScript patterns: prototype methods, factory functions, callback patterns, event handlers.

Return JSON with this shape:
{ "edges": CallEdge[] }`;

interface RawCallEdge {
  callSite?: {
    file?: unknown;
    line?: unknown;
    calleeName?: unknown;
  };
  resolvedTarget?: {
    functionName?: unknown;
    file?: unknown;
    line?: unknown;
  };
  confidence?: unknown;
  reasoning?: unknown;
}

function clampConfidence(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  if (numeric < 0) {
    return 0;
  }
  if (numeric > 1) {
    return 1;
  }
  return numeric;
}

function toCallEdge(value: RawCallEdge): CallEdge | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const callSite = value.callSite;
  const resolvedTarget = value.resolvedTarget;
  if (typeof callSite !== 'object' || callSite === null || typeof resolvedTarget !== 'object' || resolvedTarget === null) {
    return null;
  }

  if (
    typeof callSite.file !== 'string' ||
    typeof callSite.calleeName !== 'string' ||
    typeof resolvedTarget.functionName !== 'string' ||
    typeof resolvedTarget.file !== 'string'
  ) {
    return null;
  }

  const callLine = typeof callSite.line === 'number' ? callSite.line : Number(callSite.line);
  const resolvedLine = typeof resolvedTarget.line === 'number' ? resolvedTarget.line : Number(resolvedTarget.line);
  if (!Number.isFinite(callLine) || !Number.isFinite(resolvedLine)) {
    return null;
  }

  return {
    callSite: {
      file: callSite.file,
      line: Math.floor(callLine),
      calleeName: callSite.calleeName,
    },
    resolvedTarget: {
      functionName: resolvedTarget.functionName,
      file: resolvedTarget.file,
      line: Math.floor(resolvedLine),
    },
    confidence: clampConfidence(value.confidence),
    reasoning: typeof value.reasoning === 'string' ? value.reasoning : '',
  };
}

function parseEdgesFromText(raw: string): CallEdge[] {
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return [];
  }

  const candidate = raw.slice(firstBrace, lastBrace + 1);
  try {
    const parsed = JSON.parse(candidate) as { edges?: unknown };
    if (!Array.isArray(parsed.edges)) {
      return [];
    }

    return parsed.edges
      .map((edge) => toCallEdge(edge as RawCallEdge))
      .filter((edge): edge is CallEdge => edge !== null);
  } catch {
    return [];
  }
}

export class CallGraphAgent {
  public constructor(private readonly client: AgentClient) {}

  public async resolve(input: {
    code: string;
    unresolvedCalls: Array<{ file: string; line: number; calleeName: string }>;
  }): Promise<CallEdge[]> {
    if (input.unresolvedCalls.length === 0) {
      return [];
    }

    const response = await this.client.chat({
      system: CALLGRAPH_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: JSON.stringify(
            {
              unresolvedCalls: input.unresolvedCalls,
              code: input.code,
            },
            null,
            2,
          ),
        },
      ],
    });

    return parseEdgesFromText(response);
  }
}
