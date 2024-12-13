import * as vscode from "vscode";
import { parse } from "@typescript-eslint/typescript-estree";

export function activate(context: vscode.ExtensionContext) {
  const diagnostics = vscode.languages.createDiagnosticCollection("convertAny");
  context.subscriptions.push(diagnostics);

  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    "typescript",
    new AnyToTypeProvider(diagnostics),
    {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
    }
  );

  const command = vscode.commands.registerCommand(
    "convertAnyToSpecificType",
    async (args) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const { range } = args;
      const document = editor.document;
      const sourceCode = document.getText();

      const inferredType = inferTypeUsingEstree(sourceCode, range);
      if (inferredType) {
        await editor.edit((editBuilder) => {
          editBuilder.replace(range, inferredType);
        });
      } else {
        vscode.window.showErrorMessage(
          "Failed to infer a specific type for 'any'."
        );
      }
    }
  );

  vscode.workspace.onDidOpenTextDocument((document) => {
    if (document.languageId === "typescript") {
      updateDiagnostics(document, diagnostics);
    }
  });

  vscode.workspace.onDidSaveTextDocument((document) => {
    if (document.languageId === "typescript") {
      updateDiagnostics(document, diagnostics);
    }
  });

  context.subscriptions.push(codeActionProvider, command);

  // Run embedded tests
  runEmbeddedTests();
}

class AnyToTypeProvider implements vscode.CodeActionProvider {
  constructor(private diagnostics: vscode.DiagnosticCollection) {}

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] | undefined {
    const diagnostic = context.diagnostics.find((d) =>
      d.message.includes("any")
    );

    if (!diagnostic) return;

    const fix = new vscode.CodeAction(
      "Convert 'any' to specific type",
      vscode.CodeActionKind.QuickFix
    );

    fix.command = {
      command: "convertAnyToSpecificType",
      title: "Convert 'any'",
      arguments: [{ document, range }],
    };

    return [fix];
  }
}

function updateDiagnostics(
  document: vscode.TextDocument,
  diagnostics: vscode.DiagnosticCollection
) {
  const text = document.getText();
  const regex = /\bany\b/g;

  const diagnosticArray: vscode.Diagnostic[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const startPos = document.positionAt(match.index);
    const endPos = document.positionAt(match.index + match[0].length);
    const range = new vscode.Range(startPos, endPos);

    const diagnostic = new vscode.Diagnostic(
      range,
      "Found 'any', consider converting it to a specific type.",
      vscode.DiagnosticSeverity.Warning
    );
    diagnosticArray.push(diagnostic);
  }

  diagnostics.set(document.uri, diagnosticArray);
}

function attachParentReferences(
  node: any,
  parent: any = null,
  visited: WeakSet<any> = new WeakSet()
) {
  if (!node || typeof node !== "object" || visited.has(node)) {
    return; // Skip null, non-object nodes, or already visited nodes
  }

  visited.add(node); // Mark node as visited
  node.parent = parent;

  for (const key in node) {
    if (Object.prototype.hasOwnProperty.call(node, key)) {
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach((subChild) =>
          attachParentReferences(subChild, node, visited)
        );
      } else if (typeof child === "object" && child !== null) {
        attachParentReferences(child, node, visited);
      }
    }
  }
}

function inferTypeUsingEstree(sourceCode: string, range: vscode.Range): string {
  try {
    const ast = parse(sourceCode, { loc: true });
    console.log("[DEBUG] AST parsed successfully.");
    attachParentReferences(ast); // Attach parent references to ensure traversal works.
    console.log("[DEBUG] Parent references attached to AST.");

    const node = findNodeInRange(ast, range);
    if (node) {
      console.log(`[DEBUG] Found node type: ${node.type}`);
      return inferTypeFromNode(node);
    }
  } catch (error) {
    console.error("[ERROR] Failed to parse TypeScript source:", error);
  }
  return "unknown";
}

function findNodeInRange(node: any, range: vscode.Range): any {
  if (!node || !node.loc) return null;

  const { start, end } = node.loc;
  const isWithinRange =
    range.start.line + 1 >= start.line &&
    range.start.line + 1 <= end.line &&
    range.start.character >= start.column &&
    range.end.character <= end.column;

  if (isWithinRange) return node;

  for (const key in node) {
    if (Object.prototype.hasOwnProperty.call(node, key)) {
      const child = node[key];
      if (Array.isArray(child)) {
        for (const subChild of child) {
          const result = findNodeInRange(subChild, range);
          if (result) return result;
        }
      } else if (typeof child === "object" && child !== null) {
        const result = findNodeInRange(child, range);
        if (result) return result;
      }
    }
  }

  return null;
}

function inferTypeFromNode(node: any): string {
  if (!node) {
    return "unknown";
  }

  switch (node.type) {
    case "VariableDeclaration":
      console.log("[DEBUG] Handling VariableDeclaration node.");
      return node.declarations
        .map((declarator: any) => inferTypeFromNode(declarator.init))
        .join(" | "); // Join types for multiple declarators.

    case "VariableDeclarator":
      console.log("[DEBUG] Handling VariableDeclarator node.");
      return inferTypeFromNode(node.init);

    case "Literal":
      if (typeof node.value === "string") return "string";
      if (typeof node.value === "number") return "number";
      if (typeof node.value === "boolean") return "boolean";
      break;

    case "ArrayExpression":
      const elementTypes = new Set(
        node.elements.map((el: any) => inferTypeFromNode(el))
      );
      return elementTypes.size === 1
        ? `${[...elementTypes][0]}[]`
        : `Array<${[...elementTypes].join(" | ")}>`;

    case "ObjectExpression":
      const properties = node.properties.map((prop: any) => {
        const key = prop.key.name || prop.key.value;
        const valueType = inferTypeFromNode(prop.value);
        return `${key}: ${valueType}`;
      });
      return `{ ${properties.join("; ")} }`;

    case "ArrowFunctionExpression":
      console.log("[DEBUG] Handling ArrowFunctionExpression node.");
      const params = node.params.map(() => "unknown").join(", ");
      const returnType = inferTypeFromNode(node.body);
      return `(${params}) => ${returnType}`;

    case "BinaryExpression":
      const leftType = inferTypeFromNode(node.left);
      const rightType = inferTypeFromNode(node.right);
      return leftType === rightType ? leftType : "unknown";

    case "ConditionalExpression":
      const consequentType = inferTypeFromNode(node.consequent);
      const alternateType = inferTypeFromNode(node.alternate);
      return `${consequentType} | ${alternateType}`;

    case "CallExpression":
      if (node.callee.name === "getElementById") return "HTMLElement | null";
      break;

    default:
      console.log(`[DEBUG] Unhandled node type: ${node.type}`);
      break;
  }

  return "unknown";
}

function runEmbeddedTests() {
  const testCases = [
    { code: `let example: any = "This is a string";`, expectedType: "string" },
    { code: `let anotherExample: any = [1, 2, 3];`, expectedType: "number[]" },
    {
      code: `let obj: any = { name: "John", age: 30 };`,
      expectedType: "{ name: string; age: number }",
    },
    {
      code: `let nestedObj: any = { user: { name: "Jane", id: 123 }, active: true };`,
      expectedType: "{ user: { name: string; id: number }; active: boolean }",
    },
    {
      code: `let func: any = (a: number, b: number) => a + b;`,
      expectedType: "(unknown, unknown) => unknown",
    },
    {
      code: `let arrayOfObjects: any = [{ id: 1 }, { id: 2 }];`,
      expectedType: "{ id: number }[]",
    },
    {
      code: `let unionExample: any = Math.random() > 0.5 ? "text" : 42;`,
      expectedType: "string | number",
    },
    {
      code: `let htmlRef: any = document.getElementById("myDiv");`,
      expectedType: "HTMLElement | null",
    },
  ];

  console.log("Running embedded tests...");
  testCases.forEach((testCase, index) => {
    try {
      const ast = parse(testCase.code, { loc: true });
      attachParentReferences(ast); // Attach parent references to ensure traversal works.
      const node = ast.body[0]; // Test only the first declaration in each case.

      const inferredType = inferTypeFromNode(node);
      console.log(`Test Case ${index + 1}:`);
      console.log(`Code: ${testCase.code}`);
      console.log(`Expected Type: ${testCase.expectedType}`);
      console.log(`Inferred Type: ${inferredType}`);
      console.log(
        `Result: ${inferredType === testCase.expectedType ? "PASS" : "FAIL"}\n`
      );
    } catch (error) {
      console.error(`Test Case ${index + 1} failed with error:`, error);
    }
  });
}
