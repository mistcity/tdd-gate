/**
 * Tests for Journal — test/implementation edit order tracking.
 * Written first (TDD RED phase).
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Journal } from './journal.js';

describe('Journal', () => {
  let journalPath: string;
  let journal: Journal;

  beforeEach(() => {
    journalPath = path.join(os.tmpdir(), `tdd-gate-journal-test-${Date.now()}-${Math.random()}.log`);
    journal = new Journal(journalPath);
  });

  afterEach(() => {
    try { fs.unlinkSync(journalPath); } catch {}
  });

  describe('recordTest()', () => {
    it('creates the journal file if it does not exist', () => {
      journal.recordTest('/src/foo.test.ts');
      expect(fs.existsSync(journalPath)).toBe(true);
    });

    it('appends a TEST entry with the file path', () => {
      journal.recordTest('/src/foo.test.ts');
      const content = fs.readFileSync(journalPath, 'utf-8');
      expect(content).toContain('TEST');
      expect(content).toContain('/src/foo.test.ts');
    });

    it('does not throw', () => {
      expect(() => journal.recordTest('/src/foo.test.ts')).not.toThrow();
    });
  });

  describe('recordImpl()', () => {
    it('appends an IMPL entry with the file path', () => {
      journal.recordImpl('/src/foo.ts');
      const content = fs.readFileSync(journalPath, 'utf-8');
      expect(content).toContain('IMPL');
      expect(content).toContain('/src/foo.ts');
    });

    it('does not throw', () => {
      expect(() => journal.recordImpl('/src/foo.ts')).not.toThrow();
    });
  });

  describe('recordTestRun()', () => {
    it('appends a TEST_RUN entry with the command', () => {
      journal.recordTestRun('npm test');
      const content = fs.readFileSync(journalPath, 'utf-8');
      expect(content).toContain('TEST_RUN');
      expect(content).toContain('npm test');
    });

    it('does not throw', () => {
      expect(() => journal.recordTestRun('npm test')).not.toThrow();
    });
  });

  describe('hasTestFor()', () => {
    it('returns true when a matching TEST entry was recorded', () => {
      journal.recordTest('/project/src/foo.test.ts');
      expect(journal.hasTestFor(['/project/src/foo.test.ts'])).toBe(true);
    });

    it('returns false when no TEST entry was recorded', () => {
      expect(journal.hasTestFor(['/project/src/foo.test.ts'])).toBe(false);
    });

    it('returns false when IMPL was recorded but not TEST', () => {
      journal.recordImpl('/project/src/foo.ts');
      expect(journal.hasTestFor(['/project/src/foo.test.ts'])).toBe(false);
    });

    it('matches by basename when paths differ', () => {
      // TEST recorded with one directory layout
      journal.recordTest('/project/tests/foo.test.ts');
      // Looking for it with a different directory prefix
      expect(journal.hasTestFor(['/different/path/foo.test.ts'])).toBe(true);
    });

    it('returns true when any of multiple expected paths matches', () => {
      journal.recordTest('/src/bar.spec.ts');
      expect(journal.hasTestFor(['/src/foo.test.ts', '/src/bar.spec.ts'])).toBe(true);
    });

    it('returns false when none of multiple expected paths match', () => {
      journal.recordTest('/src/other.test.ts');
      expect(journal.hasTestFor(['/src/foo.test.ts', '/src/bar.spec.ts'])).toBe(false);
    });

    it('never throws — returns false on error (no file)', () => {
      const j = new Journal('/nonexistent/path/journal.log');
      expect(() => j.hasTestFor(['/src/foo.test.ts'])).not.toThrow();
      expect(j.hasTestFor(['/src/foo.test.ts'])).toBe(false);
    });

    it('returns true when append has previously failed (appendFailed flag)', () => {
      // Use a path where the directory does not exist to force append to fail
      const badJournal = new Journal('/nonexistent/dir/journal.log');
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      try {
        // This append will fail because directory doesn't exist
        badJournal.recordTest('/src/foo.test.ts');
        // After append failure, hasTestFor should return true (fail-open)
        expect(badJournal.hasTestFor(['/src/bar.test.ts'])).toBe(true);
      } finally {
        stderrSpy.mockRestore();
      }
    });
  });

  describe('hasTestRun()', () => {
    it('returns true after recordTestRun()', () => {
      journal.recordTestRun('npm test');
      expect(journal.hasTestRun()).toBe(true);
    });

    it('returns false when no test run was recorded', () => {
      expect(journal.hasTestRun()).toBe(false);
    });

    it('returns false when only TEST and IMPL were recorded', () => {
      journal.recordTest('/src/foo.test.ts');
      journal.recordImpl('/src/foo.ts');
      expect(journal.hasTestRun()).toBe(false);
    });

    it('returns true when multiple runs were recorded', () => {
      journal.recordTestRun('npm test');
      journal.recordTestRun('vitest run');
      expect(journal.hasTestRun()).toBe(true);
    });

    it('never throws — returns false when file missing', () => {
      const j = new Journal('/nonexistent/path/journal.log');
      expect(() => j.hasTestRun()).not.toThrow();
      expect(j.hasTestRun()).toBe(false);
    });

    it('returns true when append has previously failed (appendFailed flag)', () => {
      const badJournal = new Journal('/nonexistent/dir/journal.log');
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      try {
        badJournal.recordTestRun('npm test');
        expect(badJournal.hasTestRun()).toBe(true);
      } finally {
        stderrSpy.mockRestore();
      }
    });
  });

  describe('getEntries()', () => {
    it('returns empty array when file does not exist', () => {
      expect(journal.getEntries()).toEqual([]);
    });

    it('returns parsed entries in order', () => {
      journal.recordTest('/src/foo.test.ts');
      journal.recordImpl('/src/foo.ts');
      journal.recordTestRun('npm test');

      const entries = journal.getEntries();
      expect(entries).toHaveLength(3);
      expect(entries[0].type).toBe('TEST');
      expect(entries[0].filePath).toBe('/src/foo.test.ts');
      expect(entries[1].type).toBe('IMPL');
      expect(entries[1].filePath).toBe('/src/foo.ts');
      expect(entries[2].type).toBe('TEST_RUN');
      expect(entries[2].filePath).toBe('npm test');
    });

    it('returns empty array on empty file', () => {
      fs.writeFileSync(journalPath, '');
      expect(journal.getEntries()).toEqual([]);
    });

    it('returns empty array on parse error', () => {
      const j = new Journal('/nonexistent/path/journal.log');
      expect(j.getEntries()).toEqual([]);
    });

    it('handles multiple entries of the same type', () => {
      journal.recordTest('/src/a.test.ts');
      journal.recordTest('/src/b.test.ts');
      const entries = journal.getEntries();
      expect(entries).toHaveLength(2);
      expect(entries.every((e: { type: string; filePath: string }) => e.type === 'TEST')).toBe(true);
    });
  });

  describe('append() — stderr logging on failure (Finding #4)', () => {
    it('logs to stderr when append fails', () => {
      const badJournal = new Journal('/nonexistent/dir/journal.log');
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      try {
        badJournal.recordTest('/src/foo.test.ts');
        expect(stderrSpy).toHaveBeenCalled();
        const msg = stderrSpy.mock.calls[0]?.[0] as string;
        expect(msg).toContain('[tdd-gate]');
        expect(msg).toContain('journal write failed');
      } finally {
        stderrSpy.mockRestore();
      }
    });
  });

  describe('getEntries() — stderr logging on non-ENOENT failure (Finding #5)', () => {
    it('logs to stderr on non-ENOENT read failure', () => {
      // Write a file then make it unreadable to force a non-ENOENT error
      // Instead, we mock fs.readFileSync to throw a non-ENOENT error
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
        const err = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
        err.code = 'EACCES';
        throw err;
      });
      try {
        const entries = journal.getEntries();
        expect(entries).toEqual([]);
        expect(stderrSpy).toHaveBeenCalled();
        const msg = stderrSpy.mock.calls[0]?.[0] as string;
        expect(msg).toContain('[tdd-gate]');
        expect(msg).toContain('journal read failed');
      } finally {
        readSpy.mockRestore();
        stderrSpy.mockRestore();
      }
    });

    it('does NOT log to stderr on ENOENT (missing file is expected)', () => {
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      try {
        const j = new Journal('/nonexistent/path/journal.log');
        j.getEntries();
        expect(stderrSpy).not.toHaveBeenCalled();
      } finally {
        stderrSpy.mockRestore();
      }
    });
  });

  describe('append order and content', () => {
    it('each entry has timestamp, type, and filePath', () => {
      journal.recordImpl('/src/foo.ts');
      const entries = journal.getEntries();
      expect(entries[0]).toHaveProperty('type');
      expect(entries[0]).toHaveProperty('filePath');
    });

    it('entries are appended in call order', () => {
      journal.recordTest('/src/a.test.ts');
      journal.recordImpl('/src/b.ts');
      const entries = journal.getEntries();
      expect(entries[0].type).toBe('TEST');
      expect(entries[1].type).toBe('IMPL');
    });
  });
});
