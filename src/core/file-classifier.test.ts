/**
 * Tests for file-classifier.ts
 * Following TDD: tests written before implementation.
 */

import { describe, it, expect } from 'vitest';
import {
  LANGUAGES,
  classifyFile,
  getExpectedTestPaths,
} from './file-classifier.js';
import type { TddGateConfig, LanguageDefinition } from '../types.js';

// ---------------------------------------------------------------------------
// Mock config
// ---------------------------------------------------------------------------

const mockConfig: TddGateConfig = {
  languages: {
    python: { enabled: true },
    typescript: { enabled: true },
    javascript: { enabled: true },
    tsx: { enabled: true },
    jsx: { enabled: true },
    kotlin: { enabled: true },
    java: { enabled: true },
    go: { enabled: true },
    rust: { enabled: true },
    csharp: { enabled: true },
  },
  exempt: {
    extensions: ['.json', '.md', '.yaml'],
    paths: ['/migrations/', '/generated/'],
  },
  bashDetection: true,
  completionAudit: true,
  circuitBreaker: { preToolUse: 1000, stop: 20 },
  testCommands: [],
  testDirs: ['tests', 'test', 'spec', '__tests__'],
  impactAnalysis: true,
  impactAnalysisMaxFiles: 500,
  impactAnalysisTimeout: 5000,
};

// ---------------------------------------------------------------------------
// LANGUAGES array
// ---------------------------------------------------------------------------

describe('LANGUAGES', () => {
  it('exports exactly 10 language definitions', () => {
    expect(LANGUAGES).toHaveLength(10);
  });

  it('each language has name, extensions, testPatterns, and isTestFile', () => {
    for (const lang of LANGUAGES) {
      expect(typeof lang.name).toBe('string');
      expect(Array.isArray(lang.extensions)).toBe(true);
      expect(typeof lang.testPatterns).toBe('function');
      expect(typeof lang.isTestFile).toBe('function');
    }
  });

  // ----- Python -----
  describe('Python', () => {
    const python = () => LANGUAGES.find((l: LanguageDefinition) => l.name === 'python')!;

    it('has extension .py', () => {
      expect(python().extensions).toContain('.py');
    });

    it('isTestFile returns true for test_foo.py', () => {
      expect(python().isTestFile('test_foo.py')).toBe(true);
    });

    it('isTestFile returns true for foo_test.py', () => {
      expect(python().isTestFile('foo_test.py')).toBe(true);
    });

    it('isTestFile returns false for foo.py', () => {
      expect(python().isTestFile('foo.py')).toBe(false);
    });

    it('testPatterns returns test_foo.py and foo_test.py', () => {
      const patterns = python().testPatterns('foo.py');
      expect(patterns).toContain('test_foo.py');
      expect(patterns).toContain('foo_test.py');
    });
  });

  // ----- TypeScript -----
  describe('TypeScript', () => {
    const ts = () => LANGUAGES.find((l: LanguageDefinition) => l.name === 'typescript')!;

    it('has extension .ts', () => {
      expect(ts().extensions).toContain('.ts');
    });

    it('isTestFile returns true for foo.test.ts', () => {
      expect(ts().isTestFile('foo.test.ts')).toBe(true);
    });

    it('isTestFile returns true for foo.spec.ts', () => {
      expect(ts().isTestFile('foo.spec.ts')).toBe(true);
    });

    it('isTestFile returns false for foo.ts', () => {
      expect(ts().isTestFile('foo.ts')).toBe(false);
    });

    it('testPatterns returns foo.test.ts and foo.spec.ts', () => {
      const patterns = ts().testPatterns('foo.ts');
      expect(patterns).toContain('foo.test.ts');
      expect(patterns).toContain('foo.spec.ts');
    });
  });

  // ----- JavaScript -----
  describe('JavaScript', () => {
    const js = () => LANGUAGES.find((l: LanguageDefinition) => l.name === 'javascript')!;

    it('has extension .js', () => {
      expect(js().extensions).toContain('.js');
    });

    it('isTestFile returns true for foo.test.js', () => {
      expect(js().isTestFile('foo.test.js')).toBe(true);
    });

    it('isTestFile returns true for foo.spec.js', () => {
      expect(js().isTestFile('foo.spec.js')).toBe(true);
    });

    it('isTestFile returns false for foo.js', () => {
      expect(js().isTestFile('foo.js')).toBe(false);
    });

    it('testPatterns returns foo.test.js and foo.spec.js', () => {
      const patterns = js().testPatterns('foo.js');
      expect(patterns).toContain('foo.test.js');
      expect(patterns).toContain('foo.spec.js');
    });
  });

  // ----- TSX -----
  describe('TSX', () => {
    const tsx = () => LANGUAGES.find((l: LanguageDefinition) => l.name === 'tsx')!;

    it('has extension .tsx', () => {
      expect(tsx().extensions).toContain('.tsx');
    });

    it('isTestFile returns true for foo.test.tsx', () => {
      expect(tsx().isTestFile('foo.test.tsx')).toBe(true);
    });

    it('isTestFile returns true for foo.spec.tsx', () => {
      expect(tsx().isTestFile('foo.spec.tsx')).toBe(true);
    });

    it('isTestFile returns false for foo.tsx', () => {
      expect(tsx().isTestFile('foo.tsx')).toBe(false);
    });

    it('testPatterns returns foo.test.tsx and foo.spec.tsx', () => {
      const patterns = tsx().testPatterns('foo.tsx');
      expect(patterns).toContain('foo.test.tsx');
      expect(patterns).toContain('foo.spec.tsx');
    });
  });

  // ----- JSX -----
  describe('JSX', () => {
    const jsx = () => LANGUAGES.find((l: LanguageDefinition) => l.name === 'jsx')!;

    it('has extension .jsx', () => {
      expect(jsx().extensions).toContain('.jsx');
    });

    it('isTestFile returns true for foo.test.jsx', () => {
      expect(jsx().isTestFile('foo.test.jsx')).toBe(true);
    });

    it('isTestFile returns true for foo.spec.jsx', () => {
      expect(jsx().isTestFile('foo.spec.jsx')).toBe(true);
    });

    it('isTestFile returns false for foo.jsx', () => {
      expect(jsx().isTestFile('foo.jsx')).toBe(false);
    });

    it('testPatterns returns foo.test.jsx and foo.spec.jsx', () => {
      const patterns = jsx().testPatterns('foo.jsx');
      expect(patterns).toContain('foo.test.jsx');
      expect(patterns).toContain('foo.spec.jsx');
    });
  });

  // ----- Kotlin -----
  describe('Kotlin', () => {
    const kotlin = () => LANGUAGES.find((l: LanguageDefinition) => l.name === 'kotlin')!;

    it('has extension .kt', () => {
      expect(kotlin().extensions).toContain('.kt');
    });

    it('isTestFile returns true for FooTest.kt', () => {
      expect(kotlin().isTestFile('FooTest.kt')).toBe(true);
    });

    it('isTestFile returns true for FooTests.kt', () => {
      expect(kotlin().isTestFile('FooTests.kt')).toBe(true);
    });

    it('isTestFile returns false for Foo.kt', () => {
      expect(kotlin().isTestFile('Foo.kt')).toBe(false);
    });

    it('testPatterns returns FooTest.kt and FooTests.kt', () => {
      const patterns = kotlin().testPatterns('Foo.kt');
      expect(patterns).toContain('FooTest.kt');
      expect(patterns).toContain('FooTests.kt');
    });
  });

  // ----- Java -----
  describe('Java', () => {
    const java = () => LANGUAGES.find((l: LanguageDefinition) => l.name === 'java')!;

    it('has extension .java', () => {
      expect(java().extensions).toContain('.java');
    });

    it('isTestFile returns true for FooTest.java', () => {
      expect(java().isTestFile('FooTest.java')).toBe(true);
    });

    it('isTestFile returns true for FooTests.java', () => {
      expect(java().isTestFile('FooTests.java')).toBe(true);
    });

    it('isTestFile returns false for Foo.java', () => {
      expect(java().isTestFile('Foo.java')).toBe(false);
    });

    it('testPatterns returns FooTest.java and FooTests.java', () => {
      const patterns = java().testPatterns('Foo.java');
      expect(patterns).toContain('FooTest.java');
      expect(patterns).toContain('FooTests.java');
    });
  });

  // ----- Go -----
  describe('Go', () => {
    const go = () => LANGUAGES.find((l: LanguageDefinition) => l.name === 'go')!;

    it('has extension .go', () => {
      expect(go().extensions).toContain('.go');
    });

    it('isTestFile returns true for foo_test.go', () => {
      expect(go().isTestFile('foo_test.go')).toBe(true);
    });

    it('isTestFile returns false for foo.go', () => {
      expect(go().isTestFile('foo.go')).toBe(false);
    });

    it('testPatterns returns foo_test.go', () => {
      const patterns = go().testPatterns('foo.go');
      expect(patterns).toContain('foo_test.go');
    });
  });

  // ----- Rust -----
  describe('Rust', () => {
    const rust = () => LANGUAGES.find((l: LanguageDefinition) => l.name === 'rust')!;

    it('has extension .rs', () => {
      expect(rust().extensions).toContain('.rs');
    });

    it('isTestFile returns true for foo_test.rs', () => {
      expect(rust().isTestFile('foo_test.rs')).toBe(true);
    });

    it('isTestFile returns false for foo.rs', () => {
      expect(rust().isTestFile('foo.rs')).toBe(false);
    });

    it('testPatterns returns foo_test.rs', () => {
      const patterns = rust().testPatterns('foo.rs');
      expect(patterns).toContain('foo_test.rs');
    });
  });

  // ----- C# -----
  describe('C#', () => {
    const csharp = () => LANGUAGES.find((l: LanguageDefinition) => l.name === 'csharp')!;

    it('has extension .cs', () => {
      expect(csharp().extensions).toContain('.cs');
    });

    it('isTestFile returns true for FooTest.cs', () => {
      expect(csharp().isTestFile('FooTest.cs')).toBe(true);
    });

    it('isTestFile returns true for FooTests.cs', () => {
      expect(csharp().isTestFile('FooTests.cs')).toBe(true);
    });

    it('isTestFile returns false for Foo.cs', () => {
      expect(csharp().isTestFile('Foo.cs')).toBe(false);
    });

    it('testPatterns returns FooTest.cs and FooTests.cs', () => {
      const patterns = csharp().testPatterns('Foo.cs');
      expect(patterns).toContain('FooTest.cs');
      expect(patterns).toContain('FooTests.cs');
    });
  });
});

// ---------------------------------------------------------------------------
// classifyFile
// ---------------------------------------------------------------------------

describe('classifyFile', () => {
  describe('exempt by extension', () => {
    it('classifies .json files as exempt', () => {
      const result = classifyFile('/project/src/config.json', mockConfig);
      expect(result.type).toBe('exempt');
    });

    it('classifies .md files as exempt', () => {
      const result = classifyFile('/project/README.md', mockConfig);
      expect(result.type).toBe('exempt');
    });

    it('classifies .yaml files as exempt', () => {
      const result = classifyFile('/project/docker-compose.yaml', mockConfig);
      expect(result.type).toBe('exempt');
    });

    it('includes a reason for exempt files', () => {
      const result = classifyFile('/project/config.json', mockConfig);
      expect(result.type).toBe('exempt');
      if (result.type === 'exempt') {
        expect(typeof result.reason).toBe('string');
        expect(result.reason.length).toBeGreaterThan(0);
      }
    });
  });

  describe('exempt by path pattern', () => {
    it('classifies files under /migrations/ as exempt', () => {
      const result = classifyFile('/project/db/migrations/0001_init.py', mockConfig);
      expect(result.type).toBe('exempt');
    });

    it('classifies files under /generated/ as exempt', () => {
      const result = classifyFile('/project/generated/proto.ts', mockConfig);
      expect(result.type).toBe('exempt');
    });

    it('includes a reason for path-exempt files', () => {
      const result = classifyFile('/project/db/migrations/0001_init.py', mockConfig);
      expect(result.type).toBe('exempt');
      if (result.type === 'exempt') {
        expect(typeof result.reason).toBe('string');
      }
    });
  });

  describe('test file classification', () => {
    it('classifies foo.test.ts as a TypeScript test file', () => {
      const result = classifyFile('/project/src/foo.test.ts', mockConfig);
      expect(result.type).toBe('test');
      if (result.type === 'test') {
        expect(result.language).toBe('typescript');
      }
    });

    it('classifies foo.spec.ts as a TypeScript test file', () => {
      const result = classifyFile('/project/src/foo.spec.ts', mockConfig);
      expect(result.type).toBe('test');
    });

    it('classifies test_bar.py as a Python test file', () => {
      const result = classifyFile('/project/tests/test_bar.py', mockConfig);
      expect(result.type).toBe('test');
      if (result.type === 'test') {
        expect(result.language).toBe('python');
      }
    });

    it('classifies bar_test.py as a Python test file', () => {
      const result = classifyFile('/project/tests/bar_test.py', mockConfig);
      expect(result.type).toBe('test');
    });

    it('classifies foo.test.js as a JavaScript test file', () => {
      const result = classifyFile('/project/src/foo.test.js', mockConfig);
      expect(result.type).toBe('test');
      if (result.type === 'test') {
        expect(result.language).toBe('javascript');
      }
    });

    it('classifies foo.test.tsx as a TSX test file', () => {
      const result = classifyFile('/project/src/foo.test.tsx', mockConfig);
      expect(result.type).toBe('test');
      if (result.type === 'test') {
        expect(result.language).toBe('tsx');
      }
    });

    it('classifies foo.test.jsx as a JSX test file', () => {
      const result = classifyFile('/project/src/foo.test.jsx', mockConfig);
      expect(result.type).toBe('test');
      if (result.type === 'test') {
        expect(result.language).toBe('jsx');
      }
    });

    it('classifies FooTest.kt as a Kotlin test file', () => {
      const result = classifyFile('/project/src/FooTest.kt', mockConfig);
      expect(result.type).toBe('test');
      if (result.type === 'test') {
        expect(result.language).toBe('kotlin');
      }
    });

    it('classifies FooTest.java as a Java test file', () => {
      const result = classifyFile('/project/src/FooTest.java', mockConfig);
      expect(result.type).toBe('test');
      if (result.type === 'test') {
        expect(result.language).toBe('java');
      }
    });

    it('classifies foo_test.go as a Go test file', () => {
      const result = classifyFile('/project/pkg/foo_test.go', mockConfig);
      expect(result.type).toBe('test');
      if (result.type === 'test') {
        expect(result.language).toBe('go');
      }
    });

    it('classifies foo_test.rs as a Rust test file', () => {
      const result = classifyFile('/project/src/foo_test.rs', mockConfig);
      expect(result.type).toBe('test');
      if (result.type === 'test') {
        expect(result.language).toBe('rust');
      }
    });

    it('classifies FooTest.cs as a C# test file', () => {
      const result = classifyFile('/project/src/FooTest.cs', mockConfig);
      expect(result.type).toBe('test');
      if (result.type === 'test') {
        expect(result.language).toBe('csharp');
      }
    });
  });

  describe('impl file classification', () => {
    it('classifies foo.ts as a TypeScript impl file', () => {
      const result = classifyFile('/project/src/foo.ts', mockConfig);
      expect(result.type).toBe('impl');
      if (result.type === 'impl') {
        expect(result.language).toBe('typescript');
        expect(result.expectedTests).toContain('foo.test.ts');
        expect(result.expectedTests).toContain('foo.spec.ts');
      }
    });

    it('classifies foo.py as a Python impl file', () => {
      const result = classifyFile('/project/src/foo.py', mockConfig);
      expect(result.type).toBe('impl');
      if (result.type === 'impl') {
        expect(result.language).toBe('python');
        expect(result.expectedTests).toContain('test_foo.py');
        expect(result.expectedTests).toContain('foo_test.py');
      }
    });

    it('classifies foo.js as a JavaScript impl file', () => {
      const result = classifyFile('/project/src/foo.js', mockConfig);
      expect(result.type).toBe('impl');
      if (result.type === 'impl') {
        expect(result.language).toBe('javascript');
      }
    });

    it('classifies Foo.kt as a Kotlin impl file with correct test patterns', () => {
      const result = classifyFile('/project/src/Foo.kt', mockConfig);
      expect(result.type).toBe('impl');
      if (result.type === 'impl') {
        expect(result.language).toBe('kotlin');
        expect(result.expectedTests).toContain('FooTest.kt');
        expect(result.expectedTests).toContain('FooTests.kt');
      }
    });

    it('classifies Foo.java as a Java impl file with correct test patterns', () => {
      const result = classifyFile('/project/src/Foo.java', mockConfig);
      expect(result.type).toBe('impl');
      if (result.type === 'impl') {
        expect(result.language).toBe('java');
        expect(result.expectedTests).toContain('FooTest.java');
        expect(result.expectedTests).toContain('FooTests.java');
      }
    });

    it('classifies foo.go as a Go impl file with correct test pattern', () => {
      const result = classifyFile('/project/pkg/foo.go', mockConfig);
      expect(result.type).toBe('impl');
      if (result.type === 'impl') {
        expect(result.language).toBe('go');
        expect(result.expectedTests).toContain('foo_test.go');
      }
    });

    it('classifies foo.rs as a Rust impl file with correct test pattern', () => {
      const result = classifyFile('/project/src/foo.rs', mockConfig);
      expect(result.type).toBe('impl');
      if (result.type === 'impl') {
        expect(result.language).toBe('rust');
        expect(result.expectedTests).toContain('foo_test.rs');
      }
    });

    it('classifies Foo.cs as a C# impl file with correct test patterns', () => {
      const result = classifyFile('/project/src/Foo.cs', mockConfig);
      expect(result.type).toBe('impl');
      if (result.type === 'impl') {
        expect(result.language).toBe('csharp');
        expect(result.expectedTests).toContain('FooTest.cs');
        expect(result.expectedTests).toContain('FooTests.cs');
      }
    });

    it('classifies foo.tsx as a TSX impl file', () => {
      const result = classifyFile('/project/src/foo.tsx', mockConfig);
      expect(result.type).toBe('impl');
      if (result.type === 'impl') {
        expect(result.language).toBe('tsx');
      }
    });

    it('classifies foo.jsx as a JSX impl file', () => {
      const result = classifyFile('/project/src/foo.jsx', mockConfig);
      expect(result.type).toBe('impl');
      if (result.type === 'impl') {
        expect(result.language).toBe('jsx');
      }
    });
  });

  describe('unknown file type', () => {
    it('classifies .sql files as unknown', () => {
      const result = classifyFile('/project/schema.sql', mockConfig);
      expect(result.type).toBe('unknown');
    });

    it('classifies .sh files as unknown', () => {
      const result = classifyFile('/project/deploy.sh', mockConfig);
      expect(result.type).toBe('unknown');
    });
  });

  describe('disabled language', () => {
    it('returns unknown for a TypeScript file when TypeScript is disabled', () => {
      const configWithTsDisabled: TddGateConfig = {
        ...mockConfig,
        languages: {
          ...mockConfig.languages,
          typescript: { enabled: false },
        },
      };
      const result = classifyFile('/project/src/foo.ts', configWithTsDisabled);
      // .ts is not matched since typescript disabled; no other language matches .ts
      expect(result.type).toBe('unknown');
    });

    it('returns unknown for a Python test file when Python is disabled', () => {
      const configWithPyDisabled: TddGateConfig = {
        ...mockConfig,
        languages: {
          ...mockConfig.languages,
          python: { enabled: false },
        },
      };
      const result = classifyFile('/project/tests/test_bar.py', configWithPyDisabled);
      expect(result.type).toBe('unknown');
    });
  });
});

// ---------------------------------------------------------------------------
// getExpectedTestPaths
// ---------------------------------------------------------------------------

describe('getExpectedTestPaths', () => {
  it('returns full paths for a TypeScript impl file', () => {
    const paths = getExpectedTestPaths('/project/src/foo.ts', mockConfig);
    expect(paths).toContain('/project/src/foo.test.ts');
    expect(paths).toContain('/project/src/foo.spec.ts');
  });

  it('includes __tests__ subdirectory paths for TypeScript', () => {
    const paths = getExpectedTestPaths('/project/src/foo.ts', mockConfig);
    expect(paths).toContain('/project/src/__tests__/foo.test.ts');
    expect(paths).toContain('/project/src/__tests__/foo.spec.ts');
  });

  it('returns full paths for a Python impl file', () => {
    const paths = getExpectedTestPaths('/project/src/foo.py', mockConfig);
    expect(paths).toContain('/project/src/test_foo.py');
    expect(paths).toContain('/project/src/foo_test.py');
  });

  it('returns full paths for a Go impl file', () => {
    const paths = getExpectedTestPaths('/project/pkg/foo.go', mockConfig);
    expect(paths).toContain('/project/pkg/foo_test.go');
  });

  it('returns full paths for a Kotlin impl file', () => {
    const paths = getExpectedTestPaths('/project/src/Foo.kt', mockConfig);
    expect(paths).toContain('/project/src/FooTest.kt');
    expect(paths).toContain('/project/src/FooTests.kt');
  });

  it('returns full paths for a Java impl file', () => {
    const paths = getExpectedTestPaths('/project/src/Foo.java', mockConfig);
    expect(paths).toContain('/project/src/FooTest.java');
    expect(paths).toContain('/project/src/FooTests.java');
  });

  it('returns empty array for unknown file type', () => {
    const paths = getExpectedTestPaths('/project/schema.sql', mockConfig);
    expect(paths).toEqual([]);
  });

  it('returns empty array when language is disabled', () => {
    const configWithTsDisabled: TddGateConfig = {
      ...mockConfig,
      languages: { ...mockConfig.languages, typescript: { enabled: false } },
    };
    const paths = getExpectedTestPaths('/project/src/foo.ts', configWithTsDisabled);
    expect(paths).toEqual([]);
  });

  it('includes __tests__ subdirectory paths for JavaScript', () => {
    const paths = getExpectedTestPaths('/project/src/foo.js', mockConfig);
    expect(paths).toContain('/project/src/__tests__/foo.test.js');
  });

  it('includes __tests__ subdirectory paths for TSX', () => {
    const paths = getExpectedTestPaths('/project/src/Button.tsx', mockConfig);
    expect(paths).toContain('/project/src/__tests__/Button.test.tsx');
  });

  it('includes __tests__ subdirectory paths for JSX', () => {
    const paths = getExpectedTestPaths('/project/src/Button.jsx', mockConfig);
    expect(paths).toContain('/project/src/__tests__/Button.test.jsx');
  });
});
