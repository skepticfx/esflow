import { parseSync, type OxcError, type Program } from 'oxc-parser';

export interface ParseOutput {
  program: Program;
  errors: OxcError[];
}

export function parse(code: string, filename = 'input.js'): ParseOutput {
  const result = parseSync(filename, code, {
    lang: 'js',
    sourceType: 'script',
  });

  return {
    program: result.program,
    errors: result.errors,
  };
}
