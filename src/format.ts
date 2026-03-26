import { exec } from 'node:child_process';
import { promisify } from 'node:util';

import { getLogger } from './logger';
import { getJustPath } from './utils';

const execAsync = promisify(exec);
const LOGGER = getLogger();

/**
 * Formats justfile content using `just --dump` with a temporary file.
 *
 * Runs `just` with `cwd` set to the original file's directory so that
 * relative `import` paths resolve correctly. A temp file is still used
 * so that unsaved editor content can be formatted.
 *
 * @param content The justfile content to format.
 * @param fileDir The directory of the original justfile (used as cwd for
 *                resolving relative imports). Falls back to a temp directory.
 * @returns A promise that resolves to the formatted content.
 */
export const formatJustfileTempFile = async (
  content: string,
  fileDir?: string,
): Promise<string> => {
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');

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
    LOGGER.error(`Error formatting justfile:\n${message}`);
    throw new Error('Failed to format justfile');
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
};
