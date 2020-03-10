#!/usr/bin/env node
var argv = require('minimist')(process.argv.slice(2));
var path = require('path');
var esflow = require('../index.js');
var scrape = require('../lib/utils/scrape.js');
var isStandardLibrary = require('../lib/utils/isStandardLibrary.js');
var fs = require('fs');
var code, url, fileStats;
var recurse = argv['a'] || argv['all'] || false;
var startTime = new Date();
var log = function(){};
var doNotLogScanTime = false;

if(argv['v']){
  printVersion();
  process.exit(0);
}

if(argv['h'] || argv['help']){
  printHelp();
  process.exit();
}

if(argv['log'] || argv['l']){
  log = function(message){ console.log(message);}
}

if(argv['_'].length > 0){
  url = argv['_'][0];
  if(url.startsWith('http://') || url.startsWith('https://')){
    scrape.getJsCode(url, analyzeCode, recurse);
  } else {
    fileStats = fs.statSync(url);
    if(fileStats.isDirectory()){
      codes = fs.readdirSync(url)
        .filter(function(file){
          file = path.join(url, file);
          return file.split('.').pop() === 'js' && fs.statSync(file).isFile();
        })
        .map(function(jsFile){
          jsFile = path.join(url, jsFile);
          return {name: jsFile, file: fs.readFileSync(jsFile, 'utf8')};
        });
    }
    if(fileStats.isFile()){
      codes = [{name: url, file: fs.readFileSync(url, 'utf8')}];
    }
    analyzeCode(codes);
  }
}else{
  printHelp();
  process.exit();
}

function analyzeCode(codes) {

  var sources = ['document.cookie', 'location.href', 'location.hash', 'window.name', 'location', 'XMLHttpRequest'];
  var sinks = ['.innerHTML', '.outerHTML', '$', 'jQuery', 'eval', 'setTimeout', 'document.write', 'location'];
  var res;

  codes.forEach(function (code) {
    console.log('Analyzing ' + code.name + ' . . .');
    if(code.file.length==0) {
      console.log('No JS Code found on ' + url);
    }

    try{
      if(!argv['f'] && isStandardLibrary(code.file)){
        console.log('The file ' + code.name + ' seems to be a standard library. Skipping analysis for that.');
        return;
      }
      res = esflow.analyze(code.file, {sources: sources, sinks: sinks});
    } catch(e){
      switch(e.description){
        case 'Unexpected token ILLEGAL':
          log('Stopped scanning ' + code.name + ' due to some syntax error.');
          return;
        default:
          log('An exception occured while analyzing the code on ' + code.name);
          log(e.stack);
          return;
      }
    }
    if (res.assignmentPairs.length > 0 || res.functionCallPairs.length > 0 || res.loggedSources.length > 0) {
      console.log('');
      console.log(code.name + ' ...');
    }
    if (res.loggedSources.length > 0) {
      res.loggedSources.forEach(function (s) {
        console.log(s);
      });
    }

    if (res.assignmentPairs.length > 0 || res.functionCallPairs.length > 0) {
      console.log('----------------- Found issues --------------------');
      res.assignmentPairs.forEach(function (p) {
        console.log('   !! Possible DOM XSS !! : ' + p.source.name + ' assigned to ' + p.sink.name + ' - Line ' + p.lineNumber);
      });
      res.functionCallPairs.forEach(function (p) {
        console.log('   !! Possible DOM XSS !! : ' + p.source.name + ' assigned to ' + p.sink.name + '() - Line ' + p.lineNumber);
      });
    }
  });
}


process.on('exit', function(){
  doNotLogScanTime && console.warn('Scan completed in ' + (new Date() - startTime)/1000 + ' seconds');
});


function printHelp(){
  doNotLogScanTime = true;
  printVersion();
  console.log(' ');
  console.log(' Usage: ');
  console.log('   esflow -v                     : Prints the current version');
  console.log('   esflow https://example.com    : Scans for all embedded js code in example.com');
  console.log('   esflow https://example.com -a : Scans for all embedded js code in example.com and all included js files');
  console.log('   esflow ./                     : Scans all the JS files in the current directory');
  console.log('   esflow ./test.js              : Scans a specific JS file');
  console.log('   esflow -f                     : Force analysis on standard libraries as well');
  console.log('   esflow -l                     : Log all errors and stack traces from esflow');
  console.log('   esflow -h                     : Show this help menu');

}

function printVersion(){
  doNotLogScanTime = true;
  console.log('Version: ' + require('../package.json').version);
}