// All assignment test cases
/*
The original test must be populated with the totalTests number to make it works properly.

 */
// 1
document.body.innerHTML = location.href;
//2
var h = location.hash;
document.body.innerHTML = h;


//3
var obj = {a: 1, b: document.cookie};
node.innerHTML = obj.b;

//4
var ca = document.cookie;
var cd = ca[i];
el.innerHTML = cd;

//5
element.innerHTML = getLocationHash();
function getLocationHash(){
  return location.hash;
}

//6
var l = getLocationHref();
element.innerHTML = l;
function getLocationHref(){
  var c = location.href;
  return c;
}

//7
function getCleanLocationHash(){
  return getLocationHash();
}
elt.innerHTML = getCleanLocationHash();


// Negative test cases: These don't result in any DOM XSS.
a.b = document.cookie;
node.innerHTML = a;

document.body.innerHTML = (a == location.href);

var reassignedVariable = location.href;
reassignedVariable = 2;
e.innerHTML = reassignedVariable;
//e.innerHTML = location.href;

// End Negative test cases

