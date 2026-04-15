/**
 * Impact analyzer for tdd-gate.
 *
 * Generates regex patterns (grep -E compatible) to find files that import
 * a given module, supporting all 10 languages defined in file-classifier.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { ImpactResult, TddGateConfig } from '../types.js';
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
// escapeRegex — prevent regex injection from special chars in filenames
// ---------------------------------------------------------------------------

/**
 * Escapes special regex characters in a string so it can be safely
 * interpolated into a regex pattern (grep -E compatible).
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  const escaped = escapeRegex(basename);

  switch (language) {
    case 'typescript':
    case 'javascript':
    case 'tsx':
    case 'jsx': {
      // ES import:  from '...<basename>'  or  from "...<basename>"
      const esImport = `from\\s+['"].*\\b${escaped}['"]`;
      // CommonJS:   require('...<basename>')  or  require("...<basename>")
      const cjsRequire = `require\\(\\s*['"].*\\b${escaped}['"]\\s*\\)`;
      return `(${esImport}|${cjsRequire})`;
    }

    case 'python': {
      // from .{0,3}(pkg.)*<basename> import ...
      // Handles: from auth, from .auth, from ..auth, from ...auth,
      //          from mypackage.auth, from ..utils.auth
      const fromImport = `from\\s+\\.{0,3}(\\w+\\.)*${escaped}\\s+import`;
      // import ...<basename>...
      const directImport = `import\\s+.*\\b${escaped}\\b`;
      return `(${fromImport}|${directImport})`;
    }

    case 'go': {
      // ".../<basename>"
      return `["'].*/${escaped}["']`;
    }

    case 'kotlin':
    case 'java': {
      // import ....<basename>
      return `import\\s+.*\\.${escaped}\\b`;
    }

    case 'rust': {
      // use ...::<basename>  or  mod <basename>
      const useStmt = `use\\s+.*::${escaped}\\b`;
      const modStmt = `mod\\s+${escaped}\\b`;
      return `(${useStmt}|${modStmt})`;
    }

    case 'csharp': {
      // using ....<basename>
      return `using\\s+.*\\.${escaped}\\b`;
    }

    default:
      return escaped;
  }
}

// ---------------------------------------------------------------------------
// GENERIC_BASENAMES — files whose basename produces too many false positives
// ---------------------------------------------------------------------------

/**
 * Basenames that are so common (barrel exports, utility files) that grepping
 * for `from.*\bindex\b` matches nearly every file in a project. Impact
 * analysis on these produces noise, not signal — skip entirely.
 */
export const GENERIC_BASENAMES = new Set([
  'index', 'main', 'mod', 'lib',
  'utils', 'util', 'helpers', 'helper',
  'types', 'constants', 'config',
  'index.d', // TypeScript declaration barrel
]);

// ---------------------------------------------------------------------------
// findDependents
// ---------------------------------------------------------------------------

/** JS/TS extensions share a single search family (cross-extension imports). */
const JS_TS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const JS_TS_SET = new Set(JS_TS_EXTENSIONS);

/** Directories excluded from grep to avoid false positives and timeouts. */
const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', 'vendor', '__pycache__', '.venv', 'venv'];

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
  const ext = path.extname(filePath);
  const basename = path.basename(filePath, ext);

  // Skip files with overly generic basenames — they produce massive false positives
  if (GENERIC_BASENAMES.has(basename)) return [];

  const pattern = buildImportPattern(basename, language);

  // JS/TS files share a search family; other languages search their own extension
  const searchExts = JS_TS_SET.has(ext) ? JS_TS_EXTENSIONS : [ext];
  const includeArgs = searchExts.flatMap((e) => ['--include', `*${e}`]);
  const excludeArgs = EXCLUDE_DIRS.flatMap((d) => ['--exclude-dir', d]);

  try {
    const stdout = execFileSync(
      'grep',
      ['-rl', ...excludeArgs, ...includeArgs, '-E', pattern, projectRoot],
      {
        timeout: options.timeout,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );

    const files = stdout.trim().split('\n').filter(Boolean);
    const selfResolved = path.resolve(filePath);
    const langDef = LANGUAGES.find((l) => l.name === LANGUAGE_BY_EXT.get(ext));

    const filtered = files.filter((f) => {
      if (path.resolve(f) === selfResolved) return false;
      if (langDef?.isTestFile(path.basename(f))) return false;
      return true;
    });

    return filtered.slice(0, options.maxFiles);
  } catch (err: unknown) {
    // grep exit code 1 = no matches
    if (err && typeof err === 'object' && 'status' in err && (err as any).status === 1) {
      return [];
    }
    process.stderr.write(
      `[tdd-gate] findDependents failed for ${path.basename(filePath)} (fail-open): ${err instanceof Error ? err.message : String(err)}\n`
    );
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
        // Push only the first expected test name (1:1 with dependents for message formatting)
        missingTests.push(classification.expectedTests[0] ?? path.basename(dep));
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
