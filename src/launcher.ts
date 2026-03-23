import * as vscode from 'vscode';

import { EXTENSION_NAME, SETTINGS } from './const';
import { workspaceRoot } from './utils';

let LAUNCHER: Launcher;

class Launcher implements vscode.Disposable {
  private terminals: Set<vscode.Terminal>;

  private onTerminalClose = vscode.window.onDidCloseTerminal((terminal) => {
    if (this.terminals.has(terminal)) {
      this.terminals.delete(terminal);
    }
  });

  constructor() {
    this.terminals = new Set();
  }

  public launch(command: string, args: string[]) {
    const terminalOptions: vscode.TerminalOptions = {
      name: command,
      cwd: workspaceRoot(),
    };

    const reuseTerminal = vscode.workspace
      .getConfiguration(EXTENSION_NAME)
      .get(SETTINGS.useSingleTerminal);

    let terminal: vscode.Terminal;
    if (reuseTerminal && this.terminals.size > 0) {
      terminal = this.terminals.values().next().value!;
    } else {
      terminal = vscode.window.createTerminal(terminalOptions);
      this.terminals.add(terminal);
    }

    terminal.sendText(`${command} ${args.join(' ')}`);
    terminal.show();

    return terminal;
  }

  public dispose() {
    this.terminals.forEach((terminal) => terminal.dispose());
    this.terminals.clear();
    this.onTerminalClose.dispose();
  }
}

export const getLauncher = () => {
  if (!LAUNCHER) {
    LAUNCHER = new Launcher();
  }
  return LAUNCHER;
};
