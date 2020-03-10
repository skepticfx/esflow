var expect = require('expect.js');
var esflow = require('../index.js');
var fs = require('fs');

/**
 * These tests are done iteratively over a single result of scanning a JavaScript file.
 * So the order depends up on how ESFlow reports these sources and sinks.
 */

describe('Function calls', function() {
  var testCounter = 0;
  var code = fs.readFileSync('./test/fixtures/functionCalls.fixture.js', 'utf8');
  var results = esflow.analyze(code, {
    sources: ['document.cookie', 'location.href', 'location.hash', 'window.name'],
    sinks: ['.innerHTML', '.outerHTML', '$', 'jQuery', 'eval', 'setTimeout']
  });
  var functionCallPairs = results.functionCallPairs;
  var functionCallPair;

  beforeEach(function () {
    functionCallPair = functionCallPairs[testCounter];
  });

  afterEach(function () {
    testCounter++;
  });

  describe('Flows which are function calls (sinks):', function () {

    it('source is directly assigned to sink', function () {
      expect(functionCallPair.source.name).to.be('location.href');
      expect(functionCallPair.sink.name).to.be('eval');
    });

    it('source is assigned to a sink via another variable', function(){
     expect(functionCallPair.source.name).to.be('location.hash');
     expect(functionCallPair.sink.name).to.be('eval');
    });

    it('source is assigned to a sink via another object property', function(){
      expect(functionCallPair.source.name).to.be('document.cookie');
      expect(functionCallPair.sink.name).to.be('eval');
    });

  });


  describe('Flows which passes through another function calls:', function(){

     it('source is directly returned by a function and assigned to a sink', function(){
       expect(functionCallPair.source.name).to.be('location.hash');
       expect(functionCallPair.sink.name).to.be('eval');
     });

     it('source is assigned to a variable and is returned by a function and finally assigned to a sink', function(){
       expect(functionCallPair.source.name).to.be('location.href');
       expect(functionCallPair.sink.name).to.be('eval');
     });

     it('source is directly returned by a function which indeed comes from another function call and is assigned to a sink', function(){
       expect(functionCallPair.source.name).to.be('location.hash');
       expect(functionCallPair.sink.name).to.be('eval');
     });

  });

  describe('Flows which passes through a re-assigned function call', function(){

    it('simple re-assign', function(){
      expect(functionCallPair.source.name).to.be('location.hash');
      expect(functionCallPair.sink.name).to.be('eval');
    });

    it('re-assigning to an object', function(){
      expect(functionCallPair.source.name).to.be('location.href');
      expect(functionCallPair.sink.name).to.be('eval');
    });


  });

});


describe('Filtered function calls', function() {
  var code = fs.readFileSync('./test/fixtures/functionCalls.filtered.fixture.js', 'utf8');
  var results = esflow.analyze(code, {
    sources: ['document.cookie', 'location.href', 'location.hash', 'window.name'],
    sinks: ['.innerHTML', '.outerHTML', '$', 'jQuery', 'eval', 'setTimeout'],
    filters: ['escape', 'escapeHTML']
  });
  var functionCallPairs = results.functionCallPairs;


  describe('All filtered function calls', function () {
    it('Number of function call paris must be Zero, since all are filtered', function () {
      expect(functionCallPairs.length).to.be(0);
    });

  });

});