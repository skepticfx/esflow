#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyze, enhancedAnalyze, type AnalyzeOptions, type AnalyzeResult, type EnhancedAnalyzeResult } from '../index.js';
import {
  COMMON_CWE_CONTEXTS,
  CWE_22_PATH_TRAVERSAL,
  CWE_78_COMMAND_INJECTION,
  CWE_79_XSS,
  CWE_89_SQL_INJECTION,
} from '../specs/cwe.js';

interface ParsedArgs {
  filePath: string | null;
  aiEnabled: boolean;
  mcpEnabled: boolean;
  cweId: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  let aiEnabled = false;
  let mcpEnabled = false;
  let cweId = CWE_79_XSS.id;
  let filePath: string | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined) {
      continue;
    }

    if (arg === '--ai') {
      aiEnabled = true;
      continue;
    }

    if (arg === '--mcp') {
      mcpEnabled = true;
      continue;
    }

    if (arg === '--cwe') {
      const value = argv[i + 1];
      if (value !== undefined) {
        cweId = value;
        i += 1;
      }
      continue;
    }

    if (arg.startsWith('--')) {
      continue;
    }

    if (filePath === null) {
      filePath = arg;
    }
  }

  return { filePath, aiEnabled, mcpEnabled, cweId };
}

function printUsage(): void {
  process.stdout.write(
    [
      'Usage:',
      '  esflow <file>                    Static analysis only',
      '  esflow <file> --ai               Enable LLM-enhanced analysis (requires ANTHROPIC_API_KEY)',
      '  esflow <file> --ai --cwe CWE-79  Focus on specific vulnerability type',
      '  esflow --mcp                     Start MCP server for AI agent integration',
      '',
    ].join('\n'),
  );
}

function defaultSpecsForCwe(cweId: string): AnalyzeOptions {
  if (cweId === CWE_78_COMMAND_INJECTION.id) {
    return {
      sources: ['req.query.cmd', 'req.body.cmd', 'process.argv'],
      sinks: ['exec', 'execSync', 'spawn', 'spawnSync'],
      filters: ['shellEscape'],
    };
  }

  if (cweId === CWE_89_SQL_INJECTION.id) {
    return {
      sources: ['req.query', 'req.body', 'location.search'],
      sinks: ['db.query', 'connection.query', 'sequelize.query'],
      filters: ['escape', 'mysql.escape'],
    };
  }

  if (cweId === CWE_22_PATH_TRAVERSAL.id) {
    return {
      sources: ['req.query.path', 'req.params.path', 'location.pathname'],
      sinks: ['fs.readFile', 'fs.writeFile', 'fs.createReadStream'],
      filters: ['path.normalize', 'path.resolve'],
    };
  }

  return {
    sources: ['location.href', 'location.hash', 'document.cookie'],
    sinks: ['.innerHTML', 'eval', 'document.write'],
    filters: ['encodeURIComponent', 'DOMPurify.sanitize'],
  };
}

function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, idx) => {
    const contentWidths = rows.map((row) => (row[idx] ?? '').length);
    return Math.max(header.length, ...contentWidths);
  });

  const line = (cols: string[]): string =>
    `| ${cols.map((col, idx) => (col ?? '').padEnd(widths[idx] ?? 0, ' ')).join(' | ')} |`;

  const separator = `|-${widths.map((w) => ''.padEnd(w, '-')).join('-|-')}-|`;
  return [line(headers), separator, ...rows.map((row) => line(row))].join('\n');
}

function formatResult(result: AnalyzeResult): string {
  const rows = result.pairs.map((pair) => [
    pair.source.name,
    pair.sink.name,
    String(pair.lineNumber),
    pair.source.refs.join(' -> '),
    (pair.sink.refs ?? []).join(' -> '),
  ]);

  if (rows.length === 0) {
    return 'No taint flows found.';
  }

  return table(['Source', 'Sink', 'Line', 'Source refs', 'Sink refs'], rows);
}

function findCwe(cweId: string) {
  return COMMON_CWE_CONTEXTS.find((entry) => entry.id === cweId) ?? CWE_79_XSS;
}

function printEnhancements(result: EnhancedAnalyzeResult): void {
  const enhancements = result.agentEnhancements;
  if (enhancements === undefined) {
    return;
  }

  process.stdout.write('\nAgent enhancements\n');
  process.stdout.write(`- discoveredSources: ${enhancements.discoveredSources.join(', ') || '(none)'}\n`);
  process.stdout.write(`- discoveredSinks: ${enhancements.discoveredSinks.join(', ') || '(none)'}\n`);
  process.stdout.write(`- discoveredSanitizers: ${enhancements.discoveredSanitizers.join(', ') || '(none)'}\n`);
  process.stdout.write(`- resolvedCalls: ${enhancements.resolvedCalls.length}\n`);
  process.stdout.write(`- flowSummaries: ${enhancements.flowSummaries.length}\n`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.mcpEnabled) {
    const { startMcpServer } = await import('../mcp/server.js');
    await startMcpServer();
    return;
  }

  if (args.filePath === null) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const fullPath = resolve(process.cwd(), args.filePath);
  const code = readFileSync(fullPath, 'utf8');
  const cwe = findCwe(args.cweId);
  const staticOptions = defaultSpecsForCwe(cwe.id);

  if (!args.aiEnabled) {
    const result = analyze(code, staticOptions);
    process.stdout.write(`${formatResult(result)}\n`);
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim() ?? '';
  if (!apiKey) {
    process.stderr.write('Missing ANTHROPIC_API_KEY. Running static-only analysis.\n');
    const fallbackResult = analyze(code, staticOptions);
    process.stdout.write(`${formatResult(fallbackResult)}\n`);
    return;
  }

  const result = await enhancedAnalyze({
    ...staticOptions,
    code,
    cwe,
    agentConfig: { apiKey },
  });

  process.stdout.write(`${formatResult(result)}\n`);
  printEnhancements(result);
}

void main();
