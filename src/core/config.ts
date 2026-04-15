/**
 * Config loader — loads and merges user configuration with built-in defaults.
 */

import fs from 'fs';
import path from 'path';
import type { TddGateConfig } from '../types.js';

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIG: TddGateConfig = {
  languages: {
    python:     { enabled: true },
    typescript: { enabled: true },
    javascript: { enabled: true },
    tsx:        { enabled: true },
    jsx:        { enabled: true },
    kotlin:     { enabled: true },
    java:       { enabled: true },
    go:         { enabled: true },
    rust:       { enabled: true },
    csharp:     { enabled: true },
  },
  exempt: {
    extensions: [
      '.json', '.md', '.yaml', '.yml', '.toml', '.lock',
      '.env', '.gitignore', '.dockerignore', '.editorconfig',
      '.txt', '.csv', '.svg', '.png', '.jpg', '.gif', '.ico',
      '.woff', '.woff2', '.ttf', '.eot',
    ],
    paths: [],
  },
  bashDetection: true,
  completionAudit: true,
  circuitBreaker: {
    preToolUse: 1000,
    stop: 20,
  },
  testCommands: [],
  testDirs: ['tests', 'test', 'spec', '__tests__'],
  impactAnalysis: true,
  impactAnalysisMaxFiles: 500,
  impactAnalysisTimeout: 5000,
};

// ---------------------------------------------------------------------------
// Config merge helpers
// ---------------------------------------------------------------------------

/** Return `user[key]` if it matches `expectedType`, otherwise `fallback`. */
function override<T>(user: Record<string, unknown>, key: string, expectedType: string, fallback: T): T {
  return typeof user[key] === expectedType ? (user[key] as T) : fallback;
}

/** Return `user[key]` if it is an array, otherwise `fallback`. */
function overrideArray<T>(user: Record<string, unknown>, key: string, fallback: T[]): T[] {
  return Array.isArray(user[key]) ? (user[key] as T[]) : fallback;
}

/** Return true if `value` is a non-null, non-array plain object. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Config loader
// ---------------------------------------------------------------------------

/**
 * Load and deep-merge user config from `tdd-gate.config.json` in `cwd`.
 * Returns DEFAULT_CONFIG if file is missing, unreadable, or invalid JSON.
 * Never throws.
 */
export function loadConfig(cwd: string): TddGateConfig {
  try {
    const configPath = path.join(cwd, 'tdd-gate.config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);

    if (!isPlainObject(parsed)) return DEFAULT_CONFIG;

    const user = parsed;

    // Deep merge languages: per-language override
    const languages = { ...DEFAULT_CONFIG.languages };
    if (isPlainObject(user['languages'])) {
      for (const [lang, cfg] of Object.entries(user['languages'])) {
        if (isPlainObject(cfg)) {
          languages[lang] = {
            ...DEFAULT_CONFIG.languages[lang],
            enabled: typeof cfg['enabled'] === 'boolean'
              ? cfg['enabled']
              : (DEFAULT_CONFIG.languages[lang]?.enabled ?? true),
          };
        }
      }
    }

    // exempt: user values REPLACE defaults for extensions and paths
    const exempt = { ...DEFAULT_CONFIG.exempt };
    if (isPlainObject(user['exempt'])) {
      if (Array.isArray(user['exempt']['extensions'])) {
        exempt.extensions = user['exempt']['extensions'] as string[];
      }
      if (Array.isArray(user['exempt']['paths'])) {
        exempt.paths = user['exempt']['paths'] as string[];
      }
    }

    // circuitBreaker: per-field merge
    const circuitBreaker = { ...DEFAULT_CONFIG.circuitBreaker };
    if (isPlainObject(user['circuitBreaker'])) {
      if (typeof user['circuitBreaker']['preToolUse'] === 'number') {
        circuitBreaker.preToolUse = user['circuitBreaker']['preToolUse'];
      }
      if (typeof user['circuitBreaker']['stop'] === 'number') {
        circuitBreaker.stop = user['circuitBreaker']['stop'];
      }
    }

    return {
      languages,
      exempt,
      bashDetection:          override(user, 'bashDetection', 'boolean', DEFAULT_CONFIG.bashDetection),
      completionAudit:        override(user, 'completionAudit', 'boolean', DEFAULT_CONFIG.completionAudit),
      circuitBreaker,
      testCommands:           overrideArray(user, 'testCommands', DEFAULT_CONFIG.testCommands),
      testDirs:               overrideArray(user, 'testDirs', DEFAULT_CONFIG.testDirs),
      impactAnalysis:         override(user, 'impactAnalysis', 'boolean', DEFAULT_CONFIG.impactAnalysis),
      impactAnalysisMaxFiles: override(user, 'impactAnalysisMaxFiles', 'number', DEFAULT_CONFIG.impactAnalysisMaxFiles),
      impactAnalysisTimeout:  override(user, 'impactAnalysisTimeout', 'number', DEFAULT_CONFIG.impactAnalysisTimeout),
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}
