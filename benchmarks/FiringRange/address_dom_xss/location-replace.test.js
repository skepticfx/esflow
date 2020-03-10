// https://public-firing-range.appspot.com/address/location/replace
var assert = require('assert');
var esflow = require('../../../index.js');

var code = "var payload = window.location; location.replace(payload);";
var sources = ['window.location'];
var sinks = ['location.replace'];

var results = esflow.analyze(code,{sources: sources, sinks: sinks});

assert.equal(results.functionCallPairs.length, 1);
assert.equal(results.functionCallPairs[0].source.name, 'window.location');
assert.equal(results.functionCallPairs[0].sink.name, 'location.replace');
