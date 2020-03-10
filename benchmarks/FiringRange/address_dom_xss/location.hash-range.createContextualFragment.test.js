// https://public-firing-range.appspot.com/address/location.hash/rangeCreateContextualFragment
var assert = require('assert');
var esflow = require('../../../index.js');

var code = "var payload = window.location.hash.substr(1);var div = document.createElement('div'); div.id = 'divEl'; document.documentElement.appendChild(div); var range = document.createRange(); range.selectNode(document.getElementsByTagName('div').item(0)); var documentFragment = range.createContextualFragment(payload); document.body.appendChild(documentFragment);";
var sources = ['window.location.hash'];
var sinks = ['createContextualFragment'];

var results = esflow.analyze(code,{sources: sources, sinks: sinks});

assert.equal(results.functionCallPairs.length, 1);
assert.equal(results.functionCallPairs[0].source.name, 'window.location.hash');
assert.equal(results.functionCallPairs[0].sink.name, 'range.createContextualFragment');
