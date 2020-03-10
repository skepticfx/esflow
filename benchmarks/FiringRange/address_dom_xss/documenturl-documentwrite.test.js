// https://public-firing-range.appspot.com/address/documentUrl/documentwrite
var assert = require('assert');
var esflow = require('../../../index.js');

var code = "var payload = document.URL; document.write(payload);";
var sources = ['document.URL'];
var sinks = ['document.write'];

var results = esflow.analyze(code,{sources: sources, sinks: sinks});

assert.equal(results.functionCallPairs.length, 1);
assert.equal(results.functionCallPairs[0].source.name, 'document.URL');
assert.equal(results.functionCallPairs[0].sink.name, 'document.write');
