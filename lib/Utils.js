var fs = require('fs');
var Utils = {};

Utils.getLine = function(ln, code){
  code = code.split("\n");
  return code[ln-1].toString().trim();
};

module.exports = Utils;