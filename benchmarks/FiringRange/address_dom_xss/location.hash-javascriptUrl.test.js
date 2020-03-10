// https://public-firing-range.appspot.com/address/location.hash/setTimeout
var assert = require('assert');
var esflow = require('../../../index.js');

var code = "var payload = window.location.hash.substr(1);var a = document.createElement('a'); a.setAttribute('href', payload); document.documentElement.appendChild(a);";
var sources = ['window.location.hash'];
var sinks = [];
var specialSinks = [{'calleeName': '.setAttribute', 'argumentPosition': 1, 'argumentValue': ['onclick', 'href']}];

var results = esflow.analyze(code,{sources: sources, sinks: sinks, specialSinks: specialSinks});

assert.equal(results.functionCallPairs.length, 1);
assert.equal(results.functionCallPairs[0].source.name, 'window.location.hash');
assert.equal(results.functionCallPairs[0].sink.name, 'a.setAttribute');


