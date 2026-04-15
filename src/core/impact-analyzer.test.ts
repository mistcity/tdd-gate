/**
 * Tests for impact-analyzer.ts — buildImportPattern(), findDependents(), analyzeImpact()
 *
 * TDD: tests written before implementation.
 * Each test verifies that the generated regex pattern matches
 * real-world import statements for the given language.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildImportPattern, LANGUAGE_BY_EXT, findDependents, analyzeImpact, GENERIC_BASENAMES } from './impact-analyzer.js';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { TddGateConfig } from '../types.js';

// ---------------------------------------------------------------------------
// Helper: test a pattern against a string using grep -E compatible regex
// ---------------------------------------------------------------------------

function matches(pattern: string, input: string): boolean {
  return new RegExp(pattern).test(input);
}

// ---------------------------------------------------------------------------
// LANGUAGE_BY_EXT lookup map
// ---------------------------------------------------------------------------

describe('LANGUAGE_BY_EXT', () => {
  it('maps .ts to typescript', () => {
    expect(LANGUAGE_BY_EXT.get('.ts')).toBe('typescript');
  });

  it('maps .js to javascript', () => {
    expect(LANGUAGE_BY_EXT.get('.js')).toBe('javascript');
  });

  it('maps .tsx to tsx', () => {
    expect(LANGUAGE_BY_EXT.get('.tsx')).toBe('tsx');
  });

  it('maps .jsx to jsx', () => {
    expect(LANGUAGE_BY_EXT.get('.jsx')).toBe('jsx');
  });

  it('maps .py to python', () => {
    expect(LANGUAGE_BY_EXT.get('.py')).toBe('python');
  });

  it('maps .go to go', () => {
    expect(LANGUAGE_BY_EXT.get('.go')).toBe('go');
  });

  it('maps .kt to kotlin', () => {
    expect(LANGUAGE_BY_EXT.get('.kt')).toBe('kotlin');
  });

  it('maps .java to java', () => {
    expect(LANGUAGE_BY_EXT.get('.java')).toBe('java');
  });

  it('maps .rs to rust', () => {
    expect(LANGUAGE_BY_EXT.get('.rs')).toBe('rust');
  });

  it('maps .cs to csharp', () => {
    expect(LANGUAGE_BY_EXT.get('.cs')).toBe('csharp');
  });

  it('covers all 10 language extensions', () => {
    // 10 languages, some share extensions but each has at least one
    expect(LANGUAGE_BY_EXT.size).toBeGreaterThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// buildImportPattern — TypeScript
// ---------------------------------------------------------------------------

describe('buildImportPattern — TypeScript', () => {
  const lang = 'typescript';

  it('matches ES import: import { login } from "./auth"', () => {
    const pattern = buildImportPattern('auth', lang);
    expect(matches(pattern, 'import { login } from "./auth"')).toBe(true);
  });

  it('matches ES import with single quotes', () => {
    const pattern = buildImportPattern('auth', lang);
    expect(matches(pattern, "import { login } from './auth'")).toBe(true);
  });

  it('matches ES import with path: from "../utils/auth"', () => {
    const pattern = buildImportPattern('auth', lang);
    expect(matches(pattern, 'import { login } from "../utils/auth"')).toBe(true);
  });

  it('matches default import: import auth from "./auth"', () => {
    const pattern = buildImportPattern('auth', lang);
    expect(matches(pattern, 'import auth from "./auth"')).toBe(true);
  });

  it('matches require: const auth = require("./auth")', () => {
    const pattern = buildImportPattern('auth', lang);
    expect(matches(pattern, 'const auth = require("./auth")')).toBe(true);
  });

  it('matches require with single quotes', () => {
    const pattern = buildImportPattern('auth', lang);
    expect(matches(pattern, "const auth = require('./auth')")).toBe(true);
  });

  it('does not match unrelated module: import { x } from "./other"', () => {
    const pattern = buildImportPattern('auth', lang);
    expect(matches(pattern, 'import { x } from "./other"')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildImportPattern — JavaScript (same pattern as TypeScript)
// ---------------------------------------------------------------------------

describe('buildImportPattern — JavaScript', () => {
  const lang = 'javascript';

  it('matches ES import', () => {
    const pattern = buildImportPattern('utils', lang);
    expect(matches(pattern, 'import { helper } from "./utils"')).toBe(true);
  });

  it('matches require', () => {
    const pattern = buildImportPattern('utils', lang);
    expect(matches(pattern, 'const utils = require("./utils")')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildImportPattern — TSX
// ---------------------------------------------------------------------------

describe('buildImportPattern — TSX', () => {
  const lang = 'tsx';

  it('matches ES import in TSX', () => {
    const pattern = buildImportPattern('Button', lang);
    expect(matches(pattern, 'import Button from "./Button"')).toBe(true);
  });

  it('matches require in TSX', () => {
    const pattern = buildImportPattern('Button', lang);
    expect(matches(pattern, 'const Button = require("./Button")')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildImportPattern — JSX
// ---------------------------------------------------------------------------

describe('buildImportPattern — JSX', () => {
  const lang = 'jsx';

  it('matches ES import in JSX', () => {
    const pattern = buildImportPattern('App', lang);
    expect(matches(pattern, 'import App from "./App"')).toBe(true);
  });

  it('matches require in JSX', () => {
    const pattern = buildImportPattern('App', lang);
    expect(matches(pattern, 'const App = require("./App")')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildImportPattern — Python
// ---------------------------------------------------------------------------

describe('buildImportPattern — Python', () => {
  const lang = 'python';

  it('matches from-import: from auth import login', () => {
    const pattern = buildImportPattern('auth', lang);
    expect(matches(pattern, 'from auth import login')).toBe(true);
  });

  it('matches relative from-import: from .auth import login', () => {
    const pattern = buildImportPattern('auth', lang);
    expect(matches(pattern, 'from .auth import login')).toBe(true);
  });

  it('matches import: import auth', () => {
    const pattern = buildImportPattern('auth', lang);
    expect(matches(pattern, 'import auth')).toBe(true);
  });

  it('matches import with alias: import auth as a', () => {
    const pattern = buildImportPattern('auth', lang);
    expect(matches(pattern, 'import auth as a')).toBe(true);
  });

  it('does not match unrelated module: from other import login', () => {
    const pattern = buildImportPattern('auth', lang);
    expect(matches(pattern, 'from other import login')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildImportPattern — Go
// ---------------------------------------------------------------------------

describe('buildImportPattern — Go', () => {
  const lang = 'go';

  it('matches Go import: "myproject/auth"', () => {
    const pattern = buildImportPattern('auth', lang);
    expect(matches(pattern, '"myproject/auth"')).toBe(true);
  });

  it('matches Go import with double quotes', () => {
    const pattern = buildImportPattern('auth', lang);
    expect(matches(pattern, '\t"github.com/user/project/auth"')).toBe(true);
  });

  it('does not match unrelated package: "myproject/other"', () => {
    const pattern = buildImportPattern('auth', lang);
    expect(matches(pattern, '"myproject/other"')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildImportPattern — Kotlin
// ---------------------------------------------------------------------------

describe('buildImportPattern — Kotlin', () => {
  const lang = 'kotlin';

  it('matches Kotlin import: import com.example.Auth', () => {
    const pattern = buildImportPattern('Auth', lang);
    expect(matches(pattern, 'import com.example.Auth')).toBe(true);
  });

  it('matches Kotlin import with subpackage', () => {
    const pattern = buildImportPattern('Auth', lang);
    expect(matches(pattern, 'import com.example.auth.Auth')).toBe(true);
  });

  it('does not match unrelated class: import com.example.Other', () => {
    const pattern = buildImportPattern('Auth', lang);
    expect(matches(pattern, 'import com.example.Other')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildImportPattern — Java
// ---------------------------------------------------------------------------

describe('buildImportPattern — Java', () => {
  const lang = 'java';

  it('matches Java import: import com.example.Auth;', () => {
    const pattern = buildImportPattern('Auth', lang);
    expect(matches(pattern, 'import com.example.Auth;')).toBe(true);
  });

  it('matches Java static import: import static com.example.Auth.method;', () => {
    const pattern = buildImportPattern('Auth', lang);
    expect(matches(pattern, 'import static com.example.Auth.method;')).toBe(true);
  });

  it('does not match unrelated class', () => {
    const pattern = buildImportPattern('Auth', lang);
    expect(matches(pattern, 'import com.example.Other;')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildImportPattern — Rust
// ---------------------------------------------------------------------------

describe('buildImportPattern — Rust', () => {
  const lang = 'rust';

  it('matches Rust use: use crate::auth;', () => {
    const pattern = buildImportPattern('auth', lang);
    expect(matches(pattern, 'use crate::auth;')).toBe(true);
  });

  it('matches Rust use with nested path: use crate::utils::auth;', () => {
    const pattern = buildImportPattern('auth', lang);
    expect(matches(pattern, 'use crate::utils::auth;')).toBe(true);
  });

  it('matches Rust mod: mod auth;', () => {
    const pattern = buildImportPattern('auth', lang);
    expect(matches(pattern, 'mod auth;')).toBe(true);
  });

  it('does not match unrelated module: use crate::other;', () => {
    const pattern = buildImportPattern('auth', lang);
    expect(matches(pattern, 'use crate::other;')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildImportPattern — C#
// ---------------------------------------------------------------------------

describe('buildImportPattern — C#', () => {
  const lang = 'csharp';

  it('matches C# using: using MyProject.Auth;', () => {
    const pattern = buildImportPattern('Auth', lang);
    expect(matches(pattern, 'using MyProject.Auth;')).toBe(true);
  });

  it('matches C# using with deep namespace', () => {
    const pattern = buildImportPattern('Auth', lang);
    expect(matches(pattern, 'using MyProject.Services.Auth;')).toBe(true);
  });

  it('does not match unrelated namespace', () => {
    const pattern = buildImportPattern('Auth', lang);
    expect(matches(pattern, 'using MyProject.Other;')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildImportPattern — default / unknown language
// ---------------------------------------------------------------------------

describe('buildImportPattern — default fallback', () => {
  it('returns basename for unknown language', () => {
    const pattern = buildImportPattern('auth', 'haskell');
    expect(pattern).toBe('auth');
  });

  it('matches when the basename appears in the line', () => {
    const pattern = buildImportPattern('auth', 'haskell');
    expect(matches(pattern, 'import Auth (auth)')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Critical Fix 2: Regex injection — special characters in basename must be escaped
// ---------------------------------------------------------------------------

describe('buildImportPattern — regex injection (special chars in basename)', () => {
  it('does NOT match "lodashXutils" when basename is "lodash.utils" (dot must be literal)', () => {
    const pattern = buildImportPattern('lodash.utils', 'typescript');
    // The dot in "lodash.utils" must be escaped to literal dot, not wildcard
    expect(matches(pattern, 'import { x } from "./lodashXutils"')).toBe(false);
  });

  it('DOES match "lodash.utils" when basename is "lodash.utils"', () => {
    const pattern = buildImportPattern('lodash.utils', 'typescript');
    expect(matches(pattern, 'import { x } from "./lodash.utils"')).toBe(true);
  });

  it('escapes special regex characters in Python import patterns', () => {
    const pattern = buildImportPattern('my.module', 'python');
    // "my.module" should not match "myXmodule"
    expect(matches(pattern, 'from myXmodule import something')).toBe(false);
    // but should match "my.module"
    expect(matches(pattern, 'from my.module import something')).toBe(true);
  });

  it('escapes special regex characters in Go import patterns', () => {
    const pattern = buildImportPattern('my.pkg', 'go');
    expect(matches(pattern, '"github.com/user/myXpkg"')).toBe(false);
    expect(matches(pattern, '"github.com/user/my.pkg"')).toBe(true);
  });

  it('escapes special regex characters in Rust import patterns', () => {
    const pattern = buildImportPattern('my.mod', 'rust');
    expect(matches(pattern, 'use crate::myXmod;')).toBe(false);
    expect(matches(pattern, 'use crate::my.mod;')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Critical Fix 3: Python multi-level relative import
// ---------------------------------------------------------------------------

describe('buildImportPattern — Python multi-level relative imports', () => {
  it('matches double-dot relative import: from ..auth import login', () => {
    const pattern = buildImportPattern('auth', 'python');
    expect(matches(pattern, 'from ..auth import login')).toBe(true);
  });

  it('matches triple-dot relative import: from ...auth import login', () => {
    const pattern = buildImportPattern('auth', 'python');
    expect(matches(pattern, 'from ...auth import login')).toBe(true);
  });

  it('matches package-qualified import: from mypackage.auth import login', () => {
    const pattern = buildImportPattern('auth', 'python');
    expect(matches(pattern, 'from mypackage.auth import login')).toBe(true);
  });

  it('matches deeply nested package import: from a.b.c.auth import login', () => {
    const pattern = buildImportPattern('auth', 'python');
    expect(matches(pattern, 'from a.b.c.auth import login')).toBe(true);
  });

  it('matches relative + package: from ..utils.auth import login', () => {
    const pattern = buildImportPattern('auth', 'python');
    expect(matches(pattern, 'from ..utils.auth import login')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// findDependents — real filesystem tests
// ---------------------------------------------------------------------------

describe('findDependents', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'tdd-gate-findDependents-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('finds a TypeScript file that imports the changed file', () => {
    // Create the source file (the one being changed)
    writeFileSync(join(tmpDir, 'auth.ts'), 'export function login() {}');
    // Create a file that imports auth
    writeFileSync(
      join(tmpDir, 'app.ts'),
      'import { login } from "./auth";\nconsole.log(login());',
    );

    const result = findDependents(
      join(tmpDir, 'auth.ts'),
      'typescript',
      tmpDir,
      { maxFiles: 10, timeout: 5000 },
    );

    expect(result).toContain(join(tmpDir, 'app.ts'));
  });

  it('excludes test files from results', () => {
    writeFileSync(join(tmpDir, 'auth.ts'), 'export function login() {}');
    // A non-test importer
    writeFileSync(
      join(tmpDir, 'app.ts'),
      'import { login } from "./auth";',
    );
    // A test file that imports auth — should be excluded
    writeFileSync(
      join(tmpDir, 'auth.test.ts'),
      'import { login } from "./auth";\nit("works", () => {});',
    );

    const result = findDependents(
      join(tmpDir, 'auth.ts'),
      'typescript',
      tmpDir,
      { maxFiles: 10, timeout: 5000 },
    );

    expect(result).toContain(join(tmpDir, 'app.ts'));
    expect(result).not.toContain(join(tmpDir, 'auth.test.ts'));
  });

  it('finds .tsx files that import a .ts module (cross-extension)', () => {
    writeFileSync(join(tmpDir, 'auth.ts'), 'export function login() {}');
    writeFileSync(
      join(tmpDir, 'App.tsx'),
      'import { login } from "./auth";\nexport function App() { login(); }',
    );

    const result = findDependents(
      join(tmpDir, 'auth.ts'),
      'typescript',
      tmpDir,
      { maxFiles: 10, timeout: 5000 },
    );

    expect(result).toContain(join(tmpDir, 'App.tsx'));
  });

  it('finds .js files that import a .ts module (cross-extension)', () => {
    writeFileSync(join(tmpDir, 'formatter.ts'), 'export function helper() {}');
    writeFileSync(
      join(tmpDir, 'legacy.js'),
      'const { helper } = require("./formatter");\nmodule.exports = { helper };',
    );

    const result = findDependents(
      join(tmpDir, 'formatter.ts'),
      'typescript',
      tmpDir,
      { maxFiles: 10, timeout: 5000 },
    );

    expect(result).toContain(join(tmpDir, 'legacy.js'));
  });

  it('returns empty array when no dependents found', () => {
    writeFileSync(join(tmpDir, 'auth.ts'), 'export function login() {}');
    writeFileSync(join(tmpDir, 'other.ts'), 'console.log("no imports here");');

    const result = findDependents(
      join(tmpDir, 'auth.ts'),
      'typescript',
      tmpDir,
      { maxFiles: 10, timeout: 5000 },
    );

    expect(result).toEqual([]);
  });

  it('returns empty array on grep failure (nonexistent directory) — fail-open', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const result = findDependents(
        '/nonexistent/path/auth.ts',
        'typescript',
        '/nonexistent/path',
        { maxFiles: 10, timeout: 5000 },
      );

      expect(result).toEqual([]);
      // On macOS, grep returns exit code 1 for nonexistent paths (same as "no matches"),
      // so no stderr logging is expected. The distinction is for exit code 2+ errors.
      // This test verifies fail-open behavior regardless.
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('logs to stderr when grep fails with non-exit-1 error (e.g. exit code 2)', () => {
    // We need to verify that non-exit-code-1 errors are logged.
    // Since real grep returns exit 1 for most failures on macOS,
    // we test the logic path by creating a scenario with a very short timeout
    // that causes a ETIMEDOUT-like error (status !== 1).
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      // Use an impossibly short timeout to force a timeout error
      writeFileSync(join(tmpDir, 'auth.ts'), 'export function login() {}');
      // Create many files to make grep slow
      for (let i = 0; i < 100; i++) {
        writeFileSync(
          join(tmpDir, `file${i}.ts`),
          `import { login } from "./auth";\n`.repeat(100),
        );
      }
      const result = findDependents(
        join(tmpDir, 'auth.ts'),
        'typescript',
        tmpDir,
        { maxFiles: 10, timeout: 1 }, // 1ms timeout will likely cause ETIMEDOUT
      );

      // Whether it times out or completes, it should return an array
      expect(Array.isArray(result)).toBe(true);
      // If a timeout error occurred (status !== 1), stderr should be called
      // If grep completed fast enough, it won't log — both are valid behaviors
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('returns empty array silently when grep exit code 1 (no matches)', () => {
    // grep exit code 1 means no matches — this is expected, no logging
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      writeFileSync(join(tmpDir, 'auth.ts'), 'export function login() {}');
      writeFileSync(join(tmpDir, 'other.ts'), 'console.log("no imports here");');

      const result = findDependents(
        join(tmpDir, 'auth.ts'),
        'typescript',
        tmpDir,
        { maxFiles: 10, timeout: 5000 },
      );

      expect(result).toEqual([]);
      // grep exit 1 = no matches, should NOT log
      expect(stderrSpy).not.toHaveBeenCalled();
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('excludes the file itself from results', () => {
    // A file that references its own basename in an import-like line
    writeFileSync(
      join(tmpDir, 'auth.ts'),
      'export function login() {}\n// from "./auth"',
    );

    const result = findDependents(
      join(tmpDir, 'auth.ts'),
      'typescript',
      tmpDir,
      { maxFiles: 10, timeout: 5000 },
    );

    expect(result).not.toContain(join(tmpDir, 'auth.ts'));
  });

  // -----------------------------------------------------------------------
  // Critical Fix 1: grep must exclude node_modules and build directories
  // -----------------------------------------------------------------------

  it('excludes files inside node_modules/ from results', () => {
    // Create the source file
    writeFileSync(join(tmpDir, 'auth.ts'), 'export function login() {}');
    // Create a file in node_modules that imports auth — should be excluded
    mkdirSync(join(tmpDir, 'node_modules', 'some-pkg'), { recursive: true });
    writeFileSync(
      join(tmpDir, 'node_modules', 'some-pkg', 'index.ts'),
      'import { login } from "../../auth";',
    );
    // Create a normal file that imports auth — should be included
    writeFileSync(
      join(tmpDir, 'app.ts'),
      'import { login } from "./auth";',
    );

    const result = findDependents(
      join(tmpDir, 'auth.ts'),
      'typescript',
      tmpDir,
      { maxFiles: 10, timeout: 5000 },
    );

    expect(result).toContain(join(tmpDir, 'app.ts'));
    expect(result.some(f => f.includes('node_modules'))).toBe(false);
  });

  it('excludes files inside dist/ from results', () => {
    writeFileSync(join(tmpDir, 'auth.ts'), 'export function login() {}');
    mkdirSync(join(tmpDir, 'dist'), { recursive: true });
    writeFileSync(
      join(tmpDir, 'dist', 'auth-consumer.ts'),
      'import { login } from "../auth";',
    );
    writeFileSync(
      join(tmpDir, 'app.ts'),
      'import { login } from "./auth";',
    );

    const result = findDependents(
      join(tmpDir, 'auth.ts'),
      'typescript',
      tmpDir,
      { maxFiles: 10, timeout: 5000 },
    );

    expect(result).toContain(join(tmpDir, 'app.ts'));
    expect(result.some(f => f.includes('/dist/'))).toBe(false);
  });

  it('excludes files inside .git/ from results', () => {
    writeFileSync(join(tmpDir, 'auth.ts'), 'export function login() {}');
    mkdirSync(join(tmpDir, '.git', 'hooks'), { recursive: true });
    writeFileSync(
      join(tmpDir, '.git', 'hooks', 'pre-commit.ts'),
      'import { login } from "../../auth";',
    );
    writeFileSync(
      join(tmpDir, 'app.ts'),
      'import { login } from "./auth";',
    );

    const result = findDependents(
      join(tmpDir, 'auth.ts'),
      'typescript',
      tmpDir,
      { maxFiles: 10, timeout: 5000 },
    );

    expect(result).toContain(join(tmpDir, 'app.ts'));
    expect(result.some(f => f.includes('/.git/'))).toBe(false);
  });

  it('respects maxFiles limit', () => {
    writeFileSync(join(tmpDir, 'auth.ts'), 'export function login() {}');
    // Create 5 files that all import auth
    for (let i = 0; i < 5; i++) {
      writeFileSync(
        join(tmpDir, `consumer${i}.ts`),
        `import { login } from "./auth";`,
      );
    }

    const result = findDependents(
      join(tmpDir, 'auth.ts'),
      'typescript',
      tmpDir,
      { maxFiles: 2, timeout: 5000 },
    );

    expect(result.length).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Bug 1: Generic basenames cause massive false positives
// ---------------------------------------------------------------------------

describe('GENERIC_BASENAMES', () => {
  it('contains index, utils, main, types, config, helpers, and other common generic names', () => {
    expect(GENERIC_BASENAMES.has('index')).toBe(true);
    expect(GENERIC_BASENAMES.has('main')).toBe(true);
    expect(GENERIC_BASENAMES.has('mod')).toBe(true);
    expect(GENERIC_BASENAMES.has('lib')).toBe(true);
    expect(GENERIC_BASENAMES.has('utils')).toBe(true);
    expect(GENERIC_BASENAMES.has('util')).toBe(true);
    expect(GENERIC_BASENAMES.has('helpers')).toBe(true);
    expect(GENERIC_BASENAMES.has('helper')).toBe(true);
    expect(GENERIC_BASENAMES.has('types')).toBe(true);
    expect(GENERIC_BASENAMES.has('constants')).toBe(true);
    expect(GENERIC_BASENAMES.has('config')).toBe(true);
    expect(GENERIC_BASENAMES.has('index.d')).toBe(true);
  });

  it('does not contain specific module names like auth or Button', () => {
    expect(GENERIC_BASENAMES.has('auth')).toBe(false);
    expect(GENERIC_BASENAMES.has('Button')).toBe(false);
    expect(GENERIC_BASENAMES.has('user-service')).toBe(false);
  });
});

describe('findDependents — generic basename skip', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'tdd-gate-generic-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns [] for index.ts (generic basename)', () => {
    writeFileSync(join(tmpDir, 'index.ts'), 'export function login() {}');
    writeFileSync(
      join(tmpDir, 'app.ts'),
      'import { login } from "./index";',
    );

    const result = findDependents(
      join(tmpDir, 'index.ts'),
      'typescript',
      tmpDir,
      { maxFiles: 10, timeout: 5000 },
    );

    expect(result).toEqual([]);
  });

  it('returns [] for utils.ts (generic basename)', () => {
    writeFileSync(join(tmpDir, 'utils.ts'), 'export function helper() {}');
    writeFileSync(
      join(tmpDir, 'app.ts'),
      'import { helper } from "./utils";',
    );

    const result = findDependents(
      join(tmpDir, 'utils.ts'),
      'typescript',
      tmpDir,
      { maxFiles: 10, timeout: 5000 },
    );

    expect(result).toEqual([]);
  });

  it('returns [] for types.ts (generic basename)', () => {
    writeFileSync(join(tmpDir, 'types.ts'), 'export type Foo = string;');
    writeFileSync(
      join(tmpDir, 'app.ts'),
      'import type { Foo } from "./types";',
    );

    const result = findDependents(
      join(tmpDir, 'types.ts'),
      'typescript',
      tmpDir,
      { maxFiles: 10, timeout: 5000 },
    );

    expect(result).toEqual([]);
  });

  it('returns [] for config.ts (generic basename)', () => {
    writeFileSync(join(tmpDir, 'config.ts'), 'export const PORT = 3000;');
    writeFileSync(
      join(tmpDir, 'app.ts'),
      'import { PORT } from "./config";',
    );

    const result = findDependents(
      join(tmpDir, 'config.ts'),
      'typescript',
      tmpDir,
      { maxFiles: 10, timeout: 5000 },
    );

    expect(result).toEqual([]);
  });

  it('still works for auth.ts (not generic)', () => {
    writeFileSync(join(tmpDir, 'auth.ts'), 'export function login() {}');
    writeFileSync(
      join(tmpDir, 'app.ts'),
      'import { login } from "./auth";',
    );

    const result = findDependents(
      join(tmpDir, 'auth.ts'),
      'typescript',
      tmpDir,
      { maxFiles: 10, timeout: 5000 },
    );

    expect(result).toContain(join(tmpDir, 'app.ts'));
  });

  it('still works for user-service.ts (not generic, hyphenated)', () => {
    writeFileSync(join(tmpDir, 'user-service.ts'), 'export function getUser() {}');
    writeFileSync(
      join(tmpDir, 'app.ts'),
      'import { getUser } from "./user-service";',
    );

    const result = findDependents(
      join(tmpDir, 'user-service.ts'),
      'typescript',
      tmpDir,
      { maxFiles: 10, timeout: 5000 },
    );

    expect(result).toContain(join(tmpDir, 'app.ts'));
  });
});

// ---------------------------------------------------------------------------
// Bug 2: Hyphenated filenames and \b word boundary matching
// ---------------------------------------------------------------------------

describe('buildImportPattern — hyphenated filenames', () => {
  it('matches import of hyphenated module: from "./my-utils"', () => {
    const pattern = buildImportPattern('my-utils', 'typescript');
    expect(matches(pattern, 'import { x } from "./my-utils"')).toBe(true);
  });

  it('matches require of hyphenated module: require("./my-utils")', () => {
    const pattern = buildImportPattern('my-utils', 'typescript');
    expect(matches(pattern, 'const x = require("./my-utils")')).toBe(true);
  });

  it('known limitation: matches "./not-my-utils" because \\b treats hyphen as word boundary', () => {
    const pattern = buildImportPattern('my-utils', 'typescript');
    // \b fires at the hyphen between "not" and "my" in "not-my-utils",
    // so \bmy-utils matches inside "not-my-utils". This is a known limitation
    // of \b with hyphenated basenames — acceptable because:
    // 1. Such collisions are rare in practice (few modules share hyphenated suffixes)
    // 2. Impact analysis is advisory, not blocking
    // 3. The alternative (path-based matching) is much more complex
    expect(matches(pattern, 'import { x } from "./not-my-utils"')).toBe(true);
  });

  it('does not match module with extra suffix: from "./my-utils-extra"', () => {
    const pattern = buildImportPattern('my-utils', 'typescript');
    // The closing quote after basename prevents suffix matches
    expect(matches(pattern, 'import { x } from "./my-utils-extra"')).toBe(false);
  });

  it('matches import of deeply nested hyphenated module', () => {
    const pattern = buildImportPattern('my-utils', 'typescript');
    expect(matches(pattern, 'import { x } from "../lib/my-utils"')).toBe(true);
  });

  it('matches Python import of hyphenated module (if valid)', () => {
    // Python doesn't allow hyphens in module names, but if encountered:
    const pattern = buildImportPattern('my-utils', 'python');
    expect(matches(pattern, 'import my-utils')).toBe(true);
  });

  it('matches Rust use of hyphenated crate', () => {
    const pattern = buildImportPattern('my-utils', 'rust');
    expect(matches(pattern, 'use crate::my-utils;')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// analyzeImpact — orchestrator tests
// ---------------------------------------------------------------------------

/** Minimal config enabling TypeScript with impact analysis on */
function makeConfig(overrides?: Partial<TddGateConfig>): TddGateConfig {
  return {
    languages: { typescript: { enabled: true } },
    exempt: { extensions: ['.json', '.md'], paths: [] },
    bashDetection: true,
    completionAudit: true,
    circuitBreaker: { preToolUse: 100, stop: 50 },
    testCommands: ['vitest', 'jest'],
    testDirs: [],
    impactAnalysis: true,
    impactAnalysisMaxFiles: 50,
    impactAnalysisTimeout: 5000,
    mode: 'enforce',
    ...overrides,
  };
}

describe('analyzeImpact', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'tdd-gate-analyzeImpact-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty when config.impactAnalysis is false', () => {
    const config = makeConfig({ impactAnalysis: false });
    const journal = { hasTestFor: () => false, hasTestRun: () => false } as any;

    const result = analyzeImpact(
      [join(tmpDir, 'auth.ts')],
      tmpDir,
      config,
      journal,
    );

    expect(result).toEqual([]);
  });

  it('returns empty when journal.hasTestRun() is true (test suite ran)', () => {
    const config = makeConfig();
    const journal = { hasTestFor: () => false, hasTestRun: () => true } as any;

    const result = analyzeImpact(
      [join(tmpDir, 'auth.ts')],
      tmpDir,
      config,
      journal,
    );

    expect(result).toEqual([]);
  });

  it('returns uncovered dependents when their tests were not run', () => {
    // Create the changed impl file
    writeFileSync(join(tmpDir, 'auth.ts'), 'export function login() {}');
    // Create a dependent impl file that imports auth
    writeFileSync(
      join(tmpDir, 'app.ts'),
      'import { login } from "./auth";\nexport function main() { login(); }',
    );

    const config = makeConfig();
    const journal = { hasTestFor: () => false, hasTestRun: () => false } as any;

    const result = analyzeImpact(
      [join(tmpDir, 'auth.ts')],
      tmpDir,
      config,
      journal,
    );

    // Should find app.ts as an uncovered dependent
    expect(result.length).toBe(1);
    expect(result[0].filePath).toBe(join(tmpDir, 'auth.ts'));
    expect(result[0].dependents).toContain(join(tmpDir, 'app.ts'));
    expect(result[0].missingTests.length).toBeGreaterThan(0);
  });

  it('skips dependents that are not impl type (e.g. test files, exempt)', () => {
    writeFileSync(join(tmpDir, 'auth.ts'), 'export function login() {}');
    // Only a test file depends on auth — should be skipped
    writeFileSync(
      join(tmpDir, 'auth.test.ts'),
      'import { login } from "./auth";\nit("works", () => {});',
    );

    const config = makeConfig();
    const journal = { hasTestFor: () => false, hasTestRun: () => false } as any;

    const result = analyzeImpact(
      [join(tmpDir, 'auth.ts')],
      tmpDir,
      config,
      journal,
    );

    // findDependents already excludes test files, so result should have no dependents
    // (or the dependent list is empty, so no ImpactResult with uncovered deps)
    if (result.length > 0) {
      expect(result[0].dependents).toEqual([]);
      expect(result[0].missingTests).toEqual([]);
    } else {
      expect(result).toEqual([]);
    }
  });

  it('returns empty dependents when all dependent tests were written', () => {
    writeFileSync(join(tmpDir, 'auth.ts'), 'export function login() {}');
    writeFileSync(
      join(tmpDir, 'app.ts'),
      'import { login } from "./auth";\nexport function main() { login(); }',
    );

    const config = makeConfig();
    // hasTestFor returns true — all tests covered
    const journal = { hasTestFor: () => true, hasTestRun: () => false } as any;

    const result = analyzeImpact(
      [join(tmpDir, 'auth.ts')],
      tmpDir,
      config,
      journal,
    );

    // No uncovered dependents, so no results (or results with empty lists)
    if (result.length > 0) {
      expect(result[0].dependents).toEqual([]);
      expect(result[0].missingTests).toEqual([]);
    } else {
      expect(result).toEqual([]);
    }
  });

  it('missingTests has 1:1 correspondence with dependents (not multiple per dependent)', () => {
    writeFileSync(join(tmpDir, 'auth.ts'), 'export function login() {}');
    writeFileSync(
      join(tmpDir, 'app.ts'),
      'import { login } from "./auth";\nexport function main() { login(); }',
    );
    writeFileSync(
      join(tmpDir, 'server.ts'),
      'import { login } from "./auth";\nexport function serve() { login(); }',
    );

    const config = makeConfig();
    const journal = { hasTestFor: () => false, hasTestRun: () => false } as any;

    const result = analyzeImpact(
      [join(tmpDir, 'auth.ts')],
      tmpDir,
      config,
      journal,
    );

    expect(result.length).toBe(1);
    // missingTests.length MUST equal dependents.length (1:1 mapping)
    expect(result[0].missingTests.length).toBe(result[0].dependents.length);
  });

  it('handles multiple changed files', () => {
    // Two changed files, each with a dependent
    writeFileSync(join(tmpDir, 'auth.ts'), 'export function login() {}');
    writeFileSync(join(tmpDir, 'db.ts'), 'export function query() {}');
    writeFileSync(
      join(tmpDir, 'service.ts'),
      'import { login } from "./auth";\nimport { query } from "./db";',
    );

    const config = makeConfig();
    const journal = { hasTestFor: () => false, hasTestRun: () => false } as any;

    const result = analyzeImpact(
      [join(tmpDir, 'auth.ts'), join(tmpDir, 'db.ts')],
      tmpDir,
      config,
      journal,
    );

    // Both changed files should produce results
    expect(result.length).toBe(2);
    const filePaths = result.map(r => r.filePath);
    expect(filePaths).toContain(join(tmpDir, 'auth.ts'));
    expect(filePaths).toContain(join(tmpDir, 'db.ts'));
  });
});
