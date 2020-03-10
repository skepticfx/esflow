var esrecurse = require('esrecurse');
var util = require('util');
var _ = require('lodash');
var FlowVisitor = require('./FlowVisitor.js');
var LHSVisitor = require('./LeftHandSideVisitor.js');
var Syntax = require('estraverse').Syntax;

var lhsVisitor = new LHSVisitor();

/**
 * IsNameUsedVisitor - Recursive Visitor which checks whether a name is used in the given expression
 *
 * @constructor
 */
var IsNameUsedVisitor = function(){
  this.name = null;
  this.found = false;
  this.meta = "start";
  this.flowAnalyzer = null;
  esrecurse.Visitor.call(this);
};
util.inherits(IsNameUsedVisitor, esrecurse.Visitor);

IsNameUsedVisitor.prototype.find = function(name, expression, flowAnalyzer){
  var lVisitor = new LHSVisitor();
  if(lVisitor.getName(expression) === name){
    return true;
  }
  this.flowAnalyzer = flowAnalyzer;
  this.found = false;
  if(typeof name === 'object')  name = name.name;
  this.name = name;
  this.visit(expression);
  return this.found;
};


IsNameUsedVisitor.prototype.Identifier = function(node){
  if(this.name === node.name)
    this.found = true;
};

IsNameUsedVisitor.prototype.MemberExpression = function(node){
  if(node.object.type ===  Syntax.Identifier && node.property.type === Syntax.Identifier) {
    if((node.object.name + '.' + node.property.name) === this.name){
      this.found = true;
    }
  }
  this.visitChildren(node);
};


IsNameUsedVisitor.prototype.BinaryExpression = function(node){
  if(node.operator !== '===' && node.operator !== '==') {
    this.visitChildren(node);
  }
};


IsNameUsedVisitor.prototype.FunctionExpression = function(node){
  // Anonymous functions?
  var ScopeManager = require('../ScopeManager.js');

  var fa;

  var functionDefinition = node;
  var scopeManager = new ScopeManager(functionDefinition, this.flowAnalyzer.getOptions());
  scopeManager.totalLines = this.flowAnalyzer._scope._scopeManager.totalLines; // Inherit the totalLines from the original AST.
  scopeManager.addScope(functionDefinition);
  var flowVisitor = new FlowVisitor(scopeManager);
  flowVisitor.visit(scopeManager.ast);
  fa = scopeManager.globalScope.flowAnalyzer;
  if(fa.isReturnTagged() && this.name === fa._taggedReturnSource.originalSource){
    this.found = true;
  }

};

IsNameUsedVisitor.prototype.NewExpression = function(node) {
  this.CallExpression(node);
};

IsNameUsedVisitor.prototype.ConditionalExpression = function(node){
  if(node.consequent) this.visit(node.consequent);
  if(node.alternate) this.visit(node.alternate);
};


IsNameUsedVisitor.prototype.CallExpression = function(node){
  var fa;
  var inu = IsNameUsedVisitor;
  inu = new inu();
  // Check whether the callee name has been used.
  var calleeName = lhsVisitor.getName(node.callee);
  // strip EcmaScript String methods like substr(), toString() which returns a form of the String.
  calleeName = stripStringProperties(calleeName);
  // If one of the caller is a Filter function, then return that the name is not used because it becomes safe now.
  if(this.flowAnalyzer._filters.indexOf(calleeName) !== -1){
    this.found = false;
    return;
  }

  if(calleeName === this.name || inu.find(this.name, node.callee, this.flowAnalyzer)){
    this.found = true;
    return;
  }

  // if the callee is a known function and uses the argument, then return true
  if(this.isNameUsedInArgumentsOfKnownFunction(calleeName, node.arguments, this.name)){
    this.found = true;
    return;
  }


  // Step into each function definition and check whether the return value is tainted.
  if(_.includes(Object.keys(this.flowAnalyzer._functionDeclarations), calleeName)){
    var functionDefinition = this.flowAnalyzer._functionDeclarations[calleeName].rhs;
    var ScopeManager = require('../ScopeManager.js');
    var scopeManager = new ScopeManager(functionDefinition, this.flowAnalyzer.getOptions());
    scopeManager.totalLines = this.flowAnalyzer._scope._scopeManager.totalLines; // Inherit the totalLines from the original AST.
    scopeManager.addScope(functionDefinition);
    var flowVisitor = new FlowVisitor(scopeManager);
    fa = scopeManager.globalScope.flowAnalyzer;
    flowVisitor.visit(scopeManager.ast);
    if(fa.isReturnTagged() && this.name === fa._taggedReturnSource.originalSource){
      this.found = true;
    }
  }

};



module.exports = IsNameUsedVisitor;

// TODO: Use this hook to find manual filters which uses .replace, .slice etc.
function stripStringProperties(name){
  var i;
  var props = ['substr', 'toString', 'replace', 'search', 'slice', 'substring', 'sub', 'split', 'toLoweCase', 'toUpperCase', 'trim', 'trimLeft', 'trimRight', 'valueOf'];
  for(i=0; i<props.length; i++){
    if(name.includes(props[i])){
      return name.replace('.'+props[i], '');
    }
  }
  return name;
}


IsNameUsedVisitor.prototype.isNameUsedInArgumentsOfKnownFunction = function(calleeName, args, name){
  var isNameUsedVisitor;
  var i;
  var methods = ['JSON.parse', 'unescape', 'escape', 'decodeURI'];
  if(methods.indexOf(calleeName) !== -1){
    isNameUsedVisitor = new IsNameUsedVisitor();
    for(i=0;i<args.length; i++){
      if(isNameUsedVisitor.find(name, args[i], this.flowAnalyzer)){
        return true;
      }
    }
  }
  return false;
};