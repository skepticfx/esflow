import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/index.js';
import { scenarios } from './firingrange.fixture.js';

const categories = new Map<string, typeof scenarios>();
for (const scenario of scenarios) {
  const list = categories.get(scenario.category) ?? [];
  list.push(scenario);
  categories.set(scenario.category, list);
}

for (const [category, group] of categories) {
  describe(`FiringRange: ${category}`, () => {
    for (const scenario of group) {
      it(`${scenario.id}: ${scenario.name}`, () => {
        const result = analyze(scenario.code, scenario.options);
        const totalPairs = result.pairs.length;

        if (scenario.expected.staticDetects) {
          expect(totalPairs).toBeGreaterThan(0);
        }

        expect(totalPairs).toBe(scenario.expected.totalPairs);
      });
    }
  });
}

describe('FiringRange: Summary', () => {
  it('reports detection rate', () => {
    let detected = 0;
    let total = 0;

    for (const scenario of scenarios) {
      if (scenario.category !== 'H: True Negatives') {
        total += 1;
        const result = analyze(scenario.code, scenario.options);
        if (result.pairs.length > 0) {
          detected += 1;
        }
      }
    }

    const percent = Math.round((detected / total) * 100);
    console.log(`Static detection rate: ${detected}/${total} (${percent}%)`);
    expect(true).toBe(true);
  });
});
