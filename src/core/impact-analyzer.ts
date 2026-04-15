/**
 * Impact analyzer for tdd-gate.
 *
 * Generates regex patterns (grep -E compatible) to find files that import
 * a given module, supporting all 10 languages defined in file-classifier.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { ImpactResult } from '../types.js';
import { LANGUAGES } from './file-classifier.js';

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
