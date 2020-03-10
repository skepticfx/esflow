var expect = require('expect.js');
var LHSVisitor = require('../lib/visitors/LeftHandSideVisitor.js');
var fs = require('fs');
var esrecurse = require('esrecurse');



describe('Testing LeftHandSideVisitor', function(){
  var result = [];
  var code = fs.readFileSync('./test/fixtures/LHSVisitor.fixture.js', 'utf8');
  var ast = require('esprima').parse(code);
  var lhsVisitor = new LHSVisitor();
  esrecurse.visit(ast, {
    AssignmentExpression: function(node){
      result.push(lhsVisitor.getName(node.right));
      this.visitChildren(node);
    }
  });

  describe('.getName():', function(){
    it('chained object properties', function(){
      expect(result).to.be.an('array');
      expect(result).to.eql([
        'a',
        'a.b',
        'a.b.c',
        'a.b.c.d',
        'a.call',
        'a.b.call',
        'a.b.1',
        'call'
      ]);
    });

  });
});