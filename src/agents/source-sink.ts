import type Anthropic from '@anthropic-ai/sdk';
import { parse } from '../parser/parse.js';
import { AgentClient } from './client.js';
import type { CWEContext, SourceSinkSpec } from './types.js';

const SOURCE_SINK_SYSTEM_PROMPT = `You are a security analysis agent specializing in JavaScript/TypeScript vulnerability detection.
Your task is to analyze code and identify:
1. SOURCES: Entry points where untrusted user data enters the program
2. SINKS: Security-sensitive operations where tainted data could cause harm
3. SANITIZERS: Functions that neutralize tainted data

You will be given a CWE description and source code. Analyze the code to find sources, sinks, and sanitizers specific to the vulnerability type.

Use tools to inspect the code before deciding. When done, call submit_spec with arrays of sources, sinks, and sanitizers.`;

interface ViewCodeInput {
  startLine: number;
  endLine: number;
}

interface SearchCodeInput {
  pattern: string;
}

interface SubmitSpecInput {
  sources?: unknown;
  sinks?: unknown;
  sanitizers?: unknown;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
}

function parseViewCodeInput(input: unknown): ViewCodeInput {
  if (typeof input !== 'object' || input === null) {
    return { startLine: 1, endLine: 60 };
  }

  const candidate = input as Partial<Record<'startLine' | 'endLine', unknown>>;
  const start = typeof candidate.startLine === 'number' ? candidate.startLine : Number(candidate.startLine ?? 1);
  const end = typeof candidate.endLine === 'number' ? candidate.endLine : Number(candidate.endLine ?? start + 50);

  const safeStart = Number.isFinite(start) ? Math.max(1, Math.floor(start)) : 1;
  const safeEnd = Number.isFinite(end) ? Math.max(safeStart, Math.floor(end)) : safeStart + 50;
  return { startLine: safeStart, endLine: safeEnd };
}

function parseSearchCodeInput(input: unknown): SearchCodeInput {
  if (typeof input !== 'object' || input === null) {
    return { pattern: '' };
  }

  const candidate = input as Partial<Record<'pattern', unknown>>;
  return { pattern: typeof candidate.pattern === 'string' ? candidate.pattern : '' };
}

function parseSubmitSpecInput(input: unknown): SourceSinkSpec {
  const value: SubmitSpecInput = typeof input === 'object' && input !== null ? (input as SubmitSpecInput) : {};
  return {
    sources: asStringArray(value.sources),
    sinks: asStringArray(value.sinks),
    sanitizers: asStringArray(value.sanitizers),
  };
}

function extractJsonObject(raw: string): SourceSinkSpec | null {
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return null;
  }

  const candidate = raw.slice(firstBrace, lastBrace + 1);
  try {
    const parsed = JSON.parse(candidate) as SubmitSpecInput;
    return {
      sources: asStringArray(parsed.sources),
      sinks: asStringArray(parsed.sinks),
      sanitizers: asStringArray(parsed.sanitizers),
    };
  } catch {
    return null;
  }
}

function dedupeSpec(spec: SourceSinkSpec): SourceSinkSpec {
  return {
    sources: [...new Set(spec.sources)],
    sinks: [...new Set(spec.sinks)],
    sanitizers: [...new Set(spec.sanitizers)],
  };
}

function lineOfOffset(code: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < code.length; i += 1) {
    if (code[i] === '\n') {
      line += 1;
    }
  }
  return line;
}

function listFunctionDeclarations(code: string): string {
  const parseOutput = parse(code);
  const signatures: string[] = [];

  for (const item of parseOutput.program.body) {
    if (item.type === 'FunctionDeclaration' && item.id !== null) {
      const startLine = lineOfOffset(code, item.start);
      const params = item.params
        .map((param) => {
          if (param.type === 'Identifier') {
            return param.name;
          }
          if (param.type === 'AssignmentPattern' && param.left.type === 'Identifier') {
            return `${param.left.name}=?`;
          }
          if (param.type === 'RestElement' && param.argument.type === 'Identifier') {
            return `...${param.argument.name}`;
          }
          return '<complex>';
        })
        .join(', ');
      signatures.push(`${item.id.name}(${params}) @ line ${startLine}`);
    }
  }

  if (signatures.length === 0) {
    return 'No function declarations found.';
  }

  return signatures.join('\n');
}

export class SourceSinkAgent {
  public constructor(private readonly client: AgentClient) {}

  public async discover(input: { code: string; cwe: CWEContext }): Promise<SourceSinkSpec> {
    const codeLines = input.code.split(/\r?\n/);
    let submittedSpec: SourceSinkSpec | null = null;

    const tools = [
      {
        name: 'view_code',
        description: 'View a source code line range',
        input_schema: {
          type: 'object' as const,
          properties: {
            startLine: { type: 'number' },
            endLine: { type: 'number' },
          },
          required: ['startLine', 'endLine'],
        },
      },
      {
        name: 'search_code',
        description: 'Search for a simple string pattern in source code',
        input_schema: {
          type: 'object' as const,
          properties: {
            pattern: { type: 'string' },
          },
          required: ['pattern'],
        },
      },
      {
        name: 'list_functions',
        description: 'List function declarations and signatures',
        input_schema: {
          type: 'object' as const,
          properties: {},
        },
      },
      {
        name: 'submit_spec',
        description: 'Submit final structured source/sink/sanitizer arrays',
        input_schema: {
          type: 'object' as const,
          properties: {
            sources: {
              type: 'array',
              items: { type: 'string' },
            },
            sinks: {
              type: 'array',
              items: { type: 'string' },
            },
            sanitizers: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['sources', 'sinks', 'sanitizers'],
        },
      },
    ] satisfies Anthropic.Messages.Tool[];

    const textResponse = await this.client.chat({
      system: SOURCE_SINK_SYSTEM_PROMPT,
      tools,
      messages: [
        {
          role: 'user',
          content: [
            `CWE: ${input.cwe.id} - ${input.cwe.name}`,
            `Description: ${input.cwe.description}`,
            `Code length: ${codeLines.length} lines`,
            'Analyze this code using tools and return final findings via submit_spec.',
          ].join('\n'),
        },
      ],
      toolHandlers: {
        view_code: (toolInput) => {
          const { startLine, endLine } = parseViewCodeInput(toolInput);
          const from = Math.max(1, Math.min(startLine, codeLines.length));
          const to = Math.max(from, Math.min(endLine, codeLines.length));
          const snippet = codeLines
            .slice(from - 1, to)
            .map((line, idx) => `${from + idx}: ${line}`)
            .join('\n');
          return snippet.length > 0 ? snippet : 'No code in requested range.';
        },
        search_code: (toolInput) => {
          const { pattern } = parseSearchCodeInput(toolInput);
          if (!pattern) {
            return 'Pattern is empty.';
          }

          const matches: string[] = [];
          for (let i = 0; i < codeLines.length; i += 1) {
            const line = codeLines[i] ?? '';
            if (line.includes(pattern)) {
              matches.push(`${i + 1}: ${line}`);
            }
          }

          if (matches.length === 0) {
            return `No matches for pattern: ${pattern}`;
          }

          return matches.slice(0, 80).join('\n');
        },
        list_functions: () => listFunctionDeclarations(input.code),
        submit_spec: (toolInput) => {
          submittedSpec = dedupeSpec(parseSubmitSpecInput(toolInput));
          return 'Spec received.';
        },
      },
    });

    if (submittedSpec !== null) {
      return submittedSpec;
    }

    const parsedFromText = extractJsonObject(textResponse);
    if (parsedFromText !== null) {
      return dedupeSpec(parsedFromText);
    }

    return {
      sources: [],
      sinks: [],
      sanitizers: [],
    };
  }
}
