/**
 * Impact analyzer for tdd-gate.
 *
 * Generates regex patterns (grep -E compatible) to find files that import
 * a given module, supporting all 10 languages defined in file-classifier.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { ImpactResult, LanguageDefinition, TddGateConfig } from '../types.js';
import { LANGUAGES, classifyFile } from './file-classifier.js';
import type { Journal } from './journal.js';

// ---------------------------------------------------------------------------
// LANGUAGE_BY_EXT — lookup map from extension to language name
// ---------------------------------------------------------------------------

export const LANGUAGE_BY_EXT: Map<string, string> = new Map();

for (const lang of LANGUAGES) {
  for (const ext of lang.extensions) {
    LANGUAGE_BY_EXT.set(ext, lang.name);
  }
}

// ---------------------------------------------------------------------------
// buildImportPattern
// ---------------------------------------------------------------------------

/**
 * Generates a grep -E compatible regex pattern that matches import statements
 * for a given module basename in the specified language.
 *
 * @param basename - The module name without extension (e.g. "auth", "Button")
 * @param language - The language name (e.g. "typescript", "python", "go")
 * @returns A regex string suitable for grep -E
 */
export function buildImportPattern(basename: string, language: string): string {
  switch (language) {
    case 'typescript':
    case 'javascript':
    case 'tsx':
    case 'jsx': {
      // ES import:  from '...<basename>'  or  from "...<basename>"
      const esImport = `from\\s+['"].*\\b${basename}['"]`;
      // CommonJS:   require('...<basename>')  or  require("...<basename>")
      const cjsRequire = `require\\(\\s*['"].*\\b${basename}['"]\\s*\\)`;
      return `(${esImport}|${cjsRequire})`;
    }

    case 'python': {
      // from .?<basename> import ...
      const fromImport = `from\\s+\\.?${basename}\\s+import`;
      // import ...<basename>...
      const directImport = `import\\s+.*\\b${basename}\\b`;
      return `(${fromImport}|${directImport})`;
    }

    case 'go': {
      // ".../<basename>"
      return `["'].*/${basename}["']`;
    }

    case 'kotlin':
    case 'java': {
      // import ....<basename>
      return `import\\s+.*\\.${basename}\\b`;
    }

    case 'rust': {
      // use ...::<basename>  or  mod <basename>
      const useStmt = `use\\s+.*::${basename}\\b`;
      const modStmt = `mod\\s+${basename}\\b`;
      return `(${useStmt}|${modStmt})`;
    }

    case 'csharp': {
      // using ....<basename>
      return `using\\s+.*\\.${basename}\\b`;
    }

    default:
      return basename;
  }
}

// ---------------------------------------------------------------------------
// findDependents
// ---------------------------------------------------------------------------

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
export function findDependents(
  filePath: string,
  language: string,
  projectRoot: string,
  options: FindDependentsOptions,
): string[] {
  const basename = path.basename(filePath, path.extname(filePath));
  const ext = path.extname(filePath);
  const pattern = buildImportPattern(basename, language);

  try {
    const stdout = execFileSync(
      'grep',
      ['-rl', '--include', `*${ext}`, '-E', pattern, projectRoot],
      {
        timeout: options.timeout,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );

    const files = stdout.trim().split('\n').filter(Boolean);

    // Filter out the file itself
    const selfResolved = path.resolve(filePath);

    // Look up the language definition for isTestFile
    const langDef: LanguageDefinition | undefined = (() => {
      const langName = LANGUAGE_BY_EXT.get(ext);
      if (!langName) return undefined;
      return LANGUAGES.find((l) => l.name === langName);
    })();

    const filtered = files.filter((f) => {
      // Exclude the file itself
      if (path.resolve(f) === selfResolved) return false;

      // Exclude test files
      if (langDef && langDef.isTestFile(path.basename(f))) return false;

      return true;
    });

    // Limit to maxFiles
    return filtered.slice(0, options.maxFiles);
  } catch {
    // Fail-open: grep exit code 1 means "no matches", other errors also return []
    return [];
  }
}

// ---------------------------------------------------------------------------
// analyzeImpact — orchestrator
// ---------------------------------------------------------------------------

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
export function analyzeImpact(
  changedImplFiles: string[],
  projectRoot: string,
  config: TddGateConfig,
  journal: Journal,
): ImpactResult[] {
  // Early exit: feature disabled
  if (!config.impactAnalysis) return [];

  // Early exit: a test suite was run, no need to check individual coverage
  if (journal.hasTestRun()) return [];

  const results: ImpactResult[] = [];

  for (const filePath of changedImplFiles) {
    const ext = path.extname(filePath);
    const language = LANGUAGE_BY_EXT.get(ext);

    // Unknown language — skip
    if (!language) continue;

    const dependents = findDependents(filePath, language, projectRoot, {
      maxFiles: config.impactAnalysisMaxFiles,
      timeout: config.impactAnalysisTimeout,
    });

    const uncoveredDependents: string[] = [];
    const missingTests: string[] = [];

    for (const dep of dependents) {
      const classification = classifyFile(dep, config);

      // Only care about impl files — test files and exempt files are skipped
      if (classification.type !== 'impl') continue;

      // Check if tests for this dependent have been written
      if (!journal.hasTestFor(classification.expectedTests)) {
        uncoveredDependents.push(dep);
        missingTests.push(...classification.expectedTests);
      }
    }

    results.push({
      filePath,
      dependents: uncoveredDependents,
      missingTests,
    });
  }

  return results;
}
