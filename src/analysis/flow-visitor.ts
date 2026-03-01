import type {
  Argument,
  BindingPattern,
  Expression,
  ForStatementLeft,
  FunctionBody,
  ObjectExpression,
  ObjectProperty,
  Program,
  Statement,
  VariableDeclarator,
} from 'oxc-parser';
import { getNodeName } from '../parser/names.js';
import { Scope } from './scope.js';

export class FlowVisitor {
  public constructor(private readonly scope: Scope) {}

  public visitProgram(program: Program): void {
    this.collectFunctionDeclarations(program.body);
    for (const item of program.body) {
      this.visitProgramStatement(item);
    }
  }

  public visitFunctionBody(body: FunctionBody): void {
    this.collectFunctionDeclarations(body.body);
    for (const statement of body.body) {
      this.visitProgramStatement(statement);
    }
  }

  private collectFunctionDeclarations(statements: Array<Statement | Program['body'][number]>): void {
    for (const statement of statements) {
      if (statement.type === 'FunctionDeclaration' && statement.id !== null) {
        this.scope.addDeclaration(statement.id.name, statement);
      }
    }
  }

  private visitProgramStatement(statement: Statement | Program['body'][number]): void {
    if (statement.type === 'ExpressionStatement') {
      this.visitExpression(statement.expression);
      return;
    }

    if (statement.type === 'VariableDeclaration') {
      for (const declaration of statement.declarations) {
        this.visitVariableDeclarator(declaration);
      }
      return;
    }

    if (statement.type === 'FunctionDeclaration') {
      return;
    }

    if (statement.type === 'ReturnStatement') {
      this.scope.addReturn(statement);
      if (statement.argument !== null) {
        this.visitExpression(statement.argument);
      }
      return;
    }

    if (statement.type === 'IfStatement') {
      this.visitExpression(statement.test);
      this.visitStatement(statement.consequent);
      if (statement.alternate !== null) {
        this.visitStatement(statement.alternate);
      }
      return;
    }

    if (statement.type === 'BlockStatement') {
      this.collectFunctionDeclarations(statement.body);
      for (const item of statement.body) {
        this.visitStatement(item);
      }
      return;
    }

    if (statement.type === 'ForStatement') {
      if (statement.init !== null) {
        if (statement.init.type === 'VariableDeclaration') {
          for (const declaration of statement.init.declarations) {
            this.visitVariableDeclarator(declaration);
          }
        } else {
          this.visitExpression(statement.init);
        }
      }
      if (statement.test !== null) {
        this.visitExpression(statement.test);
      }
      if (statement.update !== null) {
        this.visitExpression(statement.update);
      }
      this.visitStatement(statement.body);
      return;
    }

    if (statement.type === 'ForInStatement' || statement.type === 'ForOfStatement') {
      this.visitForStatementLeft(statement.left);
      this.visitExpression(statement.right);
      this.visitStatement(statement.body);
      return;
    }

    if (statement.type === 'WhileStatement' || statement.type === 'DoWhileStatement') {
      this.visitExpression(statement.test);
      this.visitStatement(statement.body);
      return;
    }

    if (statement.type === 'SwitchStatement') {
      this.visitExpression(statement.discriminant);
      for (const item of statement.cases) {
        if (item.test !== null) {
          this.visitExpression(item.test);
        }
        this.collectFunctionDeclarations(item.consequent);
        for (const cons of item.consequent) {
          this.visitStatement(cons);
        }
      }
      return;
    }

    if (statement.type === 'TryStatement') {
      this.visitStatement(statement.block);
      if (statement.handler !== null) {
        this.visitStatement(statement.handler.body);
      }
      if (statement.finalizer !== null) {
        this.visitStatement(statement.finalizer);
      }
      return;
    }

    if (statement.type === 'ThrowStatement') {
      this.visitExpression(statement.argument);
      return;
    }

    if (statement.type === 'WithStatement') {
      this.visitExpression(statement.object);
      this.visitStatement(statement.body);
      return;
    }

    if (statement.type === 'LabeledStatement') {
      this.visitStatement(statement.body);
    }
  }

  private visitStatement(statement: Statement): void {
    this.visitProgramStatement(statement);
  }

  private visitVariableDeclarator(declaration: VariableDeclarator): void {
    const name = this.getBindingName(declaration.id);
    if (name === null || declaration.init === null) {
      return;
    }

    this.scope.addAssignment(name, declaration.init);
    this.scope.flowAnalyzer.processAssignment(this.scope, name, declaration.init, declaration.start);

    if (declaration.init.type === 'ObjectExpression') {
      for (const assignment of this.expandObjectAssignments(name, declaration.init)) {
        this.scope.addAssignment(assignment.name, assignment.value);
        this.scope.flowAnalyzer.processAssignment(this.scope, assignment.name, assignment.value, declaration.start);
      }
    }

    this.visitExpression(declaration.init);
  }

  private visitForStatementLeft(left: ForStatementLeft): void {
    if (left.type === 'VariableDeclaration') {
      for (const declaration of left.declarations) {
        this.visitVariableDeclarator(declaration);
      }
      return;
    }

    getNodeName(left);
  }

  private visitExpression(expression: Expression): void {
    if (expression.type === 'AssignmentExpression') {
      if (expression.operator === '=') {
        const leftName = getNodeName(expression.left);
        if (leftName !== null) {
          this.scope.addAssignment(leftName, expression.right);
          this.scope.flowAnalyzer.processAssignment(this.scope, leftName, expression.right, expression.start);
        }
      }

      this.visitExpression(expression.right);
      return;
    }

    if (expression.type === 'CallExpression' || expression.type === 'NewExpression') {
      const calleeName = getNodeName(expression.callee);
      if (calleeName !== null) {
        this.scope.addFunctionCall(calleeName, expression.arguments);
        this.scope.flowAnalyzer.processFunctionCall(this.scope, calleeName, expression.arguments, expression.start);
      }

      this.visitExpression(expression.callee);
      this.visitArguments(expression.arguments);
      return;
    }

    if (expression.type === 'MemberExpression') {
      this.visitExpression(expression.object);
      if (expression.computed) {
        this.visitExpression(expression.property);
      }
      return;
    }

    if (expression.type === 'BinaryExpression' || expression.type === 'LogicalExpression') {
      if (expression.left.type !== 'PrivateIdentifier') {
        this.visitExpression(expression.left);
      }
      this.visitExpression(expression.right);
      return;
    }

    if (expression.type === 'ConditionalExpression') {
      this.visitExpression(expression.test);
      this.visitExpression(expression.consequent);
      this.visitExpression(expression.alternate);
      return;
    }

    if (expression.type === 'SequenceExpression') {
      for (const item of expression.expressions) {
        this.visitExpression(item);
      }
      return;
    }

    if (expression.type === 'ArrayExpression') {
      this.visitArguments(expression.elements.filter((v): v is Argument => v !== null));
      return;
    }

    if (expression.type === 'ObjectExpression') {
      for (const property of expression.properties) {
        if (property.type === 'SpreadElement') {
          this.visitExpression(property.argument);
        } else if (property.kind === 'init') {
          this.visitExpression(property.value);
        }
      }
      return;
    }

    if (expression.type === 'TemplateLiteral') {
      for (const item of expression.expressions) {
        this.visitExpression(item);
      }
      return;
    }

    if (expression.type === 'UnaryExpression' || expression.type === 'AwaitExpression') {
      this.visitExpression(expression.argument);
      return;
    }

    if (
      expression.type === 'TSAsExpression' ||
      expression.type === 'TSSatisfiesExpression' ||
      expression.type === 'TSNonNullExpression' ||
      expression.type === 'TSTypeAssertion' ||
      expression.type === 'ParenthesizedExpression'
    ) {
      this.visitExpression(expression.expression);
      return;
    }

    if (expression.type === 'ChainExpression') {
      this.visitExpression(expression.expression);
    }
  }

  private visitArguments(args: Argument[]): void {
    for (const arg of args) {
      if (arg.type === 'SpreadElement') {
        this.visitExpression(arg.argument);
      } else {
        this.visitExpression(arg);
      }
    }
  }

  private getBindingName(pattern: BindingPattern): string | null {
    if (pattern.type === 'Identifier') {
      return pattern.name;
    }

    if (pattern.type === 'AssignmentPattern') {
      return this.getBindingName(pattern.left);
    }

    return null;
  }

  private expandObjectAssignments(objectName: string, expression: ObjectExpression): Array<{ name: string; value: Expression }> {
    const assignments: Array<{ name: string; value: Expression }> = [];
    for (const property of expression.properties) {
      if (property.type !== 'Property') {
        continue;
      }

      if (property.kind !== 'init') {
        continue;
      }

      const propertyName = this.getObjectPropertyName(property);
      if (propertyName === null) {
        continue;
      }

      assignments.push({ name: `${objectName}.${propertyName}`, value: property.value });
    }

    return assignments;
  }

  private getObjectPropertyName(property: ObjectProperty): string | null {
    if (property.key.type === 'Identifier') {
      return property.key.name;
    }
    if (property.key.type === 'Literal') {
      if (typeof property.key.value === 'string') {
        return property.key.value;
      }
      if (typeof property.key.value === 'number') {
        return String(property.key.value);
      }
    }
    return null;
  }
}
