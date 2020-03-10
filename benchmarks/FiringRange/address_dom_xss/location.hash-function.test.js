// https://public-firing-range.appspot.com/address/location.hash/function
var assert = require('assert');
var esflow = require('../../../index.js');

var code = "var payload = window.location.hash.substr(1);var f = new Function(payload);";
var sources = ['window.location.hash'];
var sinks = ['Function'];

var results = esflow.analyze(code,{sources: sources, sinks: sinks});
assert.equal(results.functionCallPairs.length, 1);
assert.equal(results.functionCallPairs[0].source.name, 'window.location.hash');
assert.equal(results.functionCallPairs[0].sink.name, 'Function');
