import { AgentClient } from './client.js';
import type { FlowSummary } from './types.js';

const FLOW_SUMMARY_SYSTEM_PROMPT = `You are a security analysis agent specializing in data flow analysis through JavaScript library functions.

Given a library function call that appears in a potential vulnerability path, determine:
1. Does taint propagate through this function? (i.e., does user-controlled input in arguments appear in the return value?)
2. Does this function sanitize/escape the input?
3. Your confidence level (0-1)

Common patterns:
- JSON.parse(tainted) → tainted (propagates)
- encodeURIComponent(tainted) → sanitized
- DOMPurify.sanitize(tainted) → sanitized
- String.prototype.split() → propagates
- parseInt() → sanitized (converts to number)

Return JSON with this shape:
{ "summaries": FlowSummary[] }`;

interface RawFlowSummary {
  libraryCall?: unknown;
  propagatesTaint?: unknown;
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

function toFlowSummary(raw: RawFlowSummary): FlowSummary | null {
  if (typeof raw.libraryCall !== 'string' || typeof raw.propagatesTaint !== 'boolean') {
    return null;
  }

  return {
    libraryCall: raw.libraryCall,
    propagatesTaint: raw.propagatesTaint,
    confidence: clampConfidence(raw.confidence),
    reasoning: typeof raw.reasoning === 'string' ? raw.reasoning : '',
  };
}

function parseSummariesFromText(raw: string): FlowSummary[] {
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return [];
  }

  const candidate = raw.slice(firstBrace, lastBrace + 1);
  try {
    const parsed = JSON.parse(candidate) as { summaries?: unknown };
    if (!Array.isArray(parsed.summaries)) {
      return [];
    }

    return parsed.summaries
      .map((summary) => toFlowSummary(summary as RawFlowSummary))
      .filter((summary): summary is FlowSummary => summary !== null);
  } catch {
    return [];
  }
}

export class FlowSummaryAgent {
  public constructor(private readonly client: AgentClient) {}

  public async summarize(input: {
    code: string;
    libraryCalls: string[];
    suspectedPaths?: string[];
  }): Promise<FlowSummary[]> {
    if (input.libraryCalls.length === 0) {
      return [];
    }

    const response = await this.client.chat({
      system: FLOW_SUMMARY_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: JSON.stringify(
            {
              libraryCalls: input.libraryCalls,
              suspectedPaths: input.suspectedPaths ?? [],
              code: input.code,
            },
            null,
            2,
          ),
        },
      ],
    });

    return parseSummariesFromText(response);
  }
}
