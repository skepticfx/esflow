// https://public-firing-range.appspot.com/address/location/innerHtml
var assert = require('assert');
var esflow = require('../../../index.js');

var code = "var payload = window.location; var div = document.createElement('div'); div.id = 'divEl'; document.documentElement.appendChild(div); var divEl = document.getElementById('divEl'); divEl.innerHTML = payload;";
var sources = ['window.location'];
var sinks = ['.innerHTML'];

var results = esflow.analyze(code,{sources: sources, sinks: sinks});

assert.equal(results.assignmentPairs.length, 1);
assert.equal(results.assignmentPairs[0].source.name, 'window.location');
assert.equal(results.assignmentPairs[0].sink.name, 'divEl.innerHTML');
