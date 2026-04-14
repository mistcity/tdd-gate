/**
 * Tests for the UserPromptSubmit handler.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { handleUserPromptSubmit } from './user-prompt.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SESSION_ID = 'test-session-upsubmit';

function journalPath(): string {
  return path.join(os.tmpdir(), `tdd-gate-journal-${SESSION_ID}.log`);
}

function counterPath(): string {
  return path.join(os.tmpdir(), `tdd-gate-counter-${SESSION_ID}`);
}

function testRanPath(): string {
  return path.join(os.tmpdir(), `tdd-gate-test-ran-${SESSION_ID}`);
}

function createFile(filePath: string, content = 'data'): void {
  fs.writeFileSync(filePath, content, 'utf-8');
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Clean up any leftover files from previous runs
  for (const f of [journalPath(), counterPath(), testRanPath()]) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
});

afterEach(() => {
  for (const f of [journalPath(), counterPath(), testRanPath()]) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleUserPromptSubmit', () => {
  it('deletes the journal file when it exists', () => {
    createFile(journalPath());
    expect(fileExists(journalPath())).toBe(true);

    handleUserPromptSubmit(SESSION_ID);

    expect(fileExists(journalPath())).toBe(false);
  });

  it('deletes the counter file when it exists', () => {
    createFile(counterPath(), '5');
    expect(fileExists(counterPath())).toBe(true);

    handleUserPromptSubmit(SESSION_ID);

    expect(fileExists(counterPath())).toBe(false);
  });

  it('does not throw when journal file does not exist', () => {
    expect(fileExists(journalPath())).toBe(false);

    expect(() => handleUserPromptSubmit(SESSION_ID)).not.toThrow();
  });

  it('does not throw when counter file does not exist', () => {
    expect(fileExists(counterPath())).toBe(false);

    expect(() => handleUserPromptSubmit(SESSION_ID)).not.toThrow();
  });

  it('does NOT delete the testRan file (session-level state)', () => {
    createFile(testRanPath(), '1');
    expect(fileExists(testRanPath())).toBe(true);

    handleUserPromptSubmit(SESSION_ID);

    expect(fileExists(testRanPath())).toBe(true);
  });

  it('deletes both journal and counter even when both exist', () => {
    createFile(journalPath());
    createFile(counterPath(), '3');

    handleUserPromptSubmit(SESSION_ID);

    expect(fileExists(journalPath())).toBe(false);
    expect(fileExists(counterPath())).toBe(false);
  });

  it('handles special characters in session ID gracefully', () => {
    // The StateManager sanitizes session IDs — should not throw
    expect(() => handleUserPromptSubmit('session/with:special!chars')).not.toThrow();
  });
});
