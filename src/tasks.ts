import * as vscode from 'vscode';

import { EXTENSION_NAME } from './const';
import { getJustPath } from './utils';

export interface TaskDefinition extends vscode.TaskDefinition {
  task: string;
  args?: string[];
}

export class TaskProvider implements vscode.TaskProvider {
  provideTasks() {
    return [createDefaultTask()];
  }

  resolveTask(task: vscode.Task) {
    if (task.definition.type !== EXTENSION_NAME) return undefined;

    const def = task.definition as TaskDefinition;

    return new vscode.Task(
      def,
      task.scope ?? vscode.TaskScope.Workspace,
      def.label ?? 'Run recipe',
      def.type,
      new vscode.ShellExecution(def.task, def.args ?? []),
    );
  }
}

const createDefaultTask = () => {
  const task = new vscode.Task(
    { type: EXTENSION_NAME, task: 'just' },
    vscode.TaskScope.Workspace,
    'Run default recipe',
    EXTENSION_NAME,
    new vscode.ShellExecution(getJustPath()),
  );
  task.presentationOptions = { showReuseMessage: false, close: false };
  return task;
};
