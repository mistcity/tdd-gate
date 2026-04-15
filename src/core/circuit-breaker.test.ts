/**
 * Tests for CircuitBreaker — file-based counter with auto-allow.
 * Written first (TDD RED phase).
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitBreaker } from './circuit-breaker.js';

describe('CircuitBreaker', () => {
  let counterPath: string;
  let cb: CircuitBreaker;
  const limit = 3;

  beforeEach(() => {
    counterPath = path.join(os.tmpdir(), `tdd-gate-cb-test-${Date.now()}-${Math.random()}`);
    cb = new CircuitBreaker(counterPath, limit);
  });

  afterEach(() => {
    try { fs.unlinkSync(counterPath); } catch {}
  });

  describe('check()', () => {
    it('returns false when count is below limit', () => {
      // First call: count goes from 0 → 1, limit=3, 1 > 3 is false
      expect(cb.check()).toBe(false);
    });

    it('returns false when count equals limit', () => {
      // With limit=3, count goes 1, 2, 3 — none exceed limit yet
      cb.check(); // 1
      cb.check(); // 2
      const result = cb.check(); // 3, 3 > 3 is false
      expect(result).toBe(false);
    });

    it('returns true when count exceeds limit', () => {
      cb.check(); // 1
      cb.check(); // 2
      cb.check(); // 3
      const result = cb.check(); // 4, 4 > 3 is true
      expect(result).toBe(true);
    });

    it('increments counter on each call', () => {
      cb.check();
      cb.check();
      cb.check();
      const count = parseInt(fs.readFileSync(counterPath, 'utf-8').trim(), 10);
      expect(count).toBe(3);
    });

    it('starts from 0 when counter file does not exist', () => {
      expect(fs.existsSync(counterPath)).toBe(false);
      const result = cb.check(); // count=1, 1>3 false
      expect(result).toBe(false);
      expect(fs.existsSync(counterPath)).toBe(true);
    });

    it('persists count across instances with same path', () => {
      cb.check(); // 1
      cb.check(); // 2

      // New instance pointing at same file
      const cb2 = new CircuitBreaker(counterPath, limit);
      cb2.check(); // 3
      const result = cb2.check(); // 4 > 3 = true
      expect(result).toBe(true);
    });

    it('never throws on filesystem errors (returns false)', () => {
      // Use an invalid path to force an error
      const badCb = new CircuitBreaker('/nonexistent/deep/path/counter', limit);
      expect(() => badCb.check()).not.toThrow();
      expect(badCb.check()).toBe(false);
    });

    it('logs to stderr on non-ENOENT read error (Finding #7)', () => {
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
        const err = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
        err.code = 'EACCES';
        throw err;
      });
      try {
        cb.check();
        expect(stderrSpy).toHaveBeenCalled();
        const msg = stderrSpy.mock.calls[0]?.[0] as string;
        expect(msg).toContain('[tdd-gate]');
        expect(msg).toContain('circuit breaker read failed');
      } finally {
        readSpy.mockRestore();
        stderrSpy.mockRestore();
      }
    });

    it('does NOT log to stderr on ENOENT read (file not yet created)', () => {
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      try {
        // First call on a new counter — ENOENT is expected, should not log
        cb.check();
        expect(stderrSpy).not.toHaveBeenCalled();
      } finally {
        stderrSpy.mockRestore();
      }
    });
  });

  describe('reset()', () => {
    it('deletes the counter file', () => {
      cb.check(); // creates file
      expect(fs.existsSync(counterPath)).toBe(true);
      cb.reset();
      expect(fs.existsSync(counterPath)).toBe(false);
    });

    it('sets counter back to 0 (next check starts fresh)', () => {
      // Push past limit
      cb.check(); // 1
      cb.check(); // 2
      cb.check(); // 3
      cb.check(); // 4 — would return true
      cb.reset();
      // After reset, counter starts from 0 again
      const result = cb.check(); // 1 > 3 = false
      expect(result).toBe(false);
    });

    it('does not throw when counter file does not exist', () => {
      expect(() => cb.reset()).not.toThrow();
    });
  });
});
