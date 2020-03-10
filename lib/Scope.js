var ScopeManager = require('./ScopeManager.js');
var FlowAnalyzer = require('./FlowAnalyzer.js');
var DeclarationVisitor = require('./visitors/DeclarationVisitor.js');
var LHSVisitor = require('./visitors/LeftHandSideVisitor');
var Syntax = require('estraverse').Syntax;

var declVisitor = new DeclarationVisitor();
var lhsVisitor = new LHSVisitor();

var Scope = function(ast, options, scopeManager){
  this._scopeManager = scopeManager;
  this._ast = ast; // The Scope's Node.
  this._code = options.code;
  this._sources = options.sources;
  this._sinks = options.sinks;
  this._specialSinks = options.specialSinks;
  this._filters = options.filters;
  this._declarations = declVisitor.getAllDeclarations(this._ast);
  this._assignments = [];
  this._functioncalls = [];
  this._returnStatements = [];
  this.flowAnalyzer  = new FlowAnalyzer(this);

};

Scope.prototype.addAssignment = function(name, value){
  if(value.type === Syntax.ObjectExpression){
    value.properties.length>0 && value.properties.forEach(function(prop){
      this.addAssignment(name+'.'+lhsVisitor.getName(prop.key), prop.value);
    }, this);
    return;
  }

  var assignment = {};
  assignment.name = name;
  assignment.rhs = value;
  assignment.loc = value.loc;
  this._assignments.push(assignment);
  this.flowAnalyzer.newAssignment(assignment);
};

Scope.prototype.addFunctionCall = function(name, args, node){
  var functionCall = {};
  functionCall.name = name;
  functionCall.args = args;
  functionCall.loc = node.loc;
  this._functioncalls.push(functionCall);
  this.flowAnalyzer.newFunctionCall(functionCall);
};

Scope.prototype.addReturn = function(s){
  this._returnStatements.push(s);
  this.flowAnalyzer.newReturnStatement(s);
};

module.exports = Scope;

