var expect = require('expect.js');
var esflow = require('../index.js');
var fs = require('fs');

/**
 * These tests are done iteratively over a single result of scanning a JavaScript file.
 * So the order depends up on how ESFlow reports these sources and sinks.
 */

describe('Assignments: ', function(){
  var totalCount = 7;
  var testCounter = 0;
  var code = fs.readFileSync('./test/fixtures/assignments.fixture.js', 'utf8');
  var results = esflow.analyze(code, {
    sources: ['document.cookie', 'location.href', 'location.hash', 'window.name'],
    sinks: ['.innerHTML', '.outerHTML', '$', 'jQuery', 'eval', 'setTimeout']
  });
  var assignmentPairs = results.assignmentPairs;
  var assignmentPair;
  //console.log(results.assignmentPairs);

  beforeEach(function(){
    assignmentPair = assignmentPairs[testCounter];
  });

  afterEach(function(){
    testCounter++;
  });

  describe('Flows which are assignemnts:', function(){

    it('source is directly assigned to sink', function(){
      expect(assignmentPair.source.name).to.be('location.href');
      expect(assignmentPair.sink.name).to.be('document.body.innerHTML');
    });

    it('source is assigned to a sink via another variable', function(){
      expect(assignmentPair.source.name).to.be('location.hash');
      expect(assignmentPair.sink.name).to.be('document.body.innerHTML');
    });

    it('source is assigned to a sink via another object property: Type 1', function(){
      expect(assignmentPair.source.name).to.be('document.cookie');
      expect(assignmentPair.sink.name).to.be('node.innerHTML');
    });

    it('source is assigned to a sink via an array accessor property', function(){
      expect(assignmentPair.source.name).to.be('document.cookie');
      expect(assignmentPair.sink.name).to.be('el.innerHTML');
    });

  });


  describe('Flows which passes through function calls:', function(){

    it('source is directly returned by a function and assigned to a sink', function(){
      expect(assignmentPair.source.name).to.be('location.hash');
      expect(assignmentPair.sink.name).to.be('element.innerHTML');
    });

    it('source is assigned to a variable and is returned by a function and finally assigned to a sink', function(){
      expect(assignmentPair.source.name).to.be('location.href');
      expect(assignmentPair.sink.name).to.be('element.innerHTML');
    });

    it('source is directly returned by a function which indeed comes from another function call and is assigned to a sink', function(){
      expect(assignmentPair.source.name).to.be('location.hash');
      expect(assignmentPair.sink.name).to.be('elt.innerHTML');
    });

  });

  describe('Meta tests to ensure nothing is missed', function(){
    it('Total count must be: ' + totalCount, function(){
      expect(assignmentPairs.length).to.be(totalCount);
      testCounter = -1; // Reset this so the tests run 'totalCount' number of times.
    });
  });

});



describe('Testing basic sources and sinks with "filtered" assignments', function() {
  var code = fs.readFileSync('./test/fixtures/assignments.filtered.fixture.js', 'utf8');
  var results = esflow.analyze(code, {
    sources: ['document.cookie', 'location.href', 'location.hash', 'window.name'],
    sinks: ['.innerHTML', '.outerHTML', '$', 'jQuery', 'eval', 'setTimeout'],
    filters: ['escape', 'encodeHTML']
  });
  var assignmentPairs = results.assignmentPairs;


  describe('All filtered assignments', function () {
    it('Number of assignment paris must be Zero, since all are filtered', function () {
      expect(assignmentPairs.length).to.be(0);
    });

  });

});