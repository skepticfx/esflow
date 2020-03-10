var escope= require('escope');
var esprima = require('esprima');
var standardLibraries;

/**
 * Tells whether a given JS code is possibly a library code or not.
 * @param code
 * @param libs - An array of libraries:  ['jQuery', 'Sizzle']
 */
function isStandardLibrary(code, libs){

  var ast, scopeManager, references, i, nonWindow = false;

  if(typeof code === 'undefined'){
    throw new Error('code cannot be empty');
  }

  if(!(libs instanceof Array)){
    libs = standardLibraries;
  }

  ast = esprima.parse(code);
  scopeManager = escope.analyze(ast);
  references = scopeManager.globalScope.references;

  if(references.length === 0) return false;

  for(i=0; i< references.length; i++){
    if(references[i].identifier.name !== 'window'){
      nonWindow = true;
    }
  }
  return !nonWindow;
}


standardLibraries = [
  'jQuery',
  'Sizzle'
];

module.exports = isStandardLibrary;

/**
 * The current logic looks at teh Escope's global variables and sees if all of them are a 'window' identifier,
 * possibly denoting a standard library trying to set global window variables. This is hacky now, but the -f option forces
 * the scan.
 *
 * Also the `libs` variable is unused now.
 */