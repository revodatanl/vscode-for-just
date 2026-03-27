import * as vscode from 'vscode';

import { EXTENSION_NAME, SETTINGS } from './const';
import { workspaceRoot } from './utils';

let instance: Launcher;

class Launcher implements vscode.Disposable {
  private terminals = new Set<vscode.Terminal>();

  private closeListener = vscode.window.onDidCloseTerminal((terminal) => {
    this.terminals.delete(terminal);
  });

  launch(command: string, args: string[]) {
    const reuse = vscode.workspace
      .getConfiguration(EXTENSION_NAME)
      .get(SETTINGS.useSingleTerminal);

    let terminal: vscode.Terminal;
    if (reuse && this.terminals.size > 0) {
      terminal = this.terminals.values().next().value!;
    } else {
      terminal = vscode.window.createTerminal({ name: command, cwd: workspaceRoot() });
      this.terminals.add(terminal);
    }

    terminal.sendText(`${command} ${args.join(' ')}`);
    terminal.show();
    return terminal;
  }

  dispose() {
    this.terminals.forEach((t) => t.dispose());
    this.terminals.clear();
    this.closeListener.dispose();
  }
}

export const getLauncher = (): Launcher => {
  if (!instance) {
    instance = new Launcher();
  }
  return instance;
};
