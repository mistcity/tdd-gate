/**
 * Tests for the Stop handler — completion audit logic.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { TddGateConfig } from '../types.js';

// ---------------------------------------------------------------------------
// Mock child_process BEFORE importing the module under test
// ---------------------------------------------------------------------------

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from 'child_process';
const mockExecSync = vi.mocked(execFileSync);

import { handleStop } from './stop.js';

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
};

const auditDisabledConfig: TddGateConfig = {
  ...testConfig,
  completionAudit: false,
};

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function createStubJournal(hasRun = false) {
  return {
    hasTestRun: () => hasRun,
    recordTest(_p: string) {},
    recordImpl(_p: string) {},
    recordTestRun(_c: string) {},
    hasTestFor: () => false,
    getEntries: () => [],
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

function createStubCircuitBreaker(tripped = false) {
  return {
    check: () => tripped,
    reset() {},
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

// ---------------------------------------------------------------------------
// Helper: configure mockExecSync to return given diff lines
// ---------------------------------------------------------------------------

/**
 * Sets mockExecSync to return `lines` for the HEAD diff and empty for cached.
 * execFileSync receives (file, args[], options) — we inspect the args array.
 */
function mockDiff(headLines: string[], cachedLines: string[] = []): void {
  mockExecSync.mockImplementation((_file: unknown, args: unknown) => {
    const argArr = args as string[];
    if (argArr.includes('--cached')) {
      return cachedLines.join('\n');
    }
    return headLines.join('\n');
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleStop — completionAudit disabled', () => {
  it('returns allow immediately when completionAudit is false', () => {
    const result = handleStop(
      'sess1',
      '/project',
      auditDisabledConfig,
      createStubJournal(),
      createStubCircuitBreaker(),
    );

    expect(result.action).toBe('allow');
    expect(mockExecSync).not.toHaveBeenCalled();
  });
});

describe('handleStop — circuit breaker tripped', () => {
  it('returns allow when circuit breaker is tripped', () => {
    const result = handleStop(
      'sess1',
      '/project',
      testConfig,
      createStubJournal(),
      createStubCircuitBreaker(true),
    );

    expect(result.action).toBe('allow');
    // Circuit breaker tripped — git should not be called
    expect(mockExecSync).not.toHaveBeenCalled();
  });
});

describe('handleStop — no git changes', () => {
  it('returns allow when diff is empty', () => {
    mockDiff([]);

    const result = handleStop(
      'sess1',
      '/project',
      testConfig,
      createStubJournal(),
      createStubCircuitBreaker(),
    );

    expect(result.action).toBe('allow');
  });
});

describe('handleStop — git command fails', () => {
  it('returns allow (fail-open) when git throws', () => {
    mockExecSync.mockImplementation((_file: unknown, _args: unknown) => {
      throw new Error('not a git repository');
    });

    const result = handleStop(
      'sess1',
      '/project',
      testConfig,
      createStubJournal(),
      createStubCircuitBreaker(),
    );

    expect(result.action).toBe('allow');
  });
});

describe('handleStop — only test files changed', () => {
  it('returns allow when only test files are in the diff', () => {
    mockDiff(['src/auth.test.ts', 'src/db.spec.ts']);

    const result = handleStop(
      'sess1',
      '/project',
      testConfig,
      createStubJournal(),
      createStubCircuitBreaker(),
    );

    expect(result.action).toBe('allow');
  });
});

describe('handleStop — impl + test files both changed', () => {
  it('returns allow when impl and test files are both changed', () => {
    mockDiff(['src/auth.ts', 'src/auth.test.ts']);

    const result = handleStop(
      'sess1',
      '/project',
      testConfig,
      createStubJournal(),
      createStubCircuitBreaker(),
    );

    expect(result.action).toBe('allow');
  });
});

describe('handleStop — impl changed, test run was recorded', () => {
  it('returns allow when impl files changed but a test run was recorded', () => {
    mockDiff(['src/auth.ts']);

    const result = handleStop(
      'sess1',
      '/project',
      testConfig,
      createStubJournal(true), // hasRun = true
      createStubCircuitBreaker(),
    );

    expect(result.action).toBe('allow');
  });
});

describe('handleStop — impl changed, no tests, no test run → block', () => {
  it('returns block when impl files changed without test files and no test run', () => {
    mockDiff(['src/auth.ts']);

    const result = handleStop(
      'sess1',
      '/project',
      testConfig,
      createStubJournal(false),
      createStubCircuitBreaker(),
    );

    expect(result.action).toBe('block');
  });

  it('block message lists the uncovered impl file', () => {
    mockDiff(['src/auth.ts']);

    const result = handleStop(
      'sess1',
      '/project',
      testConfig,
      createStubJournal(false),
      createStubCircuitBreaker(),
    );

    expect(result.action).toBe('block');
    if (result.action === 'block') {
      expect(result.message).toContain('src/auth.ts');
    }
  });

  it('block message lists expected test file names', () => {
    mockDiff(['src/auth.ts']);

    const result = handleStop(
      'sess1',
      '/project',
      testConfig,
      createStubJournal(false),
      createStubCircuitBreaker(),
    );

    expect(result.action).toBe('block');
    if (result.action === 'block') {
      expect(result.message).toContain('auth.test.ts');
    }
  });

  it('block message lists multiple uncovered impl files', () => {
    mockDiff(['src/auth.ts', 'src/db.ts']);

    const result = handleStop(
      'sess1',
      '/project',
      testConfig,
      createStubJournal(false),
      createStubCircuitBreaker(),
    );

    expect(result.action).toBe('block');
    if (result.action === 'block') {
      expect(result.message).toContain('src/auth.ts');
      expect(result.message).toContain('src/db.ts');
    }
  });
});

describe('handleStop — exempt-only changes', () => {
  it('returns allow when only exempt files (.json, .md) changed', () => {
    mockDiff(['package.json', 'README.md']);

    const result = handleStop(
      'sess1',
      '/project',
      testConfig,
      createStubJournal(false),
      createStubCircuitBreaker(),
    );

    expect(result.action).toBe('allow');
  });
});

describe('handleStop — cached diff combined with HEAD diff', () => {
  it('blocks when impl file appears only in cached diff', () => {
    // HEAD diff is empty, cached diff has an impl file
    mockExecSync.mockImplementation((_file: unknown, args: unknown) => {
      const argArr = args as string[];
      if (argArr.includes('--cached')) {
        return 'src/utils.ts';
      }
      return '';
    });

    const result = handleStop(
      'sess1',
      '/project',
      testConfig,
      createStubJournal(false),
      createStubCircuitBreaker(),
    );

    expect(result.action).toBe('block');
    if (result.action === 'block') {
      expect(result.message).toContain('src/utils.ts');
    }
  });
});
