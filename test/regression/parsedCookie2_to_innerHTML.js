var expect = require('expect.js');
var assert = require('assert');
var esflow = require('../../index.js');

var code = ' function lookupCookie(name) { \
  var parts = document.cookie.split(/\s*;\s*/); \
  var nameEq = name + "="; \
  for (var i = 0; i < parts.length; i++) { \
    if (parts[i].indexOf(nameEq) == 0) { \
      return parts[i].substr(nameEq.length); \
    } \
  } \
  }; \
  var payload = lookupCookie("ThisCookieIsTotallyRandomAndCantPossiblyBeSet"); \
  var div = document.createElement("div"); \
  div.id = "divEl"; \
  document.documentElement.appendChild(div); \
  var divEl = document.getElementById("divEl"); \
  divEl.innerHTML = payload; \
  function trigger(payload) { \
    divEl.innerHTML = payload; \
  };';


describe('Regression', function(){
  it('Parsed cookie to innerHTML - 2', function(){
    var results = esflow.analyze(code, {
      sources: ['document.cookie', 'location.href', 'location.hash', 'window.name'],
      sinks: ['.innerHTML', '.outerHTML', '$', 'jQuery', 'eval', 'setTimeout']
    });
    var assignmentPairs = results.assignmentPairs;
    assert.equal(assignmentPairs.length, 2);
    assert.equal(assignmentPairs[0].source.name, 'document.cookie');
    assert.equal(assignmentPairs[0].sink.name, 'divEl.innerHTML');
    assert.equal(assignmentPairs[1].source.name, 'document.cookie');
    assert.equal(assignmentPairs[1].sink.name, 'divEl.innerHTML');
  });
});


