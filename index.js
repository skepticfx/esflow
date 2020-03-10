var esprima = require('esprima');
var fs = require('fs');
var _ = require('lodash');
var ScopeManager = require('./lib/ScopeManager.js');
var FlowVisitor = require('./lib/visitors/FlowVisitor.js');

module.exports = {
  analyze: function (code, options, status) {
    //TODO: Validate options and throw error.
    var ast = esprima.parse(code, {loc: true});
    var scopeManager = new ScopeManager(ast, options);
    var flowVisitor = new FlowVisitor(scopeManager);
    flowVisitor.statusEvents.on('progress', function(percentage){
      if(typeof status === 'function') {
        status({'progress': percentage});
      }
    });
    flowVisitor.visit(scopeManager.ast);
    //console.log(scopeManager.currentScope.flowAnalyzer._functionDeclarations);

    var results = {};
    results.loggedSources = scopeManager.currentScope.flowAnalyzer.loggedSources;
    results.assignmentPairs = scopeManager.currentScope.flowAnalyzer.assignmentPairs;
    results.functionCallPairs = scopeManager.currentScope.flowAnalyzer.functionCallPairs;
    results._taggedNames = scopeManager.currentScope.flowAnalyzer._taggedNames;
    results._flowAnalyzer = scopeManager.currentScope.flowAnalyzer;
    results.pairs = _.union(results.assignmentPairs, results.functionCallPairs);

    return results;
  }

};
