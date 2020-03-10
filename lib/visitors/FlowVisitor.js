var esrecurse = require('esrecurse');
var EventEmitter = require('events');
var util = require('util');
var LeftHandSideVisitor = require('./LeftHandSideVisitor.js');
var lhsVisitor = new LeftHandSideVisitor();
var Syntax = require('estraverse').Syntax;

/**
 * FlowVisitor - Recursive Visitor which flows through a given AST and emits events accordingly.
 *
 * @param scopeManager
 * @constructor
 */
var FlowVisitor = function(scopeManager){
  this.totalLines = scopeManager.totalLines;
  this.statusEvents = new EventEmitter();
  this.scopeManager = scopeManager;
  esrecurse.Visitor.call(this);
};
util.inherits(FlowVisitor, esrecurse.Visitor);

FlowVisitor.prototype.getCurrentScope = function(){
  return this.scopeManager.currentScope;
};

FlowVisitor.prototype.Program = function(node){
  this.statusEvents.emit('progress', 1);
  this.scopeManager.addScope(node);
  this.visitChildren(node);
  this.statusEvents.emit('progress', 100);
  // TODO: Close the current Program Scope.
};

FlowVisitor.prototype.VariableDeclarator = function(node){
  if(node.init){
    if(node.init.type === Syntax.FunctionExpression) {
      return this.getCurrentScope().addAssignment(lhsVisitor.getName(node.id), node.init, "Function", node);
    }
    this.getCurrentScope().addAssignment(lhsVisitor.getName(node.id), node.init, "Variable", node);
  }
  this.visit(node.init);
};

FlowVisitor.prototype.AssignmentExpression = function(node){
  if(node.operator === "="){
    this.getCurrentScope().addAssignment(lhsVisitor.getName(node.left), node.right);
  }
  this.visit(node.right);
};

FlowVisitor.prototype.NewExpression = function(node){
  this.getCurrentScope().addFunctionCall(lhsVisitor.getName(node.callee), node.arguments, node);
  this.visitChildren(node);
};

FlowVisitor.prototype.CallExpression = function(node){
  this.getCurrentScope().addFunctionCall(lhsVisitor.getName(node.callee), node.arguments, node);
  this.visitChildren(node);
};

FlowVisitor.prototype.FunctionDeclaration = function(node){
  // do not traverse. Only callExpressions of this Function are traversed.
};

FlowVisitor.prototype.VisitFunctionDeclaration = function(node){
  // do not traverse. Only callExpressions of this Function are traversed.
  this.visitChildren(node);
};


FlowVisitor.prototype.ReturnStatement = function(node){
 // this.visitChildren(node);
  this.emitProgressStatus(node);
  this.getCurrentScope().addReturn(node);
};

FlowVisitor.prototype.emitProgressStatus = function(node){
  var totalLines = this.totalLines;
  var currentLine = node.loc.start.line;
  var percentComplete = Math.floor(currentLine*100/totalLines);
  this.statusEvents.emit('progress', percentComplete);
};


module.exports = FlowVisitor;