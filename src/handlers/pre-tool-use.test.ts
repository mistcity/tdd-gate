/**
 * Tests for the PreToolUse handler — core TDD enforcement logic.
 */

import { describe, it, expect } from 'vitest';
import { handlePreToolUse } from './pre-tool-use.js';
import type { PreToolUseInput, TddGateConfig } from '../types.js';
import type { Journal } from '../core/journal.js';
import type { CircuitBreaker } from '../core/circuit-breaker.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callHandler = (input: PreToolUseInput, config: TddGateConfig, journal: any, cb: any) =>
  handlePreToolUse(input, config, journal as Journal, cb as CircuitBreaker);

// ---------------------------------------------------------------------------
// Test config
// ---------------------------------------------------------------------------

const testConfig: TddGateConfig = {
  languages: {
    typescript: { enabled: true },
    python: { enabled: true },
    javascript: { enabled: true },
    tsx: { enabled: true },
    jsx: { enabled: true },
    kotlin: { enabled: true },
    java: { enabled: true },
    go: { enabled: true },
    rust: { enabled: true },
    csharp: { enabled: true },
  },
  exempt: { extensions: ['.json', '.md'], paths: ['/migrations/'] },
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
// Stub factories
// ---------------------------------------------------------------------------

/** Stub journal with exposed internal arrays for assertions. */
interface StubJournal {
  tests: string[];
  impls: string[];
  testRuns: string[];
  recordTest(p: string): void;
  recordImpl(p: string): void;
  recordTestRun(c: string): void;
  hasTestFor(paths: string[]): boolean;
  hasTestRun(): boolean;
  getEntries(): Array<{ type: string; filePath: string }>;
}

function createStubJournal(): StubJournal {
  const tests: string[] = [];
  const impls: string[] = [];
  const testRuns: string[] = [];
  return {
    recordTest(p: string) { tests.push(p); },
    recordImpl(p: string) { impls.push(p); },
    recordTestRun(c: string) { testRuns.push(c); },
    hasTestFor(paths: string[]) {
      return paths.some((p: string) => tests.some((t: string) =>
        t.endsWith('/' + p.split('/').pop()!) || p.endsWith('/' + t.split('/').pop()!)
      ));
    },
    hasTestRun() { return testRuns.length > 0; },
    getEntries() { return []; },
    tests, impls, testRuns,
  };
}

function createStubCircuitBreaker(tripped = false) {
  return {
    check() { return tripped; },
    reset() {},
  } as unknown as CircuitBreaker;
}

// ---------------------------------------------------------------------------
// Helper to build PreToolUseInput
// ---------------------------------------------------------------------------

function makeInput(
  toolName: 'Write' | 'Edit' | 'MultiEdit' | 'Bash',
  toolInput: Record<string, string | undefined>,
): PreToolUseInput {
  return {
    hook_event_name: 'PreToolUse',
    session_id: 'test-session',
    tool_name: toolName,
    tool_input: toolInput,
  };
}

// ===========================================================================
// Write/Edit tool — Allow cases
// ===========================================================================

describe('PreToolUse handler — Write/Edit tool', () => {
  describe('allow cases', () => {
    it('allows exempt file (.json)', () => {
      const journal = createStubJournal();
      const cb = createStubCircuitBreaker();
      const input = makeInput('Write', { file_path: '/project/package.json' });

      const result = callHandler(input, testConfig, journal, cb);

      expect(result.action).toBe('allow');
    });

    it('allows exempt file (.md)', () => {
      const journal = createStubJournal();
      const cb = createStubCircuitBreaker();
      const input = makeInput('Write', { file_path: '/project/README.md' });

      const result = callHandler(input, testConfig, journal, cb);

      expect(result.action).toBe('allow');
    });

    it('allows test file and records in journal', () => {
      const journal = createStubJournal();
      const cb = createStubCircuitBreaker();
      const input = makeInput('Write', { file_path: '/project/src/foo.test.ts' });

      const result = callHandler(input, testConfig, journal, cb);

      expect(result.action).toBe('allow');
      expect(journal.tests).toContain('/project/src/foo.test.ts');
    });

    it('allows Edit on test file and records in journal', () => {
      const journal = createStubJournal();
      const cb = createStubCircuitBreaker();
      const input = makeInput('Edit', { file_path: '/project/src/bar.spec.ts' });

      const result = callHandler(input, testConfig, journal, cb);

      expect(result.action).toBe('allow');
      expect(journal.tests).toContain('/project/src/bar.spec.ts');
    });

    it('allows impl file when test already in journal', () => {
      const journal = createStubJournal();
      journal.recordTest('/project/src/foo.test.ts');
      const cb = createStubCircuitBreaker();
      const input = makeInput('Write', { file_path: '/project/src/foo.ts' });

      const result = callHandler(input, testConfig, journal, cb);

      expect(result.action).toBe('allow');
    });

    it('allows unknown file type (.sql)', () => {
      const journal = createStubJournal();
      const cb = createStubCircuitBreaker();
      const input = makeInput('Write', { file_path: '/project/schema.sql' });

      const result = callHandler(input, testConfig, journal, cb);

      expect(result.action).toBe('allow');
    });

    it('allows file in exempt path (/migrations/)', () => {
      const journal = createStubJournal();
      const cb = createStubCircuitBreaker();
      const input = makeInput('Write', { file_path: '/project/migrations/001.ts' });

      const result = callHandler(input, testConfig, journal, cb);

      expect(result.action).toBe('allow');
    });
  });

  // =========================================================================
  // Write/Edit tool — Deny cases
  // =========================================================================

  describe('deny cases', () => {
    it('denies impl file with no test in journal', () => {
      const journal = createStubJournal();
      const cb = createStubCircuitBreaker();
      const input = makeInput('Write', { file_path: '/project/src/foo.ts' });

      const result = callHandler(input, testConfig, journal, cb);

      expect(result.action).toBe('deny');
    });

    it('deny message contains expected test file name', () => {
      const journal = createStubJournal();
      const cb = createStubCircuitBreaker();
      const input = makeInput('Edit', { file_path: '/project/src/bar.ts' });

      const result = callHandler(input, testConfig, journal, cb);

      expect(result.action).toBe('deny');
      if (result.action === 'deny') {
        expect(result.reason).toContain('bar.test.ts');
        expect(result.reason).toContain('/project/src/bar.ts');
      }
    });

    it('denies MultiEdit on impl file without test', () => {
      const journal = createStubJournal();
      const cb = createStubCircuitBreaker();
      const input = makeInput('MultiEdit', { file_path: '/project/src/utils.ts' });

      const result = callHandler(input, testConfig, journal, cb);

      expect(result.action).toBe('deny');
    });

    it('denies Python impl file without test', () => {
      const journal = createStubJournal();
      const cb = createStubCircuitBreaker();
      const input = makeInput('Write', { file_path: '/project/app.py' });

      const result = callHandler(input, testConfig, journal, cb);

      expect(result.action).toBe('deny');
      if (result.action === 'deny') {
        expect(result.reason).toContain('test_app.py');
      }
    });
  });
});

// ===========================================================================
// Bash tool
// ===========================================================================

describe('PreToolUse handler — Bash tool', () => {
  describe('allow cases', () => {
    it('allows test command (npm test) and records test run', () => {
      const journal = createStubJournal();
      const cb = createStubCircuitBreaker();
      const input = makeInput('Bash', { command: 'npm test' });

      const result = callHandler(input, testConfig, journal, cb);

      expect(result.action).toBe('allow');
      expect(journal.testRuns).toContain('npm test');
    });

    it('allows non-write command (ls -la)', () => {
      const journal = createStubJournal();
      const cb = createStubCircuitBreaker();
      const input = makeInput('Bash', { command: 'ls -la' });

      const result = callHandler(input, testConfig, journal, cb);

      expect(result.action).toBe('allow');
    });

    it('allows bash writing exempt file', () => {
      const journal = createStubJournal();
      const cb = createStubCircuitBreaker();
      const input = makeInput('Bash', { command: 'echo "hello" > config.json' });

      const result = callHandler(input, testConfig, journal, cb);

      expect(result.action).toBe('allow');
    });

    it('allows bash writing test file', () => {
      const journal = createStubJournal();
      const cb = createStubCircuitBreaker();
      const input = makeInput('Bash', { command: 'cat > foo.test.ts << EOF\ntest\nEOF' });

      const result = callHandler(input, testConfig, journal, cb);

      expect(result.action).toBe('allow');
    });

    it('allows pytest command and records test run', () => {
      const journal = createStubJournal();
      const cb = createStubCircuitBreaker();
      const input = makeInput('Bash', { command: 'pytest tests/' });

      const result = callHandler(input, testConfig, journal, cb);

      expect(result.action).toBe('allow');
      expect(journal.testRuns).toContain('pytest tests/');
    });
  });

  describe('deny cases', () => {
    it('denies bash writing impl file without test', () => {
      const journal = createStubJournal();
      const cb = createStubCircuitBreaker();
      const input = makeInput('Bash', { command: 'echo "code" > foo.ts' });

      const result = callHandler(input, testConfig, journal, cb);

      expect(result.action).toBe('deny');
    });

    it('denies bash heredoc writing impl file without test', () => {
      const journal = createStubJournal();
      const cb = createStubCircuitBreaker();
      const input = makeInput('Bash', { command: 'cat > server.py << EOF\nprint("hi")\nEOF' });

      const result = callHandler(input, testConfig, journal, cb);

      expect(result.action).toBe('deny');
    });
  });
});

// ===========================================================================
// Circuit breaker
// ===========================================================================

describe('PreToolUse handler — Circuit breaker', () => {
  it('allows impl file without test when circuit breaker is tripped', () => {
    const journal = createStubJournal();
    const cb = createStubCircuitBreaker(true);
    const input = makeInput('Write', { file_path: '/project/src/foo.ts' });

    const result = callHandler(input, testConfig, journal, cb);

    expect(result.action).toBe('allow');
  });

  it('allows bash write without test when circuit breaker is tripped', () => {
    const journal = createStubJournal();
    const cb = createStubCircuitBreaker(true);
    const input = makeInput('Bash', { command: 'echo "x" > foo.ts' });

    const result = callHandler(input, testConfig, journal, cb);

    expect(result.action).toBe('allow');
  });
});

// ===========================================================================
// MultiEdit tool — dedicated coverage
// ===========================================================================

describe('PreToolUse handler — MultiEdit tool', () => {
  it('denies MultiEdit on impl file without test in journal', () => {
    const journal = createStubJournal();
    const cb = createStubCircuitBreaker();
    const input = makeInput('MultiEdit', { file_path: '/project/src/service.ts' });

    const result = callHandler(input, testConfig, journal, cb);

    expect(result.action).toBe('deny');
    if (result.action === 'deny') {
      expect(result.reason).toContain('service.test.ts');
      expect(result.reason).toContain('/project/src/service.ts');
    }
  });

  it('allows MultiEdit on test file and records in journal', () => {
    const journal = createStubJournal();
    const cb = createStubCircuitBreaker();
    const input = makeInput('MultiEdit', { file_path: '/project/src/service.test.ts' });

    const result = callHandler(input, testConfig, journal, cb);

    expect(result.action).toBe('allow');
    expect(journal.tests).toContain('/project/src/service.test.ts');
  });

  it('allows MultiEdit with empty tool_input (no file_path) — fail-open', () => {
    const journal = createStubJournal();
    const cb = createStubCircuitBreaker();
    const input = makeInput('MultiEdit', {});

    const result = callHandler(input, testConfig, journal, cb);

    expect(result.action).toBe('allow');
  });
});

// ===========================================================================
// Edge cases
// ===========================================================================

describe('PreToolUse handler — Edge cases', () => {
  it('allows when file_path is missing from tool_input', () => {
    const journal = createStubJournal();
    const cb = createStubCircuitBreaker();
    const input = makeInput('Write', {});

    const result = callHandler(input, testConfig, journal, cb);

    expect(result.action).toBe('allow');
  });

  it('allows when command is missing from Bash tool_input', () => {
    const journal = createStubJournal();
    const cb = createStubCircuitBreaker();
    const input = makeInput('Bash', {});

    const result = callHandler(input, testConfig, journal, cb);

    expect(result.action).toBe('allow');
  });

  it('allows when file_path is empty string', () => {
    const journal = createStubJournal();
    const cb = createStubCircuitBreaker();
    const input = makeInput('Write', { file_path: '' });

    const result = callHandler(input, testConfig, journal, cb);

    expect(result.action).toBe('allow');
  });

  it('allows when bashDetection is disabled', () => {
    const journal = createStubJournal();
    const cb = createStubCircuitBreaker();
    const noBashConfig = { ...testConfig, bashDetection: false };
    const input = makeInput('Bash', { command: 'echo "x" > foo.ts' });

    const result = callHandler(input, noBashConfig, journal, cb);

    expect(result.action).toBe('allow');
  });
});
