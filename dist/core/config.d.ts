/**
 * Config loader — loads and merges user configuration with built-in defaults.
 */
import type { TddGateConfig } from '../types.js';
export declare const DEFAULT_CONFIG: TddGateConfig;
/**
 * Load and deep-merge user config from `tdd-gate.config.json` in `cwd`.
 * Returns DEFAULT_CONFIG if file is missing, unreadable, or invalid JSON.
 * Never throws.
 */
export declare function loadConfig(cwd: string): TddGateConfig;
//# sourceMappingURL=config.d.ts.map