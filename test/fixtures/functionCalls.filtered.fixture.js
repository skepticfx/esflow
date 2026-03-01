// All function call based sinks but filtered using 'escape'

// Flows which are function calls (sinks):

// 1
eval(escape(location.href));

//2
var h = escape(location.hash);
eval(h);


//3
var obj = {a: 1, b: escape(document.cookie)};
eval(obj.b);

//4
eval(getLocationHash());
function getLocationHash(){
  return escape(location.hash);
}

//5
var l = getLocationHref();
eval(l);
function getLocationHref(){
  var c = location.href;
  c = escape(c);
  return c;
}

//6 - getLocationHash() is already filtered
function getCleanLocationHash(){
  return getLocationHash();
}
eval(getCleanLocationHash());
