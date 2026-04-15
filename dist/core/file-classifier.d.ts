/**
 * File classifier for tdd-gate.
 *
 * Classifies file paths as test files, implementation files, or exempt files.
 * Supports 10 programming languages.
 */
import type { LanguageDefinition, TddGateConfig } from '../types.js';
export type FileClassification = {
    type: 'exempt';
    reason: string;
} | {
    type: 'test';
    language: string;
} | {
    type: 'impl';
    language: string;
    expectedTests: string[];
} | {
    type: 'unknown';
};
export declare const DEFAULT_EXEMPT_EXTENSIONS: string[];
export declare const LANGUAGES: LanguageDefinition[];
export declare function classifyFile(filePath: string, config: TddGateConfig): FileClassification;
/**
 * Walk up from `startDir` looking for a project root marker (.git,
 * tdd-gate.config.json, or package.json). Returns the root directory path
 * or null if not found within MAX_ROOT_SEARCH_DEPTH levels.
 */
export declare function findProjectRoot(startDir: string): string | null;
export declare function getExpectedTestPaths(implPath: string, config: TddGateConfig): string[];
//# sourceMappingURL=file-classifier.d.ts.map