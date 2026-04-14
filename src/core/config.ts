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
};

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

    // Must be a plain object (not array, string, null, etc.)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return DEFAULT_CONFIG;
    }

    const user = parsed as Record<string, unknown>;

    // Deep merge languages: per-language override
    const languages = { ...DEFAULT_CONFIG.languages };
    if (typeof user['languages'] === 'object' && user['languages'] !== null && !Array.isArray(user['languages'])) {
      const userLangs = user['languages'] as Record<string, unknown>;
      for (const [lang, cfg] of Object.entries(userLangs)) {
        if (typeof cfg === 'object' && cfg !== null && !Array.isArray(cfg)) {
          const langCfg = cfg as Record<string, unknown>;
          languages[lang] = {
            ...DEFAULT_CONFIG.languages[lang],
            enabled: typeof langCfg['enabled'] === 'boolean'
              ? langCfg['enabled']
              : (DEFAULT_CONFIG.languages[lang]?.enabled ?? true),
          };
        }
      }
    }

    // exempt: user values REPLACE defaults for extensions and paths
    const exempt = { ...DEFAULT_CONFIG.exempt };
    if (typeof user['exempt'] === 'object' && user['exempt'] !== null && !Array.isArray(user['exempt'])) {
      const userExempt = user['exempt'] as Record<string, unknown>;
      if (Array.isArray(userExempt['extensions'])) {
        exempt.extensions = userExempt['extensions'] as string[];
      }
      if (Array.isArray(userExempt['paths'])) {
        exempt.paths = userExempt['paths'] as string[];
      }
    }

    // Scalar overrides
    const bashDetection = typeof user['bashDetection'] === 'boolean'
      ? user['bashDetection']
      : DEFAULT_CONFIG.bashDetection;

    const completionAudit = typeof user['completionAudit'] === 'boolean'
      ? user['completionAudit']
      : DEFAULT_CONFIG.completionAudit;

    // circuitBreaker: per-field merge
    const circuitBreaker = { ...DEFAULT_CONFIG.circuitBreaker };
    if (typeof user['circuitBreaker'] === 'object' && user['circuitBreaker'] !== null && !Array.isArray(user['circuitBreaker'])) {
      const userCb = user['circuitBreaker'] as Record<string, unknown>;
      if (typeof userCb['preToolUse'] === 'number') {
        circuitBreaker.preToolUse = userCb['preToolUse'];
      }
      if (typeof userCb['stop'] === 'number') {
        circuitBreaker.stop = userCb['stop'];
      }
    }

    return { languages, exempt, bashDetection, completionAudit, circuitBreaker };
  } catch {
    return DEFAULT_CONFIG;
  }
}
