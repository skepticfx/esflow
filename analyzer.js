// Debugs everything and helps fix bugs / performance issues.
// node analyzer.js ./inputs/file.js
var esflow = require('./index.js');
var code = require('fs').readFileSync((process.argv[2]), 'utf8');

var sources = ['document.cookie', 'location.href', 'location.hash', 'window.name', 'location'];
var sinks = ['.innerHTML', '.outerHTML', '$', 'jQuery', 'eval', 'setTimeout', 'document.write', 'location'];

var res = esflow.analyze(code, {sources: sources, sinks: sinks});


console.log('_taggedNames');
console.log(res._taggedNames);

console.log('assignment pairs');
console.log(res.assignmentPairs);

console.log('function call pairs');
console.log(res.functionCallPairs);

console.log('return statements');
console.log(res._flowAnalyzer._returnStatements);

