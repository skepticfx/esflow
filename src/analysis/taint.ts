import type {
  Argument,
  BinaryExpression,
  Expression,
  Function as OxcFunction,
  ObjectExpression,
  PrivateInExpression,
} from 'oxc-parser';
import { getNodeName } from '../parser/names.js';
import { FlowVisitor } from './flow-visitor.js';
import { Scope, type ScopeFlowAnalyzer } from './scope.js';

export interface AnalyzeOptions {
  sources: string[];
  sinks: string[];
  specialSinks?: SpecialSink[];
  filters?: string[];
}

export interface SpecialSink {
  name: string;
  argIndexes?: number[];
}

export interface TaintPair {
  source: { name: string; refs: string[] };
  sink: { name: string; refs?: string[] };
  lineNumber: number;
}

interface TaintEntry {
  sourceName: string;
  refs: string[];
}

interface SinkAlias {
  sinkName: string;
  refs: string[];
}

interface SharedAnalyzerState {
  assignmentPairs: TaintPair[];
  functionCallPairs: TaintPair[];
  pairKeys: Set<string>;
  callStack: Set<string>;
}

const COMPARISON_OPERATORS = new Set([
  '==',
  '===',
  '!=',
  '!==',
  '>',
  '>=',
  '<',
  '<=',
  'in',
  'instanceof',
]);

function createLineResolver(code: string): (offset: number) => number {
  const lineOffsets: number[] = [0];
  for (let i = 0; i < code.length; i += 1) {
    if (code[i] === '\n') {
      lineOffsets.push(i + 1);
    }
  }

  return (offset: number): number => {
    let low = 0;
    let high = lineOffsets.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const current = lineOffsets[mid] ?? 0;
      const next = lineOffsets[mid + 1] ?? Number.POSITIVE_INFINITY;
      if (offset >= current && offset < next) {
        return mid + 1;
      }
      if (offset < current) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return lineOffsets.length;
  };
}

function normalizeTaints(taints: TaintEntry[]): TaintEntry[] {
  const byKey = new Map<string, TaintEntry>();
  for (const taint of taints) {
    const key = `${taint.sourceName}::${taint.refs.join('>')}`;
    if (!byKey.has(key)) {
      byKey.set(key, taint);
    }
  }
  return [...byKey.values()];
}

export class FlowAnalyzer implements ScopeFlowAnalyzer {
  private readonly taggedNames = new Map<string, TaintEntry[]>();
  private readonly sinkAliases = new Map<string, SinkAlias>();

  private readonly sourceSet: Set<string>;
  private readonly sinkSet: Set<string>;
  private readonly filterSet: Set<string>;

  public constructor(
    private readonly options: AnalyzeOptions,
    private readonly lineOfOffset: (offset: number) => number,
    private readonly shared: SharedAnalyzerState,
    private readonly parent: FlowAnalyzer | null = null,
  ) {
    this.sourceSet = new Set(options.sources);
    this.sinkSet = new Set(options.sinks);
    this.filterSet = new Set(options.filters ?? []);
  }

  public static createRoot(options: AnalyzeOptions, code: string): FlowAnalyzer {
    return new FlowAnalyzer(options, createLineResolver(code), {
      assignmentPairs: [],
      functionCallPairs: [],
      pairKeys: new Set<string>(),
      callStack: new Set<string>(),
    });
  }

  public createChild(): FlowAnalyzer {
    return new FlowAnalyzer(this.options, this.lineOfOffset, this.shared, this);
  }

  public getAssignmentPairs(): TaintPair[] {
    return this.shared.assignmentPairs;
  }

  public getFunctionCallPairs(): TaintPair[] {
    return this.shared.functionCallPairs;
  }

  public processAssignment(scope: Scope, leftName: string, right: Expression, offset: number): void {
    const taints = this.evaluateExpression(scope, right);

    this.updateSinkAlias(leftName, right);
    this.applyAssignmentTaint(leftName, right, taints);

    if (this.isAssignmentSink(leftName)) {
      for (const taint of taints) {
        this.recordPair('assignment', taint, { name: leftName }, offset);
      }
    }
  }

  public processFunctionCall(scope: Scope, calleeName: string, args: Argument[], offset: number): void {
    const sinkAlias = this.resolveSinkAlias(calleeName);
    const sinkName = this.sinkSet.has(calleeName) ? calleeName : sinkAlias?.sinkName ?? null;
    if (sinkName === null) {
      return;
    }

    const taints = normalizeTaints(
      args.flatMap((argument): TaintEntry[] => {
        if (argument.type === 'SpreadElement') {
          return this.evaluateExpression(scope, argument.argument);
        }

        return this.evaluateExpression(scope, argument);
      }),
    );

    for (const taint of taints) {
      this.recordPair(
        'function',
        taint,
        sinkAlias === null ? { name: sinkName } : { name: sinkName, refs: sinkAlias.refs },
        offset,
      );
    }
  }

  public setTaggedName(name: string, taints: TaintEntry[]): void {
    const normalized = normalizeTaints(taints);
    if (normalized.length === 0) {
      this.taggedNames.delete(name);
      return;
    }

    this.taggedNames.set(name, normalized);
  }

  public evaluateExpression(scope: Scope, expression: Expression): TaintEntry[] {
    switch (expression.type) {
      case 'Identifier':
        return this.resolveSourceOrTagged(expression.name);

      case 'MemberExpression': {
        const fullName = getNodeName(expression);
        const direct = fullName === null ? [] : this.resolveSourceOrTagged(fullName);
        const fromObject = this.evaluateExpression(scope, expression.object);
        const fromProperty = expression.computed ? this.evaluateExpression(scope, expression.property) : [];
        return normalizeTaints([...direct, ...fromObject, ...fromProperty]);
      }

      case 'ParenthesizedExpression':
      case 'TSAsExpression':
      case 'TSSatisfiesExpression':
      case 'TSNonNullExpression':
      case 'TSTypeAssertion':
        return this.evaluateExpression(scope, expression.expression);

      case 'CallExpression':
        return this.evaluateCallExpression(scope, expression.callee, expression.arguments);

      case 'NewExpression':
        return this.evaluateCallExpression(scope, expression.callee, expression.arguments);

      case 'BinaryExpression':
        return this.evaluateBinaryExpression(scope, expression);

      case 'LogicalExpression':
        return normalizeTaints([
          ...this.evaluateExpression(scope, expression.left),
          ...this.evaluateExpression(scope, expression.right),
        ]);

      case 'ConditionalExpression':
        return normalizeTaints([
          ...this.evaluateExpression(scope, expression.consequent),
          ...this.evaluateExpression(scope, expression.alternate),
        ]);

      case 'ArrayExpression':
        return normalizeTaints(
          expression.elements.flatMap((entry): TaintEntry[] => {
            if (entry === null) {
              return [];
            }

            if (entry.type === 'SpreadElement') {
              return this.evaluateExpression(scope, entry.argument);
            }

            return this.evaluateExpression(scope, entry);
          }),
        );

      case 'ObjectExpression':
        return this.evaluateObjectExpression(scope, expression);

      case 'TemplateLiteral':
        return normalizeTaints(expression.expressions.flatMap((item) => this.evaluateExpression(scope, item)));

      case 'UnaryExpression':
      case 'AwaitExpression':
        return this.evaluateExpression(scope, expression.argument);

      case 'SequenceExpression':
        return normalizeTaints(expression.expressions.flatMap((item) => this.evaluateExpression(scope, item)));

      case 'ChainExpression':
        return this.evaluateExpression(scope, expression.expression);

      case 'AssignmentExpression':
        return this.evaluateExpression(scope, expression.right);

      default:
        return [];
    }
  }

  private evaluateObjectExpression(scope: Scope, expression: ObjectExpression): TaintEntry[] {
    return normalizeTaints(
      expression.properties.flatMap((property): TaintEntry[] => {
        if (property.type !== 'Property') {
          return this.evaluateExpression(scope, property.argument);
        }

        if (property.kind !== 'init') {
          return [];
        }

        return this.evaluateExpression(scope, property.value);
      }),
    );
  }

  private evaluateBinaryExpression(scope: Scope, expression: BinaryExpression | PrivateInExpression): TaintEntry[] {
    if (COMPARISON_OPERATORS.has(expression.operator)) {
      return [];
    }

    if (expression.left.type === 'PrivateIdentifier') {
      return this.evaluateExpression(scope, expression.right);
    }

    return normalizeTaints([
      ...this.evaluateExpression(scope, expression.left),
      ...this.evaluateExpression(scope, expression.right),
    ]);
  }

  private evaluateCallExpression(scope: Scope, callee: Expression, args: Argument[]): TaintEntry[] {
    const calleeName = getNodeName(callee);
    if (calleeName !== null && this.filterSet.has(calleeName)) {
      return [];
    }

    if (calleeName === null) {
      return [];
    }

    const declaration = scope.findDeclaration(calleeName);
    if (declaration === null || declaration.body === null) {
      return [];
    }

    return this.evaluateFunctionReturnTaints(scope, declaration, declaration.body, calleeName, args);
  }

  private evaluateFunctionReturnTaints(
    callerScope: Scope,
    declaration: OxcFunction,
    body: NonNullable<OxcFunction['body']>,
    calleeName: string,
    args: Argument[],
  ): TaintEntry[] {
    const stackKey = `${calleeName}:${declaration.start}`;
    if (this.shared.callStack.has(stackKey)) {
      return [];
    }

    this.shared.callStack.add(stackKey);

    try {
      const childAnalyzer = this.createChild();
      const childScope = new Scope(childAnalyzer, callerScope);

      for (let index = 0; index < declaration.params.length; index += 1) {
        const param = declaration.params[index];
        const arg = args[index] ?? null;
        if (param === undefined) {
          continue;
        }
        const paramName = this.extractParameterName(param);
        if (paramName === null || arg === null) {
          continue;
        }

        const argExpression = arg.type === 'SpreadElement' ? arg.argument : arg;
        const taints = this.evaluateExpression(callerScope, argExpression).map((entry) => ({
          sourceName: entry.sourceName,
          refs: [...entry.refs, paramName],
        }));
        childAnalyzer.setTaggedName(paramName, taints);
      }

      const visitor = new FlowVisitor(childScope);
      visitor.visitFunctionBody(body);

      const returnTaints = childScope.returns.flatMap((statement) => {
        if (statement.argument === null) {
          return [];
        }

        return childAnalyzer.evaluateExpression(childScope, statement.argument);
      });

      return normalizeTaints(returnTaints);
    } finally {
      this.shared.callStack.delete(stackKey);
    }
  }

  private resolveSourceOrTagged(name: string): TaintEntry[] {
    if (this.sourceSet.has(name)) {
      return [{ sourceName: name, refs: [] }];
    }

    const tagged = this.taggedNames.get(name);
    if (tagged !== undefined) {
      return tagged;
    }

    if (this.parent !== null) {
      return this.parent.resolveSourceOrTagged(name);
    }

    return [];
  }

  private resolveSinkAlias(name: string): SinkAlias | null {
    const local = this.sinkAliases.get(name);
    if (local !== undefined) {
      return local;
    }

    if (this.parent !== null) {
      return this.parent.resolveSinkAlias(name);
    }

    return null;
  }

  private updateSinkAlias(leftName: string, right: Expression): void {
    const rightName = getNodeName(right);
    if (rightName === null) {
      this.sinkAliases.delete(leftName);
      return;
    }

    if (this.sinkSet.has(rightName)) {
      this.sinkAliases.set(leftName, { sinkName: rightName, refs: [leftName] });
      return;
    }

    const fromAlias = this.resolveSinkAlias(rightName);
    if (fromAlias !== null) {
      this.sinkAliases.set(leftName, {
        sinkName: fromAlias.sinkName,
        refs: [...fromAlias.refs, leftName],
      });
      return;
    }

    this.sinkAliases.delete(leftName);
  }

  private applyAssignmentTaint(leftName: string, right: Expression, taints: TaintEntry[]): void {
    if (right.type === 'ObjectExpression') {
      this.taggedNames.delete(leftName);
      return;
    }

    if (taints.length === 0) {
      this.taggedNames.delete(leftName);
      return;
    }

    const propagated = normalizeTaints(
      taints.map((entry) => ({
        sourceName: entry.sourceName,
        refs: [...entry.refs, leftName],
      })),
    );

    this.taggedNames.set(leftName, propagated);
  }

  private isAssignmentSink(name: string): boolean {
    for (const sink of this.sinkSet) {
      if (sink.startsWith('.') && name.endsWith(sink)) {
        return true;
      }

      if (sink === name) {
        return true;
      }
    }

    return false;
  }

  private extractParameterName(param: OxcFunction['params'][number]): string | null {
    if (param.type === 'Identifier') {
      return param.name;
    }

    if (param.type === 'AssignmentPattern') {
      if (param.left.type === 'Identifier') {
        return param.left.name;
      }
      return null;
    }

    if (param.type === 'RestElement' && param.argument.type === 'Identifier') {
      return param.argument.name;
    }

    return null;
  }

  private recordPair(
    kind: 'assignment' | 'function',
    taint: TaintEntry,
    sink: { name: string; refs?: string[] },
    offset: number,
  ): void {
    const lineNumber = this.lineOfOffset(offset);
    const key = [
      kind,
      taint.sourceName,
      taint.refs.join('>'),
      sink.name,
      (sink.refs ?? []).join('>'),
      String(lineNumber),
    ].join('|');

    if (this.shared.pairKeys.has(key)) {
      return;
    }

    this.shared.pairKeys.add(key);
    const pair: TaintPair = {
      source: { name: taint.sourceName, refs: taint.refs },
      sink,
      lineNumber,
    };

    if (kind === 'assignment') {
      this.shared.assignmentPairs.push(pair);
    } else {
      this.shared.functionCallPairs.push(pair);
    }
  }
}
