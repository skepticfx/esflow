import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/index.js';

const FIXTURE = resolve(process.cwd(), 'test/fixtures/functionCalls.fixture.js');
const FILTERED_FIXTURE = resolve(process.cwd(), 'test/fixtures/functionCalls.filtered.fixture.js');

const options = {
  sources: ['location.href', 'location.hash', 'document.cookie'],
  sinks: ['eval'],
};

describe('function-call taint flows', () => {
  it('finds all expected source-to-function-call sink flows', () => {
    const code = readFileSync(FIXTURE, 'utf8');
    const result = analyze(code, options);

    expect(result.functionCallPairs).toHaveLength(8);

    const compact = result.functionCallPairs.map((pair) => ({
      source: pair.source.name,
      sink: pair.sink.name,
      sinkRefs: pair.sink.refs ?? [],
      line: pair.lineNumber,
    }));

    expect(compact).toEqual([
      { source: 'location.href', sink: 'eval', sinkRefs: [], line: 6 },
      { source: 'location.hash', sink: 'eval', sinkRefs: [], line: 10 },
      { source: 'document.cookie', sink: 'eval', sinkRefs: [], line: 15 },
      { source: 'location.hash', sink: 'eval', sinkRefs: [], line: 19 },
      { source: 'location.href', sink: 'eval', sinkRefs: [], line: 26 },
      { source: 'location.hash', sink: 'eval', sinkRefs: [], line: 36 },
      { source: 'location.hash', sink: 'eval', sinkRefs: ['e'], line: 40 },
      { source: 'location.href', sink: 'eval', sinkRefs: ['a.b'], line: 45 },
    ]);
  });

  it('returns no function-call pairs when values are filtered', () => {
    const code = readFileSync(FILTERED_FIXTURE, 'utf8');
    const result = analyze(code, {
      ...options,
      filters: ['escape', 'escapeHTML'],
    });

    expect(result.functionCallPairs).toHaveLength(0);
  });
});
