var Scope = require('./Scope.js');

var ScopeManager = function(ast, options){
  this.ast = ast;
  this.globalScope = [];
  this.scopes = [];
  this.currentScope = null;
  this.options = options;
  this.options.code = this.code;
  this.options.ast = this.ast;
  this.totalLines = ast.loc.end.line;
};

ScopeManager.prototype.addScope = function(node){
  var scope = new Scope(node, this.options, this);
  if(this.currentScope === null) {
    this.globalScope = scope;
  }
  this.scopes.push(scope);
  this.currentScope = scope;
};

module.exports = ScopeManager;