/**
 * Tests for impact-analyzer.ts — buildImportPattern()
 *
 * TDD: tests written before implementation.
 * Each test verifies that the generated regex pattern matches
 * real-world import statements for the given language.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildImportPattern, LANGUAGE_BY_EXT, findDependents } from './impact-analyzer.js';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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
    const result = findDependents(
      '/nonexistent/path/auth.ts',
      'typescript',
      '/nonexistent/path',
      { maxFiles: 10, timeout: 5000 },
    );

    expect(result).toEqual([]);
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
