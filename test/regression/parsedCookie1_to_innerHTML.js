var expect = require('expect.js');
var assert = require('assert');
var esflow = require('../../index.js');

var code = ' var rawNavData = readCookie("s-data"); \
  var parsedNavData = JSON.parse(rawNavData); \
  var usernameLink = document.getElementById("a-username-link"); \
  usernameLink.innerHTML = parsedNavData.username; \
  function readCookie(name) { \
    var nameEQ = name + "="; \
    var ca = document.cookie.split(";"); \
    for (var i = 0; i < ca.length; i++) { \
      var c = ca[i]; \
      while (c.charAt(0) == " ") c = c.substring(1, c.length); \
      if (c.indexOf(nameEQ) == 0) return c; \
    } \
    return null; \
  }';


describe('Regression', function(){
  it('Parsed cookie to innerHTML - 1', function(){
    var results = esflow.analyze(code, {
      sources: ['document.cookie', 'location.href', 'location.hash', 'window.name'],
      sinks: ['.innerHTML', '.outerHTML', '$', 'jQuery', 'eval', 'setTimeout']
    });
    var assignmentPairs = results.assignmentPairs;
    assert.equal(assignmentPairs.length, 1);
    assert.equal(assignmentPairs[0].source.name, 'document.cookie');
    assert.equal(assignmentPairs[0].sink.name, 'usernameLink.innerHTML');
  });
});
