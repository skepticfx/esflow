import type { Argument, Expression, Function as OxcFunction, ReturnStatement } from 'oxc-parser';

export interface AssignmentRecord {
  name: string;
  value: Expression;
}

export interface FunctionCallRecord {
  name: string;
  args: Argument[];
}

export interface ScopeFlowAnalyzer {
  processAssignment(scope: Scope, leftName: string, right: Expression, offset: number): void;
  processFunctionCall(scope: Scope, calleeName: string, args: Argument[], offset: number): void;
}

export class Scope {
  public readonly declarations = new Map<string, OxcFunction>();
  public readonly assignments: AssignmentRecord[] = [];
  public readonly functionCalls: FunctionCallRecord[] = [];
  public readonly returns: ReturnStatement[] = [];

  public constructor(
    public readonly flowAnalyzer: ScopeFlowAnalyzer,
    public readonly parent: Scope | null = null,
  ) {}

  public addDeclaration(name: string, declaration: OxcFunction): void {
    this.declarations.set(name, declaration);
  }

  public findDeclaration(name: string): OxcFunction | null {
    const local = this.declarations.get(name);
    if (local !== undefined) {
      return local;
    }

    if (this.parent !== null) {
      return this.parent.findDeclaration(name);
    }

    return null;
  }

  public addAssignment(name: string, value: Expression): void {
    this.assignments.push({ name, value });
  }

  public addFunctionCall(name: string, args: Argument[]): void {
    this.functionCalls.push({ name, args });
  }

  public addReturn(node: ReturnStatement): void {
    this.returns.push(node);
  }
}
