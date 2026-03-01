import type { CWEContext } from '../agents/types.js';

export const CWE_79_XSS: CWEContext = {
  id: 'CWE-79',
  name: 'Cross-site Scripting (XSS)',
  description:
    'The software does not neutralize or incorrectly neutralizes user-controllable input before it is placed in output that is used as a web page that is served to other users. Common sources include URL parameters, cookies, form inputs, and postMessage data. Common sinks include innerHTML, document.write, eval, and framework-specific rendering functions.',
};

export const CWE_78_COMMAND_INJECTION: CWEContext = {
  id: 'CWE-78',
  name: 'OS Command Injection',
  description:
    'The software constructs OS command strings using untrusted input and executes them. Common sources include HTTP params, environment variables, and IPC messages. Common sinks include exec, spawn, child_process APIs, and shell wrappers.',
};

export const CWE_89_SQL_INJECTION: CWEContext = {
  id: 'CWE-89',
  name: 'SQL Injection',
  description:
    'The software constructs SQL queries using untrusted input without proper parameterization. Common sources include request/query/body fields. Common sinks include raw SQL query APIs and string-interpolated database calls.',
};

export const CWE_22_PATH_TRAVERSAL: CWEContext = {
  id: 'CWE-22',
  name: 'Path Traversal',
  description:
    'The software uses untrusted input to build filesystem paths, allowing traversal outside intended directories. Common sources include URL params and filenames from user input. Common sinks include fs read/write APIs and file-serving helpers.',
};

export const COMMON_CWE_CONTEXTS: CWEContext[] = [
  CWE_79_XSS,
  CWE_78_COMMAND_INJECTION,
  CWE_89_SQL_INJECTION,
  CWE_22_PATH_TRAVERSAL,
];
