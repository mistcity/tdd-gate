/**
 * Tests for config loader — DEFAULT_CONFIG and loadConfig().
 * Written first (TDD RED phase).
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DEFAULT_CONFIG, loadConfig } from './config.js';
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

  it('has empty exempt paths by default', () => {
    expect(DEFAULT_CONFIG.exempt.paths).toEqual([]);
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

  it('returns DEFAULT_CONFIG for invalid JSON', () => {
    fs.writeFileSync(path.join(tmpDir, 'tdd-gate.config.json'), '{ invalid json !!');

    const result = loadConfig(tmpDir);

    expect(result).toEqual(DEFAULT_CONFIG);
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
});
