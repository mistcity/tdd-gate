/**
 * Impact analyzer for tdd-gate.
 *
 * Generates regex patterns (grep -E compatible) to find files that import
 * a given module, supporting all 10 languages defined in file-classifier.
 */
import type { ImpactResult, TddGateConfig } from '../types.js';
import type { Journal } from './journal.js';
export declare const LANGUAGE_BY_EXT: Map<string, string>;
/**
 * Generates a grep -E compatible regex pattern that matches import statements
 * for a given module basename in the specified language.
 *
 * @param basename - The module name without extension (e.g. "auth", "Button")
 * @param language - The language name (e.g. "typescript", "python", "go")
 * @returns A regex string suitable for grep -E
 */
export declare function buildImportPattern(basename: string, language: string): string;
interface FindDependentsOptions {
    maxFiles: number;
    timeout: number;
}
/**
 * Uses grep to find files in the project that import a given module.
 *
 * @param filePath    - Absolute path of the file whose dependents we want
 * @param language    - Language name (e.g. "typescript", "python")
 * @param projectRoot - Root directory to search in
 * @param options     - maxFiles limit and timeout in ms
 * @returns Array of absolute file paths that import the given module (fail-open: returns [] on error)
 */
export declare function findDependents(filePath: string, language: string, projectRoot: string, options: FindDependentsOptions): string[];
/**
 * Orchestrator that ties findDependents with journal checking.
 *
 * For each changed implementation file, finds files that depend on it and
 * checks whether their corresponding tests have been written. Returns an
 * array of ImpactResult objects describing uncovered dependents.
 *
 * Returns [] early when:
 * - config.impactAnalysis is disabled
 * - journal.hasTestRun() is true (a full test suite was executed)
 */
export declare function analyzeImpact(changedImplFiles: string[], projectRoot: string, config: TddGateConfig, journal: Journal): ImpactResult[];
export {};
//# sourceMappingURL=impact-analyzer.d.ts.map