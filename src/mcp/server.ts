import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { analyze, type AnalyzeOptions, type AnalyzeResult } from '../index.js';
import { COMMON_CWE_CONTEXTS, CWE_79_XSS } from '../specs/cwe.js';

type AnalyzeParams = {
  sources?: string[];
  sinks?: string[];
  filters?: string[];
  cwe?: string;
};

const DEFAULT_CWE_ID = CWE_79_XSS.id;
const DEFAULT_PRESET: Pick<AnalyzeOptions, 'sources' | 'sinks' | 'filters'> = {
  sources: ['location.href', 'location.hash', 'document.cookie'],
  sinks: ['.innerHTML', 'eval', 'document.write'],
  filters: ['encodeURIComponent', 'DOMPurify.sanitize'],
};

const CWE_ANALYZE_PRESETS: Record<string, Pick<AnalyzeOptions, 'sources' | 'sinks' | 'filters'>> = {
  'CWE-78': {
    sources: ['req.query.cmd', 'req.body.cmd', 'process.argv'],
    sinks: ['exec', 'execSync', 'spawn', 'spawnSync'],
    filters: ['shellEscape'],
  },
  'CWE-89': {
    sources: ['req.query', 'req.body', 'location.search'],
    sinks: ['db.query', 'connection.query', 'sequelize.query'],
    filters: ['escape', 'mysql.escape'],
  },
  'CWE-22': {
    sources: ['req.query.path', 'req.params.path', 'location.pathname'],
    sinks: ['fs.readFile', 'fs.writeFile', 'fs.createReadStream'],
    filters: ['path.normalize', 'path.resolve'],
  },
  'CWE-79': DEFAULT_PRESET,
};

function normalizeCweId(cwe?: string): string {
  return cwe?.trim() || DEFAULT_CWE_ID;
}

function getPresetForCwe(cwe?: string): Pick<AnalyzeOptions, 'sources' | 'sinks' | 'filters'> {
  const normalized = normalizeCweId(cwe);
  const preset = CWE_ANALYZE_PRESETS[normalized];
  return preset ?? DEFAULT_PRESET;
}

function formatAnalyzeResult(result: AnalyzeResult): string {
  if (result.pairs.length === 0) {
    return 'No taint flows found.';
  }

  const details = result.pairs.map((pair) => `${pair.source.name} → ${pair.sink.name} (line ${pair.lineNumber})`);
  return [`${result.pairs.length} taint flow(s) found.`, ...details].join('\n');
}

function errorText(prefix: string, error: unknown): string {
  if (error instanceof Error) {
    return `${prefix}: ${error.message}`;
  }

  return `${prefix}: ${String(error)}`;
}

function registerAnalyzeTool(server: McpServer): void {
  server.registerTool(
    'analyze',
    {
      description: 'Run static taint analysis on JavaScript or TypeScript code',
      inputSchema: z.object({
        code: z.string().describe('JavaScript or TypeScript code to analyze'),
        sources: z.array(z.string()).optional().describe('Taint sources (e.g., ["location.href", "document.cookie"])'),
        sinks: z.array(z.string()).optional().describe('Taint sinks (e.g., [".innerHTML", "eval"])'),
        filters: z.array(z.string()).optional().describe('Sanitizer functions that neutralize taint'),
        cwe: z
          .string()
          .optional()
          .describe('CWE ID for preset sources/sinks (e.g., "CWE-79"). Uses CWE-79 defaults if no sources/sinks provided.'),
      }),
    },
    ({ code, sources, sinks, filters, cwe }) => {
      try {
        const options = resolveAnalyzeOptions({ sources, sinks, filters, cwe });
        const result = analyze(code, options);

        return {
          content: [{ type: 'text', text: formatAnalyzeResult(result) }],
          structuredContent: {
            options,
            pairs: result.pairs,
          },
        };
      } catch (error: unknown) {
        return {
          isError: true,
          content: [{ type: 'text', text: errorText('Failed to analyze code', error) }],
        };
      }
    },
  );
}

function registerAnalyzeFileTool(server: McpServer): void {
  server.registerTool(
    'analyze_file',
    {
      description: 'Read a file from disk and run static taint analysis',
      inputSchema: z.object({
        path: z.string().describe('Absolute or relative file path to analyze'),
        sources: z.array(z.string()).optional(),
        sinks: z.array(z.string()).optional(),
        filters: z.array(z.string()).optional(),
        cwe: z.string().optional().describe('CWE ID for preset sources/sinks (default: CWE-79)'),
      }),
    },
    ({ path, sources, sinks, filters, cwe }) => {
      try {
        const code = readFileSync(path, 'utf8');
        const options = resolveAnalyzeOptions({ sources, sinks, filters, cwe });
        const result = analyze(code, options);

        return {
          content: [{ type: 'text', text: formatAnalyzeResult(result) }],
          structuredContent: {
            path,
            options,
            pairs: result.pairs,
          },
        };
      } catch (error: unknown) {
        return {
          isError: true,
          content: [{ type: 'text', text: errorText(`Failed to analyze file "${path}"`, error) }],
        };
      }
    },
  );
}

function registerGetCweSpecsTool(server: McpServer): void {
  server.registerTool(
    'get_cwe_specs',
    {
      description: 'Get default source/sink/sanitizer specifications for a CWE',
      inputSchema: z.object({
        cwe: z.string().optional().describe('CWE ID (e.g., "CWE-79"). Omit to list all supported CWEs.'),
      }),
    },
    ({ cwe }) => {
      if (cwe !== undefined && cwe.trim().length > 0) {
        const cweId = normalizeCweId(cwe);
        const context = COMMON_CWE_CONTEXTS.find((entry) => entry.id === cweId);
        if (context === undefined) {
          const supported = COMMON_CWE_CONTEXTS.map((entry) => entry.id).join(', ');
          return {
            isError: true,
            content: [{ type: 'text', text: `Unsupported CWE "${cweId}". Supported values: ${supported}` }],
          };
        }

        const specs = getPresetForCwe(cweId);
        return {
          content: [
            {
              type: 'text',
              text: [
                `${context.id} — ${context.name}`,
                context.description,
                `Sources: ${specs.sources.join(', ') || '(none)'}`,
                `Sinks: ${specs.sinks.join(', ') || '(none)'}`,
                `Sanitizers: ${(specs.filters ?? []).join(', ') || '(none)'}`,
              ].join('\n'),
            },
          ],
          structuredContent: {
            cwe: context,
            sources: specs.sources,
            sinks: specs.sinks,
            sanitizers: specs.filters ?? [],
          },
        };
      }

      const summaries = COMMON_CWE_CONTEXTS.map((entry) => `${entry.id} — ${entry.name}: ${entry.description}`);
      return {
        content: [{ type: 'text', text: summaries.join('\n') }],
        structuredContent: {
          cwes: COMMON_CWE_CONTEXTS.map((entry) => ({
            id: entry.id,
            name: entry.name,
            description: entry.description,
          })),
        },
      };
    },
  );
}

export function resolveAnalyzeOptions(params: AnalyzeParams): AnalyzeOptions {
  if (params.sources !== undefined && params.sinks !== undefined) {
    return {
      sources: params.sources,
      sinks: params.sinks,
      filters: params.filters,
    };
  }

  const preset = getPresetForCwe(params.cwe);
  return {
    sources: params.sources ?? preset.sources,
    sinks: params.sinks ?? preset.sinks,
    filters: params.filters ?? preset.filters,
  };
}

export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: 'esflow',
      version: '2.0.0',
    },
    {
      capabilities: { tools: {} },
    },
  );

  registerAnalyzeTool(server);
  registerAnalyzeFileTool(server);
  registerGetCweSpecsTool(server);

  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('esflow MCP server running on stdio');
}
