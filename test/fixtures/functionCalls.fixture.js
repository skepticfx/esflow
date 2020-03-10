// All function call based sinks

// Flows which are function calls (sinks):

// 1
eval(location.href);

//2
var h = location.hash;
eval(h);


//3
var obj = {a: 1, b: document.cookie};
eval(obj.b);


//4
eval(getLocationHash());
function getLocationHash(){
  return location.hash;
}

//5
var l = getLocationHref();
eval(l);
function getLocationHref(){
  var c = location.href;
  return c;
}

//6
function getCleanLocationHash(){
  return getLocationHash();
}
eval(getCleanLocationHash());

//7 Re-assigned function calls
var e = eval;
e(getLocationHash());

//8 Re-assign via Object
var a={};
a.b = eval;
a.b(getLocationHref());