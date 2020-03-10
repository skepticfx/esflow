// https://public-firing-range.appspot.com/address/URLUnencoded/documentwrite
var assert = require('assert');
var esflow = require('../../../index.js');

var code = "var payload = document.URLUnencoded; document.write(payload);";
var sources = ['document.URLUnencoded'];
var sinks = ['document.write'];

var results = esflow.analyze(code,{sources: sources, sinks: sinks});

assert.equal(results.functionCallPairs.length, 1);
assert.equal(results.functionCallPairs[0].source.name, 'document.URLUnencoded');
assert.equal(results.functionCallPairs[0].sink.name, 'document.write');
