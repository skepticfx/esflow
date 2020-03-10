# esflow
Elegant, Fast JavaScript static security analyzer for finding issues like DOM XSS.

[ ![Codeship Status for skepticfx/esflow](https://codeship.com/projects/e509fbb0-6c39-0133-d2fc-0e105eb8924a/status?branch=master)](https://codeship.com/projects/115448)

## Installation
Install esflow as a command line tool (might require sudo permission):

`npm install -g esflow`

## Usage
```
   esflow -v                     : Prints the current version
   esflow https://example.com    : Scans for all embedded js code in example.com
   esflow https://example.com -a : Scans for all embedded js code in example.com and all included js files
   esflow ./                     : Scans all the JS files in the current directory
   esflow ./test.js              : Scans a specific JS file
   esflow -h                     : Show this help menu

```
## Analyzing your source code

#### You can scan a website for its JavaScript code like this:
```javascript
$ esflow https://public-firing-range.appspot.com/dom/toxicdom/window/name/innerHtml

```

#### If you want to scan all the script files in the webpage, just add  `-a` at the end.
```
$ esflow http://damnvulnerable.me/domxss/cookie_to_innerhtml -a

```

#### You can also use esflow on a specific file or a directory
`esflow fileName.js`

or

`esflow ./`



## Extending esflow to write your own sources and sinks
```
git clone https://github.com/skepticfx/esflow.git
cd esflow
npm install
```

And then use it like this:

```
var esflow = require('./index.js');

// The code to analyze./bin
var code = require('fs').readFileSync('./inputs/basic.js', 'utf8');

// Define sources and sinks
var sources = ['document.cookie', 'location.href', 'location.hash', 'window.name'];
var sinks = ['.innerHTML', '.outerHTML', '$', 'jQuery', 'eval', 'setTimeout', 'document.write'];
var specialSinks = [{'calleeName': '.setAttribute', 'argumentPosition': 1, 'argumentValue': ['onclick', 'href']}];
var filters = ['escape', 'encodeURI', 'encodeHTML', 'clean'];

var result = esflow.analyze(code, {sources: sources, sinks: sinks, specialSinks: specialSinks}, statusCallback);

console.log(result.assignmentPairs);
console.log(result.functionCallPairs);

function statusCallback(status){
   console.log(status.progress);
}

```

You can try,

`node runner.js fileName.js` to run an analysis on the `./fileName.js` file.

## Testing

```
npm test
```

```
npm run testAll
```

All tests are under `./test/.` Take a look at `./test/assignments.test.js` & `./test/functionCalls.test.js` and their
respective fixtures to get an idea.

## Running benchmarks

```
npm run testFiringRange
```

## Goals

- Find DOM XSS for usual coding patterns.
- Should be easily extensible to any framework like NodeJS, AngularJS, or any X-Library.
- Should have an approach to specify filters like escape(), encodeURIComponent and custom filter functions. In these cases, do not flag as a vulnerable flow. (TODO)
- False positives and negatives are common, we try to focus on coding patterns for given frameworks and focus on improving detection for that.
- Should always complete to end. Do not get stuck in a infinite recursion / stack call, Tail Code Optimize when possible.

## Warning!

Static analyzers are usually dumb and easily miss a valid vulnerability or report an invalid issue as a vulnerability. Its
a island full of false positives and negatives.

Please file an issue when you see any insanely unexpected results and we can work towards fixing that ASAP, if the issue makes sense.


