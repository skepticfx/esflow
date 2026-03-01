import type {
  AssignmentTarget,
  Expression,
  IdentifierName,
  MemberExpression,
  ObjectProperty,
  PropertyKey,
} from 'oxc-parser';

type NameableNode = Expression | AssignmentTarget | PropertyKey;

function getNameFromMemberExpression(node: MemberExpression): string | null {
  const objectName = getNodeName(node.object);
  if (objectName === null) {
    return null;
  }

  if (!node.computed && node.property.type === 'Identifier') {
    return `${objectName}.${node.property.name}`;
  }

  if (node.computed) {
    const computedName = getNodeName(node.property);
    if (computedName !== null) {
      return `${objectName}[${computedName}]`;
    }
  }

  return null;
}

function getNameFromLiteralPropertyKey(node: PropertyKey): string | null {
  if (node.type === 'Identifier') {
    return node.name;
  }

  if (node.type === 'Literal') {
    if (typeof node.value === 'string') {
      return node.value;
    }
    if (typeof node.value === 'number') {
      return String(node.value);
    }
  }

  return null;
}

export function getPropertyName(property: ObjectProperty): string | null {
  return getNameFromLiteralPropertyKey(property.key);
}

export function getBindingIdentifierName(node: IdentifierName): string {
  return node.name;
}

export function getNodeName(node: NameableNode | null): string | null {
  if (node === null) {
    return null;
  }

  switch (node.type) {
    case 'Identifier':
      return node.name;
    case 'MemberExpression':
      return getNameFromMemberExpression(node);
    case 'ParenthesizedExpression':
      return getNodeName(node.expression);
    case 'ChainExpression':
      return getNodeName(node.expression);
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'TSTypeAssertion':
      return getNodeName(node.expression);
    case 'Literal':
      if (typeof node.value === 'string') {
        return node.value;
      }
      if (typeof node.value === 'number') {
        return String(node.value);
      }
      return null;
    default:
      return null;
  }
}
