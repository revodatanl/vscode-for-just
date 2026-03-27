import { exec } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { getLogger } from './logger';
import { getJustPath } from './utils';

const execAsync = promisify(exec);
const log = getLogger();

export const formatJustfileTempFile = async (
  content: string,
  fileDir?: string,
): Promise<string> => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vscode-just-'));
  const tmpFile = path.join(tmpDir, 'justfile');

  try {
    await fs.writeFile(tmpFile, content, 'utf8');
    const justPath = getJustPath();
    const justfile = tmpFile.replace(/\\/g, '/');
    const { stdout } = await execAsync(`${justPath} --justfile "${justfile}" --dump`, {
      cwd: fileDir ?? tmpDir,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Error formatting justfile:\n${message}`);
    throw new Error('Failed to format justfile');
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
};
