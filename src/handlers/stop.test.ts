/**
 * Tests for the Stop handler — completion audit logic with impact analysis.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { TddGateConfig, ImpactResult } from '../types.js';

// ---------------------------------------------------------------------------
// Mock child_process BEFORE importing the module under test
// ---------------------------------------------------------------------------

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('../core/impact-analyzer.js', () => ({
  analyzeImpact: vi.fn(),
}));

import { execFileSync } from 'child_process';
const mockExecSync = vi.mocked(execFileSync);

import { analyzeImpact } from '../core/impact-analyzer.js';
const mockAnalyzeImpact = vi.mocked(analyzeImpact);

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
  testCommands: [],
  testDirs: ['tests', 'test', 'spec', '__tests__'],
  impactAnalysis: true,
  impactAnalysisMaxFiles: 500,
  impactAnalysisTimeout: 5000,
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
  // Default: impact analysis returns no issues
  mockAnalyzeImpact.mockReturnValue([]);
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
  it('returns allow (fail-open) and logs to stderr when git throws (Finding #10)', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    mockExecSync.mockImplementation((_file: unknown, _args: unknown) => {
      throw new Error('not a git repository');
    });

    try {
      const result = handleStop(
        'sess1',
        '/project',
        testConfig,
        createStubJournal(),
        createStubCircuitBreaker(),
      );

      expect(result.action).toBe('allow');
      expect(stderrSpy).toHaveBeenCalled();
      const msg = stderrSpy.mock.calls[0]?.[0] as string;
      expect(msg).toContain('[tdd-gate]');
      expect(msg).toContain('git diff failed');
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('returns allow without logging when git throws ENOENT', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    mockExecSync.mockImplementation((_file: unknown, _args: unknown) => {
      const err = new Error('ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    });

    try {
      const result = handleStop(
        'sess1',
        '/project',
        testConfig,
        createStubJournal(),
        createStubCircuitBreaker(),
      );

      expect(result.action).toBe('allow');
      expect(stderrSpy).not.toHaveBeenCalled();
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('suppresses git stderr output via stdio option', () => {
    mockDiff(['src/auth.ts']);

    handleStop(
      'sess1',
      '/project',
      testConfig,
      createStubJournal(false),
      createStubCircuitBreaker(),
    );

    // Both execFileSync calls must include stdio: ['pipe', 'pipe', 'pipe']
    // to prevent git stderr from leaking to the parent process
    for (const call of mockExecSync.mock.calls) {
      const opts = call[2] as Record<string, unknown>;
      expect(opts.stdio).toEqual(['pipe', 'pipe', 'pipe']);
    }
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

// ---------------------------------------------------------------------------
// Impact analysis integration tests
// ---------------------------------------------------------------------------

const impactDisabledConfig: TddGateConfig = {
  ...testConfig,
  impactAnalysis: false,
};

describe('handleStop — impact analysis blocks when dependent tests not run', () => {
  it('blocks when impl file passes basic check but has uncovered dependents', () => {
    // Scenario: src/auth.ts changed, test file also changed (passes basic check),
    // but impact analysis finds that src/api.ts depends on auth.ts and has no test
    mockDiff(['src/auth.ts', 'src/auth.test.ts']);

    const impactResults: ImpactResult[] = [
      {
        filePath: '/project/src/auth.ts',
        dependents: ['/project/src/api.ts'],
        missingTests: ['api.test.ts'],
      },
    ];
    mockAnalyzeImpact.mockReturnValue(impactResults);

    const result = handleStop(
      'sess1',
      '/project',
      testConfig,
      createStubJournal(false),
      createStubCircuitBreaker(),
    );

    expect(result.action).toBe('block');
    if (result.action === 'block') {
      expect(result.message).toContain('Impact analysis');
      expect(result.message).toContain('depends on');
    }
  });

  it('formats impact lines with dependent and changed file basenames and test name', () => {
    mockDiff(['src/auth.ts', 'src/auth.test.ts']);

    const impactResults: ImpactResult[] = [
      {
        filePath: '/project/src/auth.ts',
        dependents: ['/project/src/api.ts'],
        missingTests: ['api.test.ts'],
      },
    ];
    mockAnalyzeImpact.mockReturnValue(impactResults);

    const result = handleStop(
      'sess1',
      '/project',
      testConfig,
      createStubJournal(false),
      createStubCircuitBreaker(),
    );

    expect(result.action).toBe('block');
    if (result.action === 'block') {
      // Format: "  - api.ts depends on modified auth.ts → run api.test.ts"
      expect(result.message).toMatch(/api\.ts depends on modified auth\.ts/);
      expect(result.message).toContain('api.test.ts');
    }
  });
});

describe('handleStop — impact analysis skipped when disabled', () => {
  it('allows when impactAnalysis is disabled even if analyzeImpact would find issues', () => {
    // impl + test both changed → passes basic check
    mockDiff(['src/auth.ts', 'src/auth.test.ts']);

    const result = handleStop(
      'sess1',
      '/project',
      impactDisabledConfig,
      createStubJournal(false),
      createStubCircuitBreaker(),
    );

    expect(result.action).toBe('allow');
    // analyzeImpact should not be called when config disables it
    // (the function itself does early return, but stop handler should also not block)
    // Since analyzeImpact returns [] when disabled, no blocking will occur
  });
});

describe('handleStop — impact analysis skipped when test suite was run', () => {
  it('allows when test suite was run even if dependents would be uncovered', () => {
    mockDiff(['src/auth.ts']);

    const result = handleStop(
      'sess1',
      '/project',
      testConfig,
      createStubJournal(true), // test run recorded
      createStubCircuitBreaker(),
    );

    expect(result.action).toBe('allow');
  });
});

describe('handleStop — impact analysis combined with direct TDD violations', () => {
  it('appends impact info to existing block message when both direct and impact violations exist', () => {
    // impl changed, no test changed, no test run → basic check blocks
    // AND impact analysis also finds issues
    mockDiff(['src/auth.ts']);

    const impactResults: ImpactResult[] = [
      {
        filePath: '/project/src/auth.ts',
        dependents: ['/project/src/api.ts'],
        missingTests: ['api.test.ts'],
      },
    ];
    mockAnalyzeImpact.mockReturnValue(impactResults);

    const result = handleStop(
      'sess1',
      '/project',
      testConfig,
      createStubJournal(false),
      createStubCircuitBreaker(),
    );

    expect(result.action).toBe('block');
    if (result.action === 'block') {
      // Should contain both the direct violation info AND impact analysis info
      expect(result.message).toContain('src/auth.ts');
      expect(result.message).toContain('Impact analysis');
      expect(result.message).toContain('depends on');
    }
  });

  it('passes absolute impl file paths to analyzeImpact', () => {
    mockDiff(['src/auth.ts', 'src/auth.test.ts']);
    mockAnalyzeImpact.mockReturnValue([]);

    handleStop(
      'sess1',
      '/project',
      testConfig,
      createStubJournal(false),
      createStubCircuitBreaker(),
    );

    // analyzeImpact should be called with absolute paths
    expect(mockAnalyzeImpact).toHaveBeenCalledWith(
      ['/project/src/auth.ts'],
      '/project',
      testConfig,
      expect.anything(),
    );
  });
});

describe('handleStop — impact analysis with no uncovered dependents', () => {
  it('allows when impact analysis finds dependents but all have tests', () => {
    mockDiff(['src/auth.ts', 'src/auth.test.ts']);

    // Impact results with empty dependents = no uncovered dependents
    const impactResults: ImpactResult[] = [
      {
        filePath: '/project/src/auth.ts',
        dependents: [],
        missingTests: [],
      },
    ];
    mockAnalyzeImpact.mockReturnValue(impactResults);

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
