/**
 * Tests for config loader — DEFAULT_CONFIG and loadConfig().
 *
 * Covers: override(), overrideArray(), isPlainObject() helpers via loadConfig() integration,
 * and mode validation with fallback behavior.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DEFAULT_CONFIG, VALID_MODES, loadConfig } from './config.js';
import type { TddGateConfig } from '../types.js';

describe('DEFAULT_CONFIG', () => {
  it('has all 10 languages enabled', () => {
    const expectedLanguages = [
      'python', 'typescript', 'javascript', 'tsx', 'jsx',
      'kotlin', 'java', 'go', 'rust', 'csharp',
    ];
    expect(Object.keys(DEFAULT_CONFIG.languages)).toHaveLength(10);
    for (const lang of expectedLanguages) {
      expect(DEFAULT_CONFIG.languages[lang]).toBeDefined();
      expect(DEFAULT_CONFIG.languages[lang]!.enabled).toBe(true);
    }
  });

  it('has expected exempt extensions', () => {
    const expected = [
      '.json', '.md', '.yaml', '.yml', '.toml', '.lock',
      '.env', '.gitignore', '.dockerignore', '.editorconfig',
      '.txt', '.csv', '.svg', '.png', '.jpg', '.gif', '.ico',
      '.woff', '.woff2', '.ttf', '.eot',
    ];
    expect(DEFAULT_CONFIG.exempt.extensions).toEqual(expected);
  });

  it('has default exempt paths for config files', () => {
    expect(DEFAULT_CONFIG.exempt.paths).toContain('.config.');
    expect(DEFAULT_CONFIG.exempt.paths).toContain('tsconfig');
    expect(DEFAULT_CONFIG.exempt.paths).toContain('vite.config');
    expect(DEFAULT_CONFIG.exempt.paths.length).toBeGreaterThan(0);
  });

  it('has bashDetection true by default', () => {
    expect(DEFAULT_CONFIG.bashDetection).toBe(true);
  });

  it('has completionAudit true by default', () => {
    expect(DEFAULT_CONFIG.completionAudit).toBe(true);
  });

  it('has expected circuitBreaker defaults', () => {
    expect(DEFAULT_CONFIG.circuitBreaker.preToolUse).toBe(1000);
    expect(DEFAULT_CONFIG.circuitBreaker.stop).toBe(20);
  });

  it('has config file patterns in default exempt paths', () => {
    // Config files like vitest.config.ts, tsconfig.json should be exempt
    expect(DEFAULT_CONFIG.exempt.paths).toContain('.config.');
    expect(DEFAULT_CONFIG.exempt.paths).toContain('tsconfig');
  });

  it('has empty testCommands by default', () => {
    expect(DEFAULT_CONFIG.testCommands).toEqual([]);
  });

  it('has expected testDirs defaults', () => {
    expect(DEFAULT_CONFIG.testDirs).toEqual(['tests', 'test', 'spec', '__tests__']);
  });

  it('has impactAnalysis true by default', () => {
    expect(DEFAULT_CONFIG.impactAnalysis).toBe(true);
  });

  it('has impactAnalysisMaxFiles 500 by default', () => {
    expect(DEFAULT_CONFIG.impactAnalysisMaxFiles).toBe(500);
  });

  it('has impactAnalysisTimeout 5000 by default', () => {
    expect(DEFAULT_CONFIG.impactAnalysisTimeout).toBe(5000);
  });
});

describe('loadConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tdd-gate-config-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('returns DEFAULT_CONFIG when no config file exists', () => {
    const result = loadConfig(tmpDir);
    expect(result).toEqual(DEFAULT_CONFIG);
  });

  it('merges user language overrides (disabling rust)', () => {
    const userConfig = {
      languages: { rust: { enabled: false } },
    };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const result = loadConfig(tmpDir);

    expect(result.languages['rust']!.enabled).toBe(false);
    // Other languages remain enabled
    expect(result.languages['python']!.enabled).toBe(true);
    expect(result.languages['typescript']!.enabled).toBe(true);
    expect(result.languages['go']!.enabled).toBe(true);
  });

  it('replaces exempt.extensions with user values (not append)', () => {
    const userExtensions = ['.json', '.md'];
    const userConfig = {
      exempt: { extensions: userExtensions },
    };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const result = loadConfig(tmpDir);

    expect(result.exempt.extensions).toEqual(userExtensions);
    // Should NOT contain other default extensions
    expect(result.exempt.extensions).not.toContain('.png');
  });

  it('replaces exempt.paths with user values', () => {
    const userPaths = ['src/generated/', 'dist/'];
    const userConfig = {
      exempt: { paths: userPaths },
    };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const result = loadConfig(tmpDir);

    expect(result.exempt.paths).toEqual(userPaths);
  });

  it('merges circuitBreaker overrides per-field', () => {
    const userConfig = {
      circuitBreaker: { preToolUse: 500 },
    };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const result = loadConfig(tmpDir);

    expect(result.circuitBreaker.preToolUse).toBe(500);
    // Other field retains default
    expect(result.circuitBreaker.stop).toBe(20);
  });

  it('handles bashDetection=false override', () => {
    const userConfig = { bashDetection: false };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const result = loadConfig(tmpDir);

    expect(result.bashDetection).toBe(false);
  });

  it('handles completionAudit=false override', () => {
    const userConfig = { completionAudit: false };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const result = loadConfig(tmpDir);

    expect(result.completionAudit).toBe(false);
  });

  it('returns DEFAULT_CONFIG for invalid JSON and logs to stderr (Finding #2)', () => {
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), '{ invalid json !!');

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const result = loadConfig(tmpDir);
      expect(result).toEqual(DEFAULT_CONFIG);
      // Parse error should be logged
      expect(stderrSpy).toHaveBeenCalled();
      const msg = stderrSpy.mock.calls[0]?.[0] as string;
      expect(msg).toContain('[tdd-gate]');
      expect(msg).toContain('failed to load tdd-gate.config.json');
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('returns DEFAULT_CONFIG without logging when config file is missing (ENOENT)', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const result = loadConfig(tmpDir);
      expect(result).toEqual(DEFAULT_CONFIG);
      // ENOENT should NOT log
      expect(stderrSpy).not.toHaveBeenCalled();
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('returns DEFAULT_CONFIG for non-object JSON (array)', () => {
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify([1, 2, 3]));

    const result = loadConfig(tmpDir);

    expect(result).toEqual(DEFAULT_CONFIG);
  });

  it('returns DEFAULT_CONFIG for non-object JSON (string)', () => {
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify('just a string'));

    const result = loadConfig(tmpDir);

    expect(result).toEqual(DEFAULT_CONFIG);
  });

  it('handles partial config (only some fields specified)', () => {
    const userConfig: Partial<TddGateConfig> = {
      bashDetection: false,
      circuitBreaker: { preToolUse: 200, stop: 10 },
    };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const result = loadConfig(tmpDir);

    expect(result.bashDetection).toBe(false);
    expect(result.circuitBreaker.preToolUse).toBe(200);
    expect(result.circuitBreaker.stop).toBe(10);
    // Unspecified fields retain defaults
    expect(result.completionAudit).toBe(true);
    expect(Object.keys(result.languages)).toHaveLength(10);
    expect(result.exempt.extensions).toEqual(DEFAULT_CONFIG.exempt.extensions);
  });

  // -------------------------------------------------------------------------
  // New fields: testCommands, testDirs, impactAnalysis, etc.
  // -------------------------------------------------------------------------

  it('returns default testCommands (empty) when no config file', () => {
    const result = loadConfig(tmpDir);
    expect(result.testCommands).toEqual([]);
  });

  it('returns default testDirs when no config file', () => {
    const result = loadConfig(tmpDir);
    expect(result.testDirs).toEqual(['tests', 'test', 'spec', '__tests__']);
  });

  it('returns default impactAnalysis=true when no config file', () => {
    const result = loadConfig(tmpDir);
    expect(result.impactAnalysis).toBe(true);
  });

  it('returns default impactAnalysisMaxFiles=500 when no config file', () => {
    const result = loadConfig(tmpDir);
    expect(result.impactAnalysisMaxFiles).toBe(500);
  });

  it('returns default impactAnalysisTimeout=5000 when no config file', () => {
    const result = loadConfig(tmpDir);
    expect(result.impactAnalysisTimeout).toBe(5000);
  });

  it('replaces testCommands with user values', () => {
    const userConfig = { testCommands: ['vitest run', 'jest'] };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const result = loadConfig(tmpDir);

    expect(result.testCommands).toEqual(['vitest run', 'jest']);
  });

  it('replaces testDirs with user values', () => {
    const userConfig = { testDirs: ['src/__tests__', 'e2e'] };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const result = loadConfig(tmpDir);

    expect(result.testDirs).toEqual(['src/__tests__', 'e2e']);
  });

  it('ignores testCommands if not an array', () => {
    const userConfig = { testCommands: 'npm test' };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const result = loadConfig(tmpDir);

    expect(result.testCommands).toEqual([]);
  });

  it('ignores testDirs if not an array', () => {
    const userConfig = { testDirs: 'tests' };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const result = loadConfig(tmpDir);

    expect(result.testDirs).toEqual(['tests', 'test', 'spec', '__tests__']);
  });

  it('handles impactAnalysis=false override', () => {
    const userConfig = { impactAnalysis: false };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const result = loadConfig(tmpDir);

    expect(result.impactAnalysis).toBe(false);
  });

  it('ignores impactAnalysis if not boolean', () => {
    const userConfig = { impactAnalysis: 'yes' };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const result = loadConfig(tmpDir);

    expect(result.impactAnalysis).toBe(true);
  });

  it('handles impactAnalysisMaxFiles override', () => {
    const userConfig = { impactAnalysisMaxFiles: 200 };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const result = loadConfig(tmpDir);

    expect(result.impactAnalysisMaxFiles).toBe(200);
  });

  it('ignores impactAnalysisMaxFiles if not number', () => {
    const userConfig = { impactAnalysisMaxFiles: '200' };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const result = loadConfig(tmpDir);

    expect(result.impactAnalysisMaxFiles).toBe(500);
  });

  it('handles impactAnalysisTimeout override', () => {
    const userConfig = { impactAnalysisTimeout: 10000 };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const result = loadConfig(tmpDir);

    expect(result.impactAnalysisTimeout).toBe(10000);
  });

  it('ignores impactAnalysisTimeout if not number', () => {
    const userConfig = { impactAnalysisTimeout: true };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const result = loadConfig(tmpDir);

    expect(result.impactAnalysisTimeout).toBe(5000);
  });

  it('disabling impactAnalysis preserves other impact fields', () => {
    const userConfig = {
      impactAnalysis: false,
      impactAnalysisMaxFiles: 100,
      impactAnalysisTimeout: 3000,
    };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const result = loadConfig(tmpDir);

    expect(result.impactAnalysis).toBe(false);
    expect(result.impactAnalysisMaxFiles).toBe(100);
    expect(result.impactAnalysisTimeout).toBe(3000);
  });

  // -------------------------------------------------------------------------
  // mode field
  // -------------------------------------------------------------------------

  it('has mode enforce by default', () => {
    expect(DEFAULT_CONFIG.mode).toBe('enforce');
  });

  it('VALID_MODES contains exactly enforce and observe', () => {
    expect(VALID_MODES).toContain('enforce');
    expect(VALID_MODES).toContain('observe');
    expect(VALID_MODES).toHaveLength(2);
  });

  it('returns default mode enforce when no config file', () => {
    const result = loadConfig(tmpDir);
    expect(result.mode).toBe('enforce');
  });

  it('allows user to set mode to observe', () => {
    const userConfig = { mode: 'observe' };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const result = loadConfig(tmpDir);

    expect(result.mode).toBe('observe');
  });

  it('allows user to explicitly set mode to enforce', () => {
    const userConfig = { mode: 'enforce' };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const result = loadConfig(tmpDir);

    expect(result.mode).toBe('enforce');
  });

  it('falls back to enforce for invalid mode value', () => {
    const userConfig = { mode: 'invalid' };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const result = loadConfig(tmpDir);

    expect(result.mode).toBe('enforce');
  });

  it('falls back to enforce when mode is not a string', () => {
    const userConfig = { mode: true };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const result = loadConfig(tmpDir);

    expect(result.mode).toBe('enforce');
  });

  it('falls back to enforce when mode is a number', () => {
    const userConfig = { mode: 42 };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const result = loadConfig(tmpDir);

    expect(result.mode).toBe('enforce');
  });

  it('logs to stderr when mode value is rejected (invalid string)', () => {
    const userConfig = { mode: 'warning' };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const result = loadConfig(tmpDir);
      expect(result.mode).toBe('enforce');
      expect(stderrSpy).toHaveBeenCalled();
      const msg = stderrSpy.mock.calls[0]?.[0] as string;
      expect(msg).toContain('[tdd-gate]');
      expect(msg).toContain('invalid mode');
      expect(msg).toContain('warning');
      expect(msg).toContain('enforce');
      expect(msg).toContain('observe');
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('logs to stderr when mode value is OBSERVE (case-sensitive)', () => {
    const userConfig = { mode: 'OBSERVE' };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const result = loadConfig(tmpDir);
      expect(result.mode).toBe('enforce');
      expect(stderrSpy).toHaveBeenCalled();
      const msg = stderrSpy.mock.calls[0]?.[0] as string;
      expect(msg).toContain('OBSERVE');
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('does NOT log to stderr when mode is valid "enforce"', () => {
    const userConfig = { mode: 'enforce' };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      loadConfig(tmpDir);
      expect(stderrSpy).not.toHaveBeenCalled();
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('does NOT log to stderr when mode is valid "observe"', () => {
    const userConfig = { mode: 'observe' };
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), JSON.stringify(userConfig));

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      loadConfig(tmpDir);
      expect(stderrSpy).not.toHaveBeenCalled();
    } finally {
      stderrSpy.mockRestore();
    }
  });
});
