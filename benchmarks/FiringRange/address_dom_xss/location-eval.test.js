// https://public-firing-range.appspot.com/address/location/eval
var assert = require('assert');
var esflow = require('../../../index.js');

var code = "var payload = window.location; eval(payload);";
var sources = ['window.location'];
var sinks = ['eval'];

var results = esflow.analyze(code,{sources: sources, sinks: sinks});

assert.equal(results.functionCallPairs.length, 1);
assert.equal(results.functionCallPairs[0].source.name, 'window.location');
assert.equal(results.functionCallPairs[0].sink.name, 'eval');
