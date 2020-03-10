// All assignment test cases
/*
This should result in Zero assignmentPairs.
 */
// 1
document.body.innerHTML = escape(location.href);
//2
var h = location.hash;
document.body.innerHTML = escapeHTML(h);


//3
var obj = {a: 1, b: escape(document.cookie)};
node.innerHTML = obj.b;

//4
var ca = document.cookie;
var cd = escapeHTML(ca[i]);
el.innerHTML = cd;

//5
element.innerHTML = getLocationHash();
function getLocationHash(){
  return escapeHTML(location.hash);
}

//6
var l = escape(getLocationHref());
element.innerHTML = l;
function getLocationHref(){
  var c = location.href;
  return c;
}

//7
function getCleanLocationHash(){
  return getLocationHash();
}
elt.innerHTML = escape(getCleanLocationHash());


// Negative test cases: These don't result in any DOM XSS.
a.b = document.cookie;
node.innerHTML = a;

document.body.innerHTML = (a == location.href);

var reassignedVariable = location.href;
reassignedVariable = 2;
e.innerHTML = reassignedVariable;

// End Negative test cases

