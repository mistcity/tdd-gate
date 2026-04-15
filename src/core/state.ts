/**
 * StateManager — manages paths to per-session temporary state files.
 */

import os from 'os';
import path from 'path';
import fs from 'fs';

export class StateManager {
  private sessionId: string;
  private tmpDir: string;

  constructor(sessionId: string) {
    // Sanitize session ID: keep only alphanumeric, hyphen, underscore
    this.sessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
    this.tmpDir = os.tmpdir();
  }

  get journalPath(): string {
    return path.join(this.tmpDir, `tdd-gate-journal-${this.sessionId}.log`);
  }

  get counterPath(): string {
    return path.join(this.tmpDir, `tdd-gate-counter-${this.sessionId}`);
  }

  get testRanPath(): string {
    return path.join(this.tmpDir, `tdd-gate-test-ran-${this.sessionId}`);
  }

  /** Clear per-message state (journal + counter), keep testRan. */
  clearPerMessage(): void {
    this.deleteFile(this.journalPath);
    this.deleteFile(this.counterPath);
  }

  /** Clear all state files. */
  clearAll(): void {
    this.deleteFile(this.journalPath);
    this.deleteFile(this.counterPath);
    this.deleteFile(this.testRanPath);
  }

  private deleteFile(filePath: string): void {
    try {
      fs.unlinkSync(filePath);
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code !== 'ENOENT') {
        process.stderr.write(
          `[tdd-gate] state cleanup failed for ${filePath}: ${err instanceof Error ? err.message : String(err)}\n`
        );
      }
    }
  }
}
