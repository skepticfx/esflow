var _ = require('lodash');
var IsNameUsedVisitor = require('./visitors/IsNameUsedVisitor.js');
var LHSVisitor = require('./visitors/LeftHandSideVisitor.js');
var lhsVisitor = new LHSVisitor();


/**
 * FlowAnalyzer -
 * @param scope
 * @constructor
 */
var FlowAnalyzer = function(scope){
  this._scope = scope;
  this._sources = scope._sources || new Error("Sources cannot be empty while initializing FlowAnalyzer");
  this._sinks = scope._sinks || new Error("Sinks cannot be empty while initializing FlowAnalyzer");
  this._specialSinks = scope._specialSinks || []; // Not required by default.
  this._filters = scope._filters|| []; // Not required by default.
  this.initOptions();

  this._declarations = scope._declarations;
  this._code = scope._code;

  this._functionDeclarations = _.pick(this._declarations, function(value){ return value.type === "Function"});
  this._functionCalls = [];
  this._returnStatements = [];
  this._sinkReassignments = {}; // The re-assigned sinks; a=alert, e=eval;

  this._taggedNames = {};

  this.loggedSources = [];
  this.assignmentPairs = [];
  this.functionCallPairs = [];

  this._taggedReturnSource = "";

};


FlowAnalyzer.prototype.isReturnTagged = function(){
  var i;
  for(i=0; i<this._returnStatements.length; i++){
    if(this._returnStatements[i].isTagged === true){
      this._taggedReturnSource = this._returnStatements[i].taggedReturnSource;
      return true;
    }
  }
  return false;
};

FlowAnalyzer.prototype.newReturnStatement = function(statement){
  var isTagged = false;
  var isNameUsedVisitor = new IsNameUsedVisitor();
  statement.argument !== null && _.forIn(this._sources, function(sourceName){
    if(isTagged) return;
    if(isNameUsedVisitor.find(sourceName, statement.argument, this)){
      isTagged = true;
      statement.taggedReturnSource = {name: sourceName, originalSource: sourceName};
    }
  }, this);

  statement.argument !== null && _.forIn(this._taggedNames, function(taggedValue, taggedName){
    if(isTagged) return;
    if(isNameUsedVisitor.find(taggedName, statement.argument, this)){
      isTagged = true;
      if(taggedValue.originalSource === undefined){
        taggedValue.originalSource = this.getOriginalSource(taggedValue, this._taggedNames);
      }
      statement.taggedReturnSource = taggedValue;
    }
  }, this);
  statement.isTagged = isTagged;
  this._returnStatements.push(statement);
};


FlowAnalyzer.prototype.getOptions = function(){
  var o = {};
  o.sources = _.union(this._sources, Object.keys(this._taggedNames));
  o.sinks = this._sinks;
  o.specialSinks = this._specialSinks;
  o.filters = this._filters;

  return o;
};

FlowAnalyzer.prototype.newAssignment = function(assignment){
  // Tag this
  var isNameUsedVisitor = new IsNameUsedVisitor();
  var obj = {}, sink, line;
  obj[assignment.name] = assignment;

  // Check for re-assignments; a=location.href; a=1;
  // If the new assignment is already in the _taggedNames list, remove it if and only if its not a part of the same RHS assignment.
  if(this._taggedNames.hasOwnProperty(assignment.name) && !isNameUsedVisitor.find(assignment.name, assignment.rhs, this)){
    this.removeTags(this._taggedNames, assignment.name);
  }

  // Check if the assignment RHS is a sink Identifier.
  // Simple Sink re-assignments: eg.  var a = alert; e = eval; Only valid for function call based sinks for now.
  if(assignment.rhs.type === 'Identifier' && this._sinks.indexOf(assignment.rhs.name) !== -1){
    //console.log('sink reassign' + assignment.name);
    //this._sinks.push(assignment.name);
    this._sinkReassignments[assignment.name] = assignment.rhs.name;
  }

  this._taggedNames = this.tagFromSources(obj, this._taggedNames);
  this._taggedNames = this.updateTagReferences(obj, this._taggedNames);

  // Check for sinks - Assignment based sinks like- .innerHTML=, $.html=;
  if(this.isSinkAssigned(assignment, this._taggedNames)){
    sink = this._taggedNames[assignment.name];
    line = sink.assignment.loc.start.line;
    // Sink assigned to a valid source
    this.assignmentPairs.push({
      source: {
        name: this.getOriginalSource(sink, this._taggedNames),
        refs: sink.refs
      },
      sink: {
        name: sink.name
      },
      lineNumber: line
    });

    //console.log(sink.name + " assigned with a value on line : " + line  + '- Refs: ' + this.getOriginalSource(sink, this._taggedNames));

  }

};


/**
 * tagFromNames - Updates the references recursively.
 * @param names
 * @param currentTags
 */
FlowAnalyzer.prototype.updateTagReferences = function(list, taggedNames){
  var found, i, j, tagValue, tagName, listValue, listName, taggedNamesKeys, listKeys;
  listKeys = Object.keys(list);
  taggedNamesKeys = Object.keys(taggedNames);
  var isNameUsedVisitor = new IsNameUsedVisitor();

  for(i=0; i<taggedNamesKeys.length; i++){
    found = false;
    tagName = taggedNamesKeys[i];
    tagValue = taggedNames[tagName];
    for(j=0; j<listKeys.length; j++){
      listName = listKeys[j];
      listValue = list[listName];
      if(!found && isNameUsedVisitor.find(tagName, listValue.rhs, this)){
        taggedNames = this.addReference(taggedNames, listName, tagName, listValue.rhs);
        found = true;
      }
    }
  }
  return taggedNames;
};



FlowAnalyzer.prototype.tagFromSources = function(names, currentTags){
  var found;
  if(this.isSameTagAssignment(names, currentTags)){
    return currentTags;
  }
  var isNameUsedVisitor = new IsNameUsedVisitor();
  _.forIn(names, function(value, name){
    if(value.rhs === null)
      return;
    found = false;
    this._sources.forEach(function(source){
      if(found) return;
      if(isNameUsedVisitor.find(source, value.rhs, this)){
        this.tagNamesWithSource(currentTags, name, source, value);
        this.loggedSources.push('   -- Source Assigned : ' + source + ' assigned to '+ name + ' - Line ' +  value.rhs.loc.start.line)
        this.loggedSources = _.uniq(this.loggedSources);
        found = true;
      }
    }, this);
    if(!found){
      this.removeTags(currentTags, name);
    }
  }, this);
  return currentTags;
};


FlowAnalyzer.prototype.newFunctionCall = function(fc){
  // Check whether the callee has any arguments which is a source
  var i, j, taggedKeys, functionName;
  var sinkReassignments = this._sinkReassignments;
  var isNameUsedVisitor = new IsNameUsedVisitor();
  this._functionCalls.push(fc);
  if(this.isASink(fc.name) || this.isASpecialSink(fc) || sinkReassignments.hasOwnProperty(fc.name)){
    // Check given sources list
    functionName = lhsVisitor.getName(fc);
    for(i=0; i<fc.args.length; i++){
      for(j=0; j<this._sources.length; j++){
        if(isNameUsedVisitor.find(this._sources[j], fc.args[i], this)){
          // Sink Called using a valid source
          this.functionCallPairs.push({
            source: {
              name: this._sources[j],
              refs: []
            },
            sink: {
              name: sinkReassignments[functionName] || functionName,
              refs: sinkReassignments[functionName]?[functionName] : []
            },
            lineNumber: fc.loc.start.line

          });
          //console.log(fc.name + " called with a source value from: " + this._sources[j]);
          return;
        }
      }
    }


    // Check existing references
    taggedKeys = Object.keys(this._taggedNames);
    for(i=0; i<fc.args.length; i++){
      for(j=0; j<taggedKeys.length; j++){
        if(isNameUsedVisitor.find(taggedKeys[j], fc.args[i], this)){
          // Sink Called using a tagged source
          var s = this._taggedNames[taggedKeys[j]];
          this.functionCallPairs.push({
            source: {
              name: this.getOriginalSource(s, this._taggedNames),
              refs: s.refs
            },
            sink: {
              name: sinkReassignments[functionName] || functionName,
              refs: sinkReassignments[functionName]?[functionName] : []
            },
            lineNumber: fc.loc.start.line

        });
          //console.log(fc.name + " called with a source value from: " + taggedKeys[j]);
          return;
        }
      }
    }
  }
};



FlowAnalyzer.prototype.isSinkAssigned = function(assignment, taggedNames){
  var taggedSink;
  if(this.isASink(assignment.name)) {
    taggedSink = taggedNames[assignment.name];
    if(typeof taggedSink !== 'undefined'){
      return true;
    }
  }
  return false;
};

FlowAnalyzer.prototype.isASink = function(name){
  var i, sinks = this._sinks;
  for(i=0; i<sinks.length; i++){
    if(_.endsWith(name, sinks[i])){
      return true;
    }
  }
  return false;
};

FlowAnalyzer.prototype.isASpecialSink = function(fc){
  var i, sinks = this._specialSinks;
  var isNameUsedVisitor = new IsNameUsedVisitor();
  for(i=0; i<sinks.length; i++){
    if(_.endsWith(fc.name, sinks[i]['calleeName']) && isNameUsedVisitor.find(sinks[i]['argumentValue'], fc.args[sinks[i]['argumentPosition']], this._flowAnalyzer)){
      return true;
    }
  }
  return false;
};




FlowAnalyzer.prototype.tagNamesWithSource = function(currentTags, name, source, value){
  if(typeof currentTags[name] === 'undefined'){
    currentTags[name] = {};
    currentTags[name].name = name;
    currentTags[name].originalSource = source;
    currentTags[name].assignment = value;
    currentTags[name].refs = [];
  } else {
    currentTags[name].name = name;
    currentTags[name].refs = currentTags[name].refs.push(source);
    currentTags[name].refs = _.uniq(currentTags[name].refs);
  }

};

FlowAnalyzer.prototype.removeTags = function(currentTags, name){
  if(currentTags.hasOwnProperty(name))
    delete currentTags[name];
};

FlowAnalyzer.prototype.addReference = function(currentTags, name, ref, assignment){

  if(typeof currentTags[name] === 'undefined'){
    currentTags[name] = {};
    currentTags[name].name = name;
    currentTags[name].assignment = assignment;
    currentTags[name].refs = [];
    currentTags[name].originalSource = currentTags[ref].originalSource;
  }
  currentTags[name].refs.push(ref);
  currentTags[name].refs = _.uniq(currentTags[name].refs);

  return currentTags;
};


FlowAnalyzer.prototype.getOriginalSource = function(tag, taggedNames){
  if(typeof tag.originalSource !== 'undefined')
    return tag.originalSource;

  return this.getOriginalSource(taggedNames[tag.refs[0]], taggedNames);
};

FlowAnalyzer.prototype.isSameTagAssignment = function(assignment, taggedNames) {
  assignment = assignment[Object.keys(assignment)];
  return (Object.keys(taggedNames).indexOf(assignment.name) !== -1);
};


FlowAnalyzer.prototype.initOptions = function(){
  var specialSinks = [];
  this._sources = this._sources.filter(function(s){ return s.toString().length>0; });
  this._sinks = this._sinks.filter(function(s){ return s.toString().length>0; });
  this._filters = this._filters.filter(function(s){ return s.toString().length>0; });

  // Special Sinks
  this._specialSinks.forEach(function(sink){
    if(sink['argumentPosition'] <= 0) sink['argumentPosition'] = 1;
    if(sink['argumentValue'] instanceof Array){
      sink['argumentValue'].forEach(function(argValue){
        // argumentPosition is the array index in the func.args.
        specialSinks.push({'calleeName': sink['calleeName'], 'argumentPosition': sink['argumentPosition']-1, 'argumentValue': argValue});
      });
    } else {
      specialSinks.push({'calleeName': sink['calleeName'], 'argumentPosition': sink['argumentPosition']-1, 'argumentValue': sink['argumentValue']});
    }
  });
  this._specialSinks = specialSinks;
};

module.exports = FlowAnalyzer;


