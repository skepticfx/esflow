var esrecurse = require('esrecurse');

function getExpressionName(node){
  var visitor = new esrecurse.Visitor({
    Identifier: function (node) {
      this.addToName(node.name);
    },
    Property: function(node){
      // if the node has a name, then add it and return
      if(node.name){
        this.addToName(node.name);
      } else {
        this.visitChildren(node);
      }
    },
    Literal: function(node){
      if(node.value === null) node.value = 'null';
      if(node.value.length ===0) node.value = 'null';
      this.addToName(node.value);
    },
    MemberExpression: function(node){
      this.visit(node.object);
      this.visit(node.property);
    }

  });
  visitor.collectedName = "";
  visitor.addToName = function(name){
    if(this.collectedName.length === 0){
      this.collectedName = name;
    } else {
      this.collectedName += "." + name;
    }
  };
  visitor.visit(node);

  return visitor.collectedName;
}

module.exports = getExpressionName;