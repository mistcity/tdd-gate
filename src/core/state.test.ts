/**
 * Tests for StateManager — per-session temp file path management.
 * Written first (TDD RED phase).
 */

import os from 'os';
import path from 'path';
import fs from 'fs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StateManager } from './state.js';

describe('StateManager', () => {
  let mgr: StateManager;
  const sessionId = 'test-session-123';

  afterEach(() => {
    // Clean up any files created during tests
    try { fs.unlinkSync(mgr.journalPath); } catch {}
    try { fs.unlinkSync(mgr.counterPath); } catch {}
    try { fs.unlinkSync(mgr.testRanPath); } catch {}
  });

  describe('constructor', () => {
    it('sanitizes special characters in session ID', () => {
      const special = new StateManager('session/with:special?chars!');
      // Only the basename (filename) should be free of special chars — the tmpdir path has slashes
      const basename = path.basename(special.journalPath);
      expect(basename).not.toMatch(/[:?!]/);
      // The session portion (after the prefix) should have special chars replaced
      expect(basename).not.toContain('/');
    });

    it('replaces forward slashes with underscores', () => {
      const m = new StateManager('foo/bar');
      expect(m.journalPath).toContain('foo_bar');
    });

    it('preserves alphanumeric, hyphen, and underscore characters', () => {
      const m = new StateManager('abc-123_XYZ');
      expect(m.journalPath).toContain('abc-123_XYZ');
    });
  });

  describe('path accessors', () => {
    beforeEach(() => {
      mgr = new StateManager(sessionId);
    });

    it('journalPath is in os.tmpdir()', () => {
      expect(mgr.journalPath.startsWith(os.tmpdir())).toBe(true);
    });

    it('journalPath contains session ID', () => {
      expect(mgr.journalPath).toContain(sessionId);
    });

    it('journalPath contains "journal"', () => {
      expect(path.basename(mgr.journalPath)).toContain('journal');
    });

    it('counterPath is in os.tmpdir()', () => {
      expect(mgr.counterPath.startsWith(os.tmpdir())).toBe(true);
    });

    it('counterPath contains session ID', () => {
      expect(mgr.counterPath).toContain(sessionId);
    });

    it('counterPath contains "counter"', () => {
      expect(path.basename(mgr.counterPath)).toContain('counter');
    });

    it('testRanPath is in os.tmpdir()', () => {
      expect(mgr.testRanPath.startsWith(os.tmpdir())).toBe(true);
    });

    it('testRanPath contains session ID', () => {
      expect(mgr.testRanPath).toContain(sessionId);
    });

    it('testRanPath contains "test-ran"', () => {
      expect(path.basename(mgr.testRanPath)).toContain('test-ran');
    });

    it('all three paths are distinct', () => {
      const paths = [mgr.journalPath, mgr.counterPath, mgr.testRanPath];
      const unique = new Set(paths);
      expect(unique.size).toBe(3);
    });
  });

  describe('clearPerMessage()', () => {
    beforeEach(() => {
      mgr = new StateManager(sessionId);
    });

    it('deletes journal file when it exists', () => {
      fs.writeFileSync(mgr.journalPath, 'data');
      mgr.clearPerMessage();
      expect(fs.existsSync(mgr.journalPath)).toBe(false);
    });

    it('deletes counter file when it exists', () => {
      fs.writeFileSync(mgr.counterPath, '3');
      mgr.clearPerMessage();
      expect(fs.existsSync(mgr.counterPath)).toBe(false);
    });

    it('does NOT delete testRan file', () => {
      fs.writeFileSync(mgr.testRanPath, '');
      mgr.clearPerMessage();
      expect(fs.existsSync(mgr.testRanPath)).toBe(true);
    });

    it('does not throw when journal file does not exist', () => {
      expect(() => mgr.clearPerMessage()).not.toThrow();
    });

    it('does not throw when counter file does not exist', () => {
      expect(() => mgr.clearPerMessage()).not.toThrow();
    });

    it('does not throw when no files exist', () => {
      expect(() => mgr.clearPerMessage()).not.toThrow();
    });
  });

  describe('clearAll()', () => {
    beforeEach(() => {
      mgr = new StateManager(sessionId);
    });

    it('deletes journal file', () => {
      fs.writeFileSync(mgr.journalPath, 'data');
      mgr.clearAll();
      expect(fs.existsSync(mgr.journalPath)).toBe(false);
    });

    it('deletes counter file', () => {
      fs.writeFileSync(mgr.counterPath, '3');
      mgr.clearAll();
      expect(fs.existsSync(mgr.counterPath)).toBe(false);
    });

    it('deletes testRan file', () => {
      fs.writeFileSync(mgr.testRanPath, '');
      mgr.clearAll();
      expect(fs.existsSync(mgr.testRanPath)).toBe(false);
    });

    it('does not throw when no files exist', () => {
      expect(() => mgr.clearAll()).not.toThrow();
    });
  });

  describe('deleteFile — non-ENOENT logging (Finding #9)', () => {
    beforeEach(() => {
      mgr = new StateManager(sessionId);
    });

    it('logs to stderr when unlinkSync throws a non-ENOENT error', () => {
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {
        const err = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
        err.code = 'EACCES';
        throw err;
      });
      try {
        // clearPerMessage calls deleteFile internally
        mgr.clearPerMessage();
        expect(stderrSpy).toHaveBeenCalled();
        const msg = stderrSpy.mock.calls[0]?.[0] as string;
        expect(msg).toContain('[tdd-gate]');
        expect(msg).toContain('state cleanup failed');
      } finally {
        unlinkSpy.mockRestore();
        stderrSpy.mockRestore();
      }
    });

    it('does NOT log to stderr when file does not exist (ENOENT)', () => {
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      try {
        // Deleting files that don't exist should not log
        mgr.clearAll();
        expect(stderrSpy).not.toHaveBeenCalled();
      } finally {
        stderrSpy.mockRestore();
      }
    });
  });
});
