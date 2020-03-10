var esrecurse = require('esrecurse');
var util = require('util');


var LeftHandSideVisitor = function(){
  this.collectedName = "";
  esrecurse.Visitor.call(this);
};
util.inherits(LeftHandSideVisitor, esrecurse.Visitor);

LeftHandSideVisitor.prototype.addToName = function(name){
  if(this.collectedName.length === 0){
    this.collectedName = name;
  } else {
    this.collectedName += "." + name;
  }
};

LeftHandSideVisitor.prototype.getName = function(node){
  this.collectedName = "";
  this.visit(node);
  return this.collectedName;
};

LeftHandSideVisitor.prototype.Identifier = function(node){
  this.addToName(node.name);
};

LeftHandSideVisitor.prototype.Literal = function(node){
  if(node.value === null) node.value = 'null';
  if(node.value.length ===0) node.value = 'null';

  this.addToName(node.value);
};

LeftHandSideVisitor.prototype.Property = function(node){
  // if the node has a name, then add it and return
  if(node.name){
    this.addToName(node.name);
  } else {
    this.visitChildren(node);
  }
};

LeftHandSideVisitor.prototype.MemberExpression = function(node){
  this.visit(node.object);
  this.visit(node.property);
};


module.exports = LeftHandSideVisitor;