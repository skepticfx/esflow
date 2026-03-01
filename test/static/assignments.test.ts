import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/index.js';

const FIXTURE = resolve(process.cwd(), 'test/fixtures/assignments.fixture.js');
const FILTERED_FIXTURE = resolve(process.cwd(), 'test/fixtures/assignments.filtered.fixture.js');

const options = {
  sources: ['location.href', 'location.hash', 'document.cookie'],
  sinks: ['.innerHTML'],
};

describe('assignment taint flows', () => {
  it('finds all expected source-to-assignment sink flows', () => {
    const code = readFileSync(FIXTURE, 'utf8');
    const result = analyze(code, options);

    expect(result.assignmentPairs).toHaveLength(7);

    const compact = result.assignmentPairs.map((pair) => ({
      source: pair.source.name,
      sink: pair.sink.name,
      line: pair.lineNumber,
    }));

    expect(compact).toEqual([
      { source: 'location.href', sink: 'document.body.innerHTML', line: 7 },
      { source: 'location.hash', sink: 'document.body.innerHTML', line: 10 },
      { source: 'document.cookie', sink: 'node.innerHTML', line: 15 },
      { source: 'document.cookie', sink: 'el.innerHTML', line: 20 },
      { source: 'location.hash', sink: 'element.innerHTML', line: 23 },
      { source: 'location.href', sink: 'element.innerHTML', line: 30 },
      { source: 'location.hash', sink: 'elt.innerHTML', line: 40 },
    ]);
  });

  it('returns no assignment pairs when values are filtered', () => {
    const code = readFileSync(FILTERED_FIXTURE, 'utf8');
    const result = analyze(code, {
      ...options,
      filters: ['escape', 'escapeHTML'],
    });

    expect(result.assignmentPairs).toHaveLength(0);
  });
});
