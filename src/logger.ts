import * as vscode from 'vscode';

import { EXTENSION_NAME, SETTINGS } from './const';

enum LogLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  NONE = 'none',
}

const LOG_LEVEL_PRIORITY: Record<string, number> = {
  [LogLevel.INFO]: 0,
  [LogLevel.WARNING]: 1,
  [LogLevel.ERROR]: 2,
  [LogLevel.NONE]: 3,
};

let instance: Logger;

class Logger implements vscode.Disposable {
  private channel: vscode.OutputChannel;
  private level: LogLevel;
  private configListener: vscode.Disposable;

  constructor(name: string) {
    this.channel = vscode.window.createOutputChannel(name);
    this.level = this.readConfigLevel();
    this.configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${EXTENSION_NAME}.${SETTINGS.logLevel}`)) {
        this.level = this.readConfigLevel();
      }
    });
  }

  info(message: string) {
    this.log(message, LogLevel.INFO);
  }

  warning(message: string) {
    this.log(message, LogLevel.WARNING);
  }

  error(message: string) {
    this.log(message, LogLevel.ERROR);
  }

  show() {
    this.channel.show();
  }

  dispose() {
    this.channel.dispose();
    this.configListener.dispose();
  }

  private readConfigLevel(): LogLevel {
    return (
      vscode.workspace.getConfiguration(EXTENSION_NAME).get(SETTINGS.logLevel) ??
      LogLevel.INFO
    );
  }

  private log(message: string, level: LogLevel) {
    if ((LOG_LEVEL_PRIORITY[level] ?? 0) < (LOG_LEVEL_PRIORITY[this.level] ?? 0)) return;

    const line = `[${new Date().toISOString()}] [${level}] ${message}`;
    if (message.endsWith('\n')) {
      this.channel.append(line);
    } else {
      this.channel.appendLine(line);
    }
  }
}

export const getLogger = (): Logger => {
  if (!instance) {
    instance = new Logger(EXTENSION_NAME);
  }
  return instance;
};
