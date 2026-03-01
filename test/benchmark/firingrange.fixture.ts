export interface BenchmarkScenario {
  id: string;
  name: string;
  category: string;
  code: string;
  options: {
    sources: string[];
    sinks: string[];
    filters?: string[];
  };
  expected: {
    staticDetects: boolean;
    totalPairs: number;
    notes?: string;
  };
}

const sourceDiversityOptions = {
  sources: [
    'location.href',
    'location.hash',
    'location.search',
    'document.cookie',
    'document.referrer',
    'window.name',
  ],
  sinks: ['.innerHTML'],
};

const innerHtmlOptions = {
  sources: ['location.hash'],
  sinks: ['.innerHTML'],
};

const builtInFailureOptions = {
  sources: ['location.href', 'document.cookie', 'location.hash'],
  sinks: ['.innerHTML'],
};

export const scenarios: BenchmarkScenario[] = [
  {
    id: 'fr-01',
    name: 'location.href to innerHTML',
    category: 'A: Source Diversity',
    code: 'document.body.innerHTML = location.href;',
    options: sourceDiversityOptions,
    expected: { staticDetects: true, totalPairs: 1 },
  },
  {
    id: 'fr-02',
    name: 'location.hash to innerHTML',
    category: 'A: Source Diversity',
    code: 'document.body.innerHTML = location.hash;',
    options: sourceDiversityOptions,
    expected: { staticDetects: true, totalPairs: 1 },
  },
  {
    id: 'fr-03',
    name: 'location.search to innerHTML',
    category: 'A: Source Diversity',
    code: 'document.body.innerHTML = location.search;',
    options: sourceDiversityOptions,
    expected: { staticDetects: true, totalPairs: 1 },
  },
  {
    id: 'fr-04',
    name: 'document.cookie to innerHTML',
    category: 'A: Source Diversity',
    code: 'document.body.innerHTML = document.cookie;',
    options: sourceDiversityOptions,
    expected: { staticDetects: true, totalPairs: 1 },
  },
  {
    id: 'fr-05',
    name: 'document.referrer to innerHTML',
    category: 'A: Source Diversity',
    code: 'document.body.innerHTML = document.referrer;',
    options: sourceDiversityOptions,
    expected: { staticDetects: true, totalPairs: 1 },
  },
  {
    id: 'fr-06',
    name: 'window.name to innerHTML',
    category: 'A: Source Diversity',
    code: 'document.body.innerHTML = window.name;',
    options: sourceDiversityOptions,
    expected: { staticDetects: true, totalPairs: 1 },
  },

  {
    id: 'fr-07',
    name: 'assignment sink innerHTML',
    category: 'B: Sink Diversity',
    code: 'document.body.innerHTML = location.hash;',
    options: { sources: ['location.hash'], sinks: ['.innerHTML'] },
    expected: { staticDetects: true, totalPairs: 1 },
  },
  {
    id: 'fr-08',
    name: 'assignment sink outerHTML',
    category: 'B: Sink Diversity',
    code: 'document.body.outerHTML = location.hash;',
    options: { sources: ['location.hash'], sinks: ['.outerHTML'] },
    expected: { staticDetects: true, totalPairs: 1 },
  },
  {
    id: 'fr-09',
    name: 'function call sink eval',
    category: 'B: Sink Diversity',
    code: 'eval(location.hash);',
    options: { sources: ['location.hash'], sinks: ['eval'] },
    expected: { staticDetects: true, totalPairs: 1 },
  },
  {
    id: 'fr-10',
    name: 'function call sink document.write',
    category: 'B: Sink Diversity',
    code: 'document.write(location.hash);',
    options: { sources: ['location.hash'], sinks: ['document.write'] },
    expected: { staticDetects: true, totalPairs: 1 },
  },
  {
    id: 'fr-11',
    name: 'function call sink setTimeout string arg',
    category: 'B: Sink Diversity',
    code: 'setTimeout(location.hash, 0);',
    options: { sources: ['location.hash'], sinks: ['setTimeout'] },
    expected: { staticDetects: true, totalPairs: 1 },
  },
  {
    id: 'fr-12',
    name: 'new expression sink Function',
    category: 'B: Sink Diversity',
    code: 'new Function(location.hash);',
    options: { sources: ['location.hash'], sinks: ['Function'] },
    expected: { staticDetects: true, totalPairs: 1 },
  },

  {
    id: 'fr-13',
    name: 'single variable hop',
    category: 'C: Variable Propagation',
    code: 'var x = location.hash; document.body.innerHTML = x;',
    options: innerHtmlOptions,
    expected: { staticDetects: true, totalPairs: 1 },
  },
  {
    id: 'fr-14',
    name: 'two variable hops',
    category: 'C: Variable Propagation',
    code: 'var x = location.hash; var y = x; document.body.innerHTML = y;',
    options: innerHtmlOptions,
    expected: { staticDetects: true, totalPairs: 1 },
  },
  {
    id: 'fr-15',
    name: 'object property propagation',
    category: 'C: Variable Propagation',
    code: 'var obj = { x: location.hash }; document.body.innerHTML = obj.x;',
    options: innerHtmlOptions,
    expected: { staticDetects: true, totalPairs: 1 },
  },
  {
    id: 'fr-16',
    name: 'array index propagation',
    category: 'C: Variable Propagation',
    code: 'var arr = [location.hash]; var el = arr[0]; document.body.innerHTML = el;',
    options: innerHtmlOptions,
    expected: { staticDetects: true, totalPairs: 1 },
  },

  {
    id: 'fr-17',
    name: 'source through function return',
    category: 'D: Function Flow',
    code: 'function getHash() { return location.hash; } document.body.innerHTML = getHash();',
    options: innerHtmlOptions,
    expected: { staticDetects: true, totalPairs: 1 },
  },
  {
    id: 'fr-18',
    name: 'nested function call chain',
    category: 'D: Function Flow',
    code: 'function a() { return location.hash; } function b() { return a(); } document.body.innerHTML = b();',
    options: innerHtmlOptions,
    expected: { staticDetects: true, totalPairs: 1 },
  },
  {
    id: 'fr-19',
    name: 'source as parameter then returned',
    category: 'D: Function Flow',
    code: 'function id(v) { return v; } var src = location.hash; document.body.innerHTML = id(src);',
    options: innerHtmlOptions,
    expected: { staticDetects: true, totalPairs: 1 },
  },
  {
    id: 'fr-20',
    name: 'multiple returns in if/else',
    category: 'D: Function Flow',
    code: 'function pick(v) { if (v) { return v; } return v; } document.body.innerHTML = pick(location.hash);',
    options: innerHtmlOptions,
    expected: { staticDetects: true, totalPairs: 1 },
  },

  {
    id: 'fr-21',
    name: 'variable alias for eval',
    category: 'E: Sink Aliasing',
    code: 'var e = eval; e(location.hash);',
    options: { sources: ['location.hash'], sinks: ['eval', 'document.write'] },
    expected: { staticDetects: true, totalPairs: 1 },
  },
  {
    id: 'fr-22',
    name: 'object property alias for eval',
    category: 'E: Sink Aliasing',
    code: 'var obj = {}; obj.fn = eval; obj.fn(location.hash);',
    options: { sources: ['location.hash'], sinks: ['eval', 'document.write'] },
    expected: { staticDetects: true, totalPairs: 1 },
  },
  {
    id: 'fr-23',
    name: 'variable alias for document.write',
    category: 'E: Sink Aliasing',
    code: 'var w = document.write; w(location.hash);',
    options: { sources: ['location.hash'], sinks: ['eval', 'document.write'] },
    expected: { staticDetects: true, totalPairs: 1 },
  },

  {
    id: 'fr-24',
    name: 'string concatenation expression',
    category: 'F: Expression Contexts',
    code: 'document.body.innerHTML = "<div>" + location.hash + "</div>";',
    options: innerHtmlOptions,
    expected: { staticDetects: true, totalPairs: 1 },
  },
  {
    id: 'fr-25',
    name: 'template literal expression',
    category: 'F: Expression Contexts',
    code: 'document.body.innerHTML = `<div>${location.hash}</div>`;',
    options: innerHtmlOptions,
    expected: { staticDetects: true, totalPairs: 1 },
  },
  {
    id: 'fr-26',
    name: 'ternary with tainted branch',
    category: 'F: Expression Contexts',
    code: 'document.body.innerHTML = (true ? location.hash : "safe");',
    options: innerHtmlOptions,
    expected: { staticDetects: true, totalPairs: 1 },
  },
  {
    id: 'fr-27',
    name: 'logical OR expression',
    category: 'F: Expression Contexts',
    code: 'document.body.innerHTML = (location.hash || "fallback");',
    options: innerHtmlOptions,
    expected: { staticDetects: true, totalPairs: 1 },
  },

  {
    id: 'fr-28',
    name: 'split on location.href fragment',
    category: 'G: Built-in Method Chains',
    code: 'var frag = location.href.split("#")[1]; document.body.innerHTML = frag;',
    options: builtInFailureOptions,
    expected: {
      staticDetects: false,
      totalPairs: 0,
      notes: 'Static engine does not model String.split taint propagation.',
    },
  },
  {
    id: 'fr-29',
    name: 'cookie parsing via split in loop',
    category: 'G: Built-in Method Chains',
    code: 'var parts = document.cookie.split(";"); var out = ""; for (var i = 0; i < parts.length; i++) { out = parts[i]; } document.body.innerHTML = out;',
    options: builtInFailureOptions,
    expected: {
      staticDetects: false,
      totalPairs: 0,
      notes: 'Taint is lost at document.cookie.split because built-in methods are not summarized.',
    },
  },
  {
    id: 'fr-30',
    name: 'JSON.parse then property access',
    category: 'G: Built-in Method Chains',
    code: 'var parsed = JSON.parse(location.hash); document.body.innerHTML = parsed.user;',
    options: builtInFailureOptions,
    expected: {
      staticDetects: false,
      totalPairs: 0,
      notes: 'JSON.parse is a built-in call and returns untainted in static-only mode.',
    },
  },
  {
    id: 'fr-31',
    name: 'decodeURIComponent wrapper call',
    category: 'G: Built-in Method Chains',
    code: 'var decoded = decodeURIComponent(location.hash); document.body.innerHTML = decoded;',
    options: builtInFailureOptions,
    expected: {
      staticDetects: false,
      totalPairs: 0,
      notes: 'decodeURIComponent is not a user-defined function, so taint does not propagate.',
    },
  },
  {
    id: 'fr-32',
    name: 'substring on source string',
    category: 'G: Built-in Method Chains',
    code: 'var part = location.hash.substring(0, 10); document.body.innerHTML = part;',
    options: builtInFailureOptions,
    expected: {
      staticDetects: false,
      totalPairs: 0,
      notes: 'String.substring is a built-in method with no static flow summary.',
    },
  },

  {
    id: 'fr-33',
    name: 'source filtered by encodeURIComponent',
    category: 'H: True Negatives',
    code: 'var clean = encodeURIComponent(location.hash); document.body.innerHTML = clean;',
    options: {
      sources: ['location.hash'],
      sinks: ['.innerHTML'],
      filters: ['encodeURIComponent'],
    },
    expected: { staticDetects: false, totalPairs: 0 },
  },
  {
    id: 'fr-34',
    name: 'tainted variable reassigned safe value',
    category: 'H: True Negatives',
    code: 'var x = location.hash; x = "safe"; document.body.innerHTML = x;',
    options: innerHtmlOptions,
    expected: { staticDetects: false, totalPairs: 0 },
  },
  {
    id: 'fr-35',
    name: 'comparison result is boolean not tainted',
    category: 'H: True Negatives',
    code: 'var isMatch = (location.hash == "expected"); document.body.innerHTML = isMatch;',
    options: innerHtmlOptions,
    expected: { staticDetects: false, totalPairs: 0 },
  },
  {
    id: 'fr-36',
    name: 'literal assignment to sink',
    category: 'H: True Negatives',
    code: 'document.body.innerHTML = "hello";',
    options: innerHtmlOptions,
    expected: { staticDetects: false, totalPairs: 0 },
  },
  {
    id: 'fr-37',
    name: 'safe function return to sink',
    category: 'H: True Negatives',
    code: 'function getSafe() { return "safe"; } document.body.innerHTML = getSafe();',
    options: innerHtmlOptions,
    expected: { staticDetects: false, totalPairs: 0 },
  },
  {
    id: 'fr-38',
    name: 'source exists but does not reach sink',
    category: 'H: True Negatives',
    code: 'var unused = location.hash; document.body.innerHTML = "safe";',
    options: innerHtmlOptions,
    expected: { staticDetects: false, totalPairs: 0 },
  },
];
