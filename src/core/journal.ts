/**
 * Journal — tracks test/implementation edit order for TDD enforcement.
 *
 * Entries are stored as plain-text lines:
 *   {timestamp} {TYPE} {filePath}\n
 *
 * All methods are fail-safe and never throw to the caller.
 */

import fs from 'fs';
import path from 'path';

export class Journal {
  private filePath: string;

  constructor(journalPath: string) {
    this.filePath = journalPath;
  }

  /** Record that a test file was edited/created. */
  recordTest(testFilePath: string): void {
    this.append('TEST', testFilePath);
  }

  /** Record that an implementation file was edited/created. */
  recordImpl(implFilePath: string): void {
    this.append('IMPL', implFilePath);
  }

  /** Record that a test command was executed. */
  recordTestRun(command: string): void {
    this.append('TEST_RUN', command);
  }

  /**
   * Check if any test has been recorded matching any of the expected test paths.
   * Matches by basename to handle different directory layouts.
   * Returns false on any error.
   */
  hasTestFor(expectedTestPaths: string[]): boolean {
    try {
      const entries = this.getEntries();
      const expectedBasenames = expectedTestPaths.map(p => path.basename(p));
      return entries.some(entry => {
        if (entry.type !== 'TEST') return false;
        const entryBasename = path.basename(entry.filePath);
        return expectedBasenames.includes(entryBasename);
      });
    } catch {
      return false;
    }
  }

  /**
   * Check if any test run was recorded in this session.
   * Returns false on any error.
   */
  hasTestRun(): boolean {
    try {
      const entries = this.getEntries();
      return entries.some(entry => entry.type === 'TEST_RUN');
    } catch {
      return false;
    }
  }

  /**
   * Read all entries from the journal file.
   * Returns [] on error or empty file.
   */
  getEntries(): Array<{ type: string; filePath: string }> {
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      if (!content.trim()) return [];

      const entries: Array<{ type: string; filePath: string }> = [];
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Format: "{timestamp} {TYPE} {filePath}"
        // We use a single split with limit to handle paths with spaces
        const spaceIdx1 = trimmed.indexOf(' ');
        if (spaceIdx1 === -1) continue;
        const rest = trimmed.slice(spaceIdx1 + 1);

        const spaceIdx2 = rest.indexOf(' ');
        if (spaceIdx2 === -1) continue;
        const type = rest.slice(0, spaceIdx2);
        const filePath = rest.slice(spaceIdx2 + 1);

        if (type && filePath) {
          entries.push({ type, filePath });
        }
      }
      return entries;
    } catch {
      return [];
    }
  }

  private append(type: string, filePath: string): void {
    try {
      const timestamp = Date.now();
      const line = `${timestamp} ${type} ${filePath}\n`;
      fs.appendFileSync(this.filePath, line, 'utf-8');
    } catch {
      // Fail silently — journal writes are best-effort
    }
  }
}
