// https://public-firing-range.appspot.com/address/location.hash/setTimeout
var assert = require('assert');
var esflow = require('../../../index.js');

var code = "var payload = window.location.hash.substr(1);var div = document.createElement('div'); div.addEventListener('click', new Function(payload), false); document.documentElement.appendChild(div);";
var sources = ['window.location.hash'];
var sinks = ['Function'];

var results = esflow.analyze(code,{sources: sources, sinks: sinks});

assert.equal(results.functionCallPairs.length, 1);
assert.equal(results.functionCallPairs[0].source.name, 'window.location.hash');
assert.equal(results.functionCallPairs[0].sink.name, 'Function');
