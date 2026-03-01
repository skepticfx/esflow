import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/index.js';
import { createMcpServer, resolveAnalyzeOptions } from '../../src/mcp/server.js';

describe('MCP Server', () => {
  it('creates server instance', () => {
    const server = createMcpServer();
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(McpServer);
  });
});

describe('resolveAnalyzeOptions', () => {
  it('uses explicit sources and sinks', () => {
    const opts = resolveAnalyzeOptions({
      sources: ['location.href'],
      sinks: ['.innerHTML'],
    });

    expect(opts.sources).toEqual(['location.href']);
    expect(opts.sinks).toEqual(['.innerHTML']);
  });

  it('resolves CWE-79 defaults', () => {
    const opts = resolveAnalyzeOptions({ cwe: 'CWE-79' });
    expect(opts.sources.length).toBeGreaterThan(0);
    expect(opts.sinks.length).toBeGreaterThan(0);
  });

  it('falls back to CWE-79 when nothing provided', () => {
    const opts = resolveAnalyzeOptions({});
    expect(opts.sources.length).toBeGreaterThan(0);
    expect(opts.sinks.length).toBeGreaterThan(0);
  });

  it('falls back to CWE-79 for unknown cwe id', () => {
    const opts = resolveAnalyzeOptions({ cwe: 'CWE-999' });
    expect(opts.sources).toContain('location.href');
    expect(opts.sinks).toContain('.innerHTML');
  });

  it('analyze works with resolved options', () => {
    const opts = resolveAnalyzeOptions({ cwe: 'CWE-79' });
    const result = analyze('document.body.innerHTML = location.href;', opts);
    expect(result.pairs.length).toBeGreaterThan(0);
  });
});
