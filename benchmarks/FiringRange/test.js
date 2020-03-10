/*
  Tests all FiringRange DOM XSS test cases.
  https://public-firing-range.appspot.com/
*/

var fs = require('fs');

var suites = [
  'address_dom_xss'
];

var puny_star = decodeURI('%E2%98%85');
var puny_tick = decodeURI('%E2%9C%94');

console.log("Running test suites for FiringRange");
suites.forEach(function(suite){
  console.log(' ' + puny_star + ' Testing ' + suite + ' ' + puny_star);
  var suitePath = __dirname + '/' +  suite;
  var tests = fs.readdirSync(suitePath).filter(function(fileName){
    return fileName.split('.').pop() === 'js';
  });
  tests.forEach(function(test){
    var testPath = suitePath + '/' + test;
    require(testPath);
    console.log('     ' +puny_tick + '  '+ test );
  });
});
