import * as vscode from "vscode";

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
      await editor.edit((editBuilder) => {
        editBuilder.replace(range, "unknown");
      });
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
