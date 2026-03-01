import { describe, expect, it, vi } from 'vitest';
import { enhancedAnalyze } from '../../src/index.js';

const createMessageMock = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      public messages = {
        create: createMessageMock,
      };

      public constructor(_config: { apiKey: string }) {}
    },
  };
});

describe('enhancedAnalyze orchestrator', () => {
  it('merges discovered source/sink/sanitizer spec from mocked LLM tool_use output', async () => {
    createMessageMock.mockReset();
    createMessageMock
      .mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'submit_spec',
            input: {
              sources: ['location.hash'],
              sinks: ['.innerHTML'],
              sanitizers: ['escapeHTML'],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: 'submitted',
          },
        ],
      });

    const result = await enhancedAnalyze({
      code: ['const input = location.hash;', 'document.body.innerHTML = input;'].join('\n'),
      sources: ['req.query.x'],
      sinks: ['eval'],
      filters: ['sanitize'],
      agentConfig: {
        apiKey: 'test-key',
      },
    });

    expect(result.assignmentPairs).toHaveLength(1);
    expect(result.assignmentPairs[0]?.source.name).toBe('location.hash');
    expect(result.assignmentPairs[0]?.sink.name).toBe('document.body.innerHTML');

    expect(result.agentEnhancements).toEqual({
      discoveredSources: ['location.hash'],
      discoveredSinks: ['.innerHTML'],
      discoveredSanitizers: ['escapeHTML'],
      resolvedCalls: [],
      flowSummaries: [],
    });

    expect(createMessageMock).toHaveBeenCalledTimes(2);
  });
});
