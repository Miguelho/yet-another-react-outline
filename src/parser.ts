import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import * as vscode from 'vscode';

// Main function to extract symbols from React document
function getSymbolsFromDocument(
  document: vscode.TextDocument,
  log: vscode.OutputChannel
): vscode.DocumentSymbol[] {
  const code = document.getText();
  const config = vscode.workspace.getConfiguration('reactOutline');

  let ast;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  } catch (error) {
    log.appendLine(`Parse error: ${error}`);
    return [];
  }

  const symbols: vscode.DocumentSymbol[] = [];

  traverse(ast, {
    FunctionDeclaration(path) {
      // Function components
      if (isFunctionComponent(path)) {
        const symbol = createComponentSymbol(path, document, 'function', config, log);
        symbols.push(symbol);
        path.skip();
      }
      // Custom hooks
      else if (isCustomHook(path)) {
        if (config.get('showHooks', true)) {
          const symbol = createHookSymbol(path, document, log);
          symbols.push(symbol);
        }
        path.skip();
      }
    },

    VariableDeclarator(path) {
      if (!path.node.id || path.node.id.type !== 'Identifier') {
        return;
      }

      const name = path.node.id.name;
      const init = path.get('init');

      if (!init.isArrowFunctionExpression() && !init.isFunctionExpression()) {
        return;
      }

      // Arrow function components
      if (/^[A-Z]/.test(name) && hasJSXReturn(init)) {
        const symbol = createComponentSymbol(path, document, 'arrow', config, log);
        symbols.push(symbol);
        path.skip();
      }
      // Arrow function hooks
      else if (/^use[A-Z]/.test(name)) {
        if (config.get('showHooks', true)) {
          const symbol = createHookSymbol(path, document, log);
          symbols.push(symbol);
        }
        path.skip();
      }
    },

    ClassDeclaration(path) {
      if (isClassComponent(path)) {
        const symbol = createComponentSymbol(path, document, 'class', config, log);
        symbols.push(symbol);
        path.skip();
      }
    },
  });

  return symbols;
}

// Check if function declaration is a React component
function isFunctionComponent(path: NodePath<t.FunctionDeclaration>): boolean {
  return !!(path.node.id && /^[A-Z]/.test(path.node.id.name) && hasJSXReturn(path));
}

// Check if class declaration is a React component
function isClassComponent(path: NodePath<t.ClassDeclaration>): boolean {
  if (!path.node.id || !/^[A-Z]/.test(path.node.id.name)) {
    return false;
  }

  const superClass = path.get('superClass');
  if (Array.isArray(superClass)) {
    return false;
  }

  return (
    superClass.matchesPattern('React.Component') ||
    superClass.matchesPattern('React.PureComponent') ||
    superClass.isIdentifier({ name: 'Component' }) ||
    superClass.isIdentifier({ name: 'PureComponent' })
  );
}

// Check if function is a custom hook
function isCustomHook(path: NodePath<t.FunctionDeclaration>): boolean {
  return !!(path.node.id && /^use[A-Z]/.test(path.node.id.name));
}

// Check if a function path contains JSX
function hasJSXReturn(functionPath: NodePath): boolean {
  let hasJSX = false;

  try {
    functionPath.traverse({
      JSXElement() {
        hasJSX = true;
      },
      JSXFragment() {
        hasJSX = true;
      },
    });
  } catch (error) {
    // Ignore traversal errors
  }

  return hasJSX;
}

// Create a DocumentSymbol for a component
function createComponentSymbol(
  path: NodePath,
  document: vscode.TextDocument,
  type: 'function' | 'arrow' | 'class',
  config: vscode.WorkspaceConfiguration,
  log: vscode.OutputChannel
): vscode.DocumentSymbol {
  const name = getComponentName(path);
  const range = astRangeToVsCodeRange(path.node.loc, document);
  const kind = type === 'class' ? vscode.SymbolKind.Class : vscode.SymbolKind.Function;
  const detail = type === 'class' ? 'Class Component' : 'Function Component';

  const symbol = new vscode.DocumentSymbol(name, detail, kind, range, range);

  // Build JSX tree as children
  const maxDepth = config.get<number>('maxJSXDepth', 2);
  buildJSXTree(path, symbol, document, config, maxDepth, log);

  return symbol;
}

// Create a DocumentSymbol for a hook
function createHookSymbol(
  path: NodePath,
  document: vscode.TextDocument,
  log: vscode.OutputChannel
): vscode.DocumentSymbol {
  const name = getComponentName(path);
  const range = astRangeToVsCodeRange(path.node.loc, document);

  return new vscode.DocumentSymbol(name, 'Hook', vscode.SymbolKind.Function, range, range);
}

// Extract component name from path
function getComponentName(path: NodePath): string {
  if (path.isFunctionDeclaration() || path.isClassDeclaration()) {
    const node = path.node as t.FunctionDeclaration | t.ClassDeclaration;
    return node.id?.name || 'Anonymous';
  } else if (path.isVariableDeclarator()) {
    const node = path.node as t.VariableDeclarator;
    if (node.id.type === 'Identifier') {
      return node.id.name;
    }
  }
  return 'Unknown';
}

// Build JSX tree for a component
function buildJSXTree(
  componentPath: NodePath,
  parentSymbol: vscode.DocumentSymbol,
  document: vscode.TextDocument,
  config: vscode.WorkspaceConfiguration,
  maxDepth: number,
  log: vscode.OutputChannel
): void {
  const bodyPath = getFunctionBody(componentPath);
  if (!bodyPath) {
    return;
  }

  const showFragments = config.get<boolean>('showFragments', true);
  const processedPaths = new Set<NodePath>();

  try {
    bodyPath.traverse({
      JSXElement(jsxPath) {
        // Only process if not already processed and is top-level in component
        if (!processedPaths.has(jsxPath) && isTopLevelJSX(jsxPath, bodyPath)) {
          processedPaths.add(jsxPath);
          addJSXSymbol(jsxPath, parentSymbol, document, 0, maxDepth, showFragments, log);
        }
      },
      JSXFragment(jsxPath) {
        if (!processedPaths.has(jsxPath) && isTopLevelJSX(jsxPath, bodyPath)) {
          processedPaths.add(jsxPath);
          if (showFragments) {
            addJSXSymbol(jsxPath, parentSymbol, document, 0, maxDepth, showFragments, log);
          } else {
            // Process fragment children directly
            processFragmentChildren(jsxPath, parentSymbol, document, 0, maxDepth, showFragments, log);
          }
        }
      },
    });
  } catch (error) {
    log.appendLine(`Error building JSX tree: ${error}`);
  }
}

// Check if JSX element is top-level in the component (not nested in another JSX)
function isTopLevelJSX(jsxPath: NodePath, bodyPath: NodePath): boolean {
  let current = jsxPath.parentPath;
  while (current && current !== bodyPath) {
    if (current.isJSXElement() || current.isJSXFragment()) {
      return false;
    }
    current = current.parentPath;
  }
  return true;
}

// Add a JSX symbol to the tree
function addJSXSymbol(
  jsxPath: NodePath,
  parentSymbol: vscode.DocumentSymbol,
  document: vscode.TextDocument,
  currentDepth: number,
  maxDepth: number,
  showFragments: boolean,
  log: vscode.OutputChannel
): void {
  if (currentDepth >= maxDepth) {
    return;
  }

  const tagName = getJSXTagName(jsxPath.node);
  const range = astRangeToVsCodeRange(jsxPath.node.loc, document);

  const jsxSymbol = new vscode.DocumentSymbol(
    tagName,
    '',
    getJSXSymbolKind(tagName),
    range,
    range
  );

  parentSymbol.children.push(jsxSymbol);

  // Process children recursively
  const children = getJSXChildren(jsxPath.node);

  for (const child of children) {
    if (child.type === 'JSXElement' || child.type === 'JSXFragment') {
      const childPath = findChildPath(jsxPath, child);
      if (childPath) {
        if (child.type === 'JSXFragment' && !showFragments) {
          processFragmentChildren(childPath as NodePath, jsxSymbol, document, currentDepth + 1, maxDepth, showFragments, log);
        } else {
          addJSXSymbol(childPath as NodePath, jsxSymbol, document, currentDepth + 1, maxDepth, showFragments, log);
        }
      }
    } else if (child.type === 'JSXExpressionContainer') {
      processJSXExpression(child, jsxSymbol, document, currentDepth + 1, maxDepth, showFragments, log, jsxPath);
    }
  }
}

// Process fragment children without showing the fragment itself
function processFragmentChildren(
  fragmentPath: NodePath,
  parentSymbol: vscode.DocumentSymbol,
  document: vscode.TextDocument,
  currentDepth: number,
  maxDepth: number,
  showFragments: boolean,
  log: vscode.OutputChannel
): void {
  const children = getJSXChildren(fragmentPath.node);

  for (const child of children) {
    if (child.type === 'JSXElement') {
      const childPath = findChildPath(fragmentPath, child);
      if (childPath) {
        addJSXSymbol(childPath as NodePath, parentSymbol, document, currentDepth, maxDepth, showFragments, log);
      }
    } else if (child.type === 'JSXFragment') {
      const childPath = findChildPath(fragmentPath, child);
      if (childPath) {
        processFragmentChildren(childPath as NodePath, parentSymbol, document, currentDepth, maxDepth, showFragments, log);
      }
    } else if (child.type === 'JSXExpressionContainer') {
      processJSXExpression(child, parentSymbol, document, currentDepth, maxDepth, showFragments, log, fragmentPath);
    }
  }
}

// Process JSX expressions (conditionals, map, etc.)
function processJSXExpression(
  expression: t.JSXExpressionContainer,
  parentSymbol: vscode.DocumentSymbol,
  document: vscode.TextDocument,
  currentDepth: number,
  maxDepth: number,
  showFragments: boolean,
  log: vscode.OutputChannel,
  parentPath: NodePath
): void {
  if (currentDepth >= maxDepth) {
    return;
  }

  const expr = expression.expression;
  if (expr.type === 'JSXEmptyExpression') {
    return;
  }

  // Handle: {condition && <Element>}
  if (expr.type === 'LogicalExpression') {
    if (expr.right.type === 'JSXElement' || expr.right.type === 'JSXFragment') {
      const rightPath = findExpressionPath(parentPath, expr.right);
      if (rightPath) {
        addJSXSymbol(rightPath as NodePath, parentSymbol, document, currentDepth, maxDepth, showFragments, log);
      }
    }
  }
  // Handle: {condition ? <A> : <B>}
  else if (expr.type === 'ConditionalExpression') {
    if (expr.consequent.type === 'JSXElement' || expr.consequent.type === 'JSXFragment') {
      const consequentPath = findExpressionPath(parentPath, expr.consequent);
      if (consequentPath) {
        addJSXSymbol(consequentPath as NodePath, parentSymbol, document, currentDepth, maxDepth, showFragments, log);
      }
    }
    if (expr.alternate.type === 'JSXElement' || expr.alternate.type === 'JSXFragment') {
      const alternatePath = findExpressionPath(parentPath, expr.alternate);
      if (alternatePath) {
        addJSXSymbol(alternatePath as NodePath, parentSymbol, document, currentDepth, maxDepth, showFragments, log);
      }
    }
  }
  // Handle: {items.map(item => <Item />)}
  else if (expr.type === 'CallExpression') {
    traverseCallExpressionForJSX(expr, parentSymbol, document, currentDepth, maxDepth, showFragments, log, parentPath);
  }
}

// Traverse call expressions to find JSX in callbacks
function traverseCallExpressionForJSX(
  callExpr: t.CallExpression,
  parentSymbol: vscode.DocumentSymbol,
  document: vscode.TextDocument,
  currentDepth: number,
  maxDepth: number,
  showFragments: boolean,
  log: vscode.OutputChannel,
  parentPath: NodePath
): void {
  for (const arg of callExpr.arguments) {
    if (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression') {
      const body = arg.body;

      // Direct JSX return
      if (body.type === 'JSXElement' || body.type === 'JSXFragment') {
        const bodyPath = findExpressionPath(parentPath, body);
        if (bodyPath) {
          addJSXSymbol(bodyPath as NodePath, parentSymbol, document, currentDepth, maxDepth, showFragments, log);
        }
      }
      // Block statement with return
      else if (body.type === 'BlockStatement') {
        for (const statement of body.body) {
          if (statement.type === 'ReturnStatement' && statement.argument) {
            if (statement.argument.type === 'JSXElement' || statement.argument.type === 'JSXFragment') {
              const argPath = findExpressionPath(parentPath, statement.argument);
              if (argPath) {
                addJSXSymbol(argPath as NodePath, parentSymbol, document, currentDepth, maxDepth, showFragments, log);
              }
            }
          }
        }
      }
    }
  }
}

// Find a child path within a parent path
function findChildPath(parentPath: NodePath, childNode: t.Node): NodePath | null {
  let found: NodePath | null = null;

  try {
    parentPath.traverse({
      enter(path) {
        if (path.node === childNode) {
          found = path;
          path.stop();
        }
      },
    });
  } catch (error) {
    // Ignore traversal errors
  }

  return found;
}

// Find expression path within parent
function findExpressionPath(parentPath: NodePath, exprNode: t.Node): NodePath | null {
  return findChildPath(parentPath, exprNode);
}

// Get JSX children from a JSX node
function getJSXChildren(node: any): Array<t.JSXElement | t.JSXFragment | t.JSXText | t.JSXExpressionContainer | t.JSXSpreadChild> {
  if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
    return node.children || [];
  }
  return [];
}

// Get JSX tag name
function getJSXTagName(node: any): string {
  if (node.type === 'JSXFragment') {
    return '<Fragment>';
  }

  if (node.type === 'JSXElement') {
    const name = node.openingElement.name;
    if (name.type === 'JSXIdentifier') {
      return name.name;
    } else if (name.type === 'JSXMemberExpression') {
      return formatMemberExpression(name);
    } else if (name.type === 'JSXNamespacedName') {
      return `${name.namespace.name}:${name.name.name}`;
    }
  }

  return 'Unknown';
}

// Format JSX member expression (e.g., React.Fragment)
function formatMemberExpression(expr: t.JSXMemberExpression): string {
  const parts: string[] = [];
  let current: any = expr;

  while (current) {
    if (current.type === 'JSXMemberExpression') {
      if (current.property.type === 'JSXIdentifier') {
        parts.unshift(current.property.name);
      }
      current = current.object;
    } else if (current.type === 'JSXIdentifier') {
      parts.unshift(current.name);
      break;
    } else {
      break;
    }
  }

  return parts.join('.');
}

// Get symbol kind for JSX element
function getJSXSymbolKind(tagName: string): vscode.SymbolKind {
  if (tagName === '<Fragment>') {
    return vscode.SymbolKind.Namespace;
  }

  // React components (PascalCase)
  if (/^[A-Z]/.test(tagName)) {
    return vscode.SymbolKind.Class;
  }

  // HTML elements (lowercase)
  return vscode.SymbolKind.Field;
}

// Get function body from component path
function getFunctionBody(componentPath: NodePath): NodePath | null {
  try {
    if (componentPath.isFunctionDeclaration()) {
      return componentPath.get('body') as NodePath;
    } else if (componentPath.isClassDeclaration()) {
      // Find render method
      const classBody = componentPath.get('body');
      const bodyArray = classBody.get('body');
      const methods = Array.isArray(bodyArray) ? bodyArray : [bodyArray];

      for (const method of methods) {
        if (
          method.isClassMethod() &&
          method.node.key.type === 'Identifier' &&
          method.node.key.name === 'render'
        ) {
          return method.get('body') as NodePath;
        }
      }
    } else if (componentPath.isVariableDeclarator()) {
      const init = componentPath.get('init');
      if (Array.isArray(init)) {
        return null;
      }

      if (init.isArrowFunctionExpression() || init.isFunctionExpression()) {
        const body = init.get('body');
        if (Array.isArray(body)) {
          return null;
        }
        return body as NodePath;
      }
    }
  } catch (error) {
    // Ignore errors
  }

  return null;
}

// Convert Babel AST range to VS Code range
function astRangeToVsCodeRange(
  loc: { start: { line: number; column: number }; end: { line: number; column: number } } | null | undefined,
  document: vscode.TextDocument
): vscode.Range {
  if (!loc) {
    const first = document.positionAt(0);
    return new vscode.Range(first, first);
  }

  const start = new vscode.Position(loc.start.line - 1, loc.start.column);
  const end = new vscode.Position(loc.end.line - 1, loc.end.column);
  return new vscode.Range(start, end);
}

export default getSymbolsFromDocument;
