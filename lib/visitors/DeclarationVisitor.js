var esrecurse = require('esrecurse');
var util = require('util');
var LeftHandSideVisitor = require('./LeftHandSideVisitor');

var lhsVisitor = new LeftHandSideVisitor();
var Syntax = require('estraverse').Syntax;
/**
 * DeclarationVisitor - Gets all Declarations in the node's current scope.
 *
 * @constructor
 */
var DeclarationVisitor = function(){
  this.declarations = {};
  esrecurse.Visitor.call(this);
};
util.inherits(DeclarationVisitor, esrecurse.Visitor);

/**
 *
 * @param node
 * @returns declarations: {varaibles: [], functions:[]}
 */
DeclarationVisitor.prototype.getAllDeclarations = function(node){
  this.visit(node);
  return this.declarations;
};

DeclarationVisitor.prototype.addDeclaration = function(key, value, type){
  if(value === null && this.declarations.hasOwnProperty(key)){
    return;
  }
  this.declarations[key] = {};
  this.declarations[key].name = key;
  this.declarations[key].rhs = value;
  this.declarations[key].type = type;
  this.declarations[key].loc = value.loc;
};

DeclarationVisitor.prototype.VariableDeclaration = function(node){
  // Not really used now.
  // Rather we assign all VariableDeclarators.
  node.kind === 'var' && node.declarations.forEach(function(declarator){
      this.visit(declarator);
  }, this);
};


DeclarationVisitor.prototype.FunctionDeclaration = function(node){
  node.type = "VisitFunctionDeclaration";
  this.addDeclaration(lhsVisitor.getName(node.id), node, "Function");
};



module.exports = DeclarationVisitor;