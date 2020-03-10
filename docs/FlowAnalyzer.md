## FlowAnalyzer

Initial brushstrokes for analyzing sources to sinks flow.
Given code, source, sink

1. Using `esprima` we generate the Abstract Syntax Tree (AST) for the given JavaScript code


### The flow logic for assignments:

1. When a variable declaration or assignment is encountered, we check whether the RHS is in the given list of 'Sources' and update '_taggedNames' with it.
2. If its not we check whether the RHS is in the list of already existing '_taggedNames' and update the references accordingly.
3. Finally, when a sink is encountered on the LHS, we check whether the RHS is in the list of 'Sources' or a value in '_taggedNames'.



### The flow logic for function calls:

1. When a variable declaration or assignment is encountered, we check whether the RHS is in the given list of 'Sources' and update '_taggedNames' with it.
2. If its not we check whether the RHS is in the list of already existing '_taggedNames' and update the references accordingly.
3. Finally, when a sink is encountered as a function call, we check whether one of the arguments or the callee name itself is in the list of 'Sources' or a value in '_taggedNames'.
