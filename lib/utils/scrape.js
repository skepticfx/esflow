var ineed = require('ineed');
var request = require('request');

exports.getJsCode = function(url, analyze, recurse){
  if(url.endsWith('.js')){
    request(url, function(err, res){
      var jsCode = res.body.trim();
      analyze([{name: url, file: jsCode}]);
    });
  } else {
    ineed.collect.jsCode.scripts.from(url, function(err, response, result){
      if(err) {
        console.log('Error connecting to ' + url);
        console.log(err.reason);
        return;
      }
      var jsCode = result.jsCode;
      jsCode = jsCode.join('').trim();
      analyze([{name: url, file: jsCode}]);
      // Iterate through all scripts and analyze them one by one.
      recurse && result.scripts.forEach(function(scriptUrl){
        request(scriptUrl, function(err, res){
          if(!err)
          analyze([{name: scriptUrl, file: res.body}]);
        });
      });

    });
  }
};
