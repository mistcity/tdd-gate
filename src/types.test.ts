/**
 * Type-level tests for types.ts
 * These tests validate that the type definitions compile correctly and
 * that the shapes are as expected. We use satisfies and assignment
 * checks as compile-time assertions, plus runtime shape checks.
 */
import { describe, it, expect } from 'vitest';
import type {
  HookInputBase,
  PreToolUseInput,
  UserPromptSubmitInput,
  StopInput,
  HookInput,
  DenyOutput,
  LanguageConfig,
  ExemptConfig,
  CircuitBreakerConfig,
  TddGateConfig,
  LanguageDefinition,
  JournalEntryType,
  JournalEntry,
  BashWriteTarget,
  BashAnalysisResult,
} from './types.js';

// ---------------------------------------------------------------------------
// HookInputBase
// ---------------------------------------------------------------------------
describe('HookInputBase', () => {
  it('accepts required fields', () => {
    const base: HookInputBase = {
      hook_event_name: 'SomeEvent',
      session_id: 'sess-123',
    };
    expect(base.hook_event_name).toBe('SomeEvent');
    expect(base.session_id).toBe('sess-123');
  });

  it('accepts optional cwd field', () => {
    const base: HookInputBase = {
      hook_event_name: 'SomeEvent',
      session_id: 'sess-123',
      cwd: '/home/user/project',
    };
    expect(base.cwd).toBe('/home/user/project');
  });
});

// ---------------------------------------------------------------------------
// PreToolUseInput
// ---------------------------------------------------------------------------
describe('PreToolUseInput', () => {
  it('accepts Write tool input', () => {
    const input: PreToolUseInput = {
      hook_event_name: 'PreToolUse',
      session_id: 'sess-1',
      tool_name: 'Write',
      tool_input: {
        file_path: '/tmp/foo.ts',
        content: 'hello world',
      },
    };
    expect(input.tool_name).toBe('Write');
    expect(input.tool_input.file_path).toBe('/tmp/foo.ts');
  });

  it('accepts Edit tool input', () => {
    const input: PreToolUseInput = {
      hook_event_name: 'PreToolUse',
      session_id: 'sess-1',
      tool_name: 'Edit',
      tool_input: {
        file_path: '/tmp/foo.ts',
        old_string: 'old',
        new_string: 'new',
      },
    };
    expect(input.tool_name).toBe('Edit');
  });

  it('accepts MultiEdit tool input', () => {
    const input: PreToolUseInput = {
      hook_event_name: 'PreToolUse',
      session_id: 'sess-1',
      tool_name: 'MultiEdit',
      tool_input: {
        file_path: '/tmp/foo.ts',
      },
    };
    expect(input.tool_name).toBe('MultiEdit');
  });

  it('accepts Bash tool input', () => {
    const input: PreToolUseInput = {
      hook_event_name: 'PreToolUse',
      session_id: 'sess-1',
      tool_name: 'Bash',
      tool_input: {
        command: 'echo hello',
      },
    };
    expect(input.tool_name).toBe('Bash');
    expect(input.tool_input.command).toBe('echo hello');
  });

  it('has hook_event_name discriminant "PreToolUse"', () => {
    const input: PreToolUseInput = {
      hook_event_name: 'PreToolUse',
      session_id: 'sess-1',
      tool_name: 'Bash',
      tool_input: {},
    };
    expect(input.hook_event_name).toBe('PreToolUse');
  });
});

// ---------------------------------------------------------------------------
// UserPromptSubmitInput
// ---------------------------------------------------------------------------
describe('UserPromptSubmitInput', () => {
  it('accepts required fields', () => {
    const input: UserPromptSubmitInput = {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'sess-2',
    };
    expect(input.hook_event_name).toBe('UserPromptSubmit');
  });

  it('accepts optional user_prompt', () => {
    const input: UserPromptSubmitInput = {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'sess-2',
      user_prompt: 'Write a test for me',
    };
    expect(input.user_prompt).toBe('Write a test for me');
  });
});

// ---------------------------------------------------------------------------
// StopInput
// ---------------------------------------------------------------------------
describe('StopInput', () => {
  it('accepts required fields', () => {
    const input: StopInput = {
      hook_event_name: 'Stop',
      session_id: 'sess-3',
    };
    expect(input.hook_event_name).toBe('Stop');
  });

  it('accepts optional stop_hook_active', () => {
    const input: StopInput = {
      hook_event_name: 'Stop',
      session_id: 'sess-3',
      stop_hook_active: true,
    };
    expect(input.stop_hook_active).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// HookInput union narrowing
// ---------------------------------------------------------------------------
describe('HookInput union', () => {
  it('narrows to PreToolUseInput via discriminant', () => {
    const input: HookInput = {
      hook_event_name: 'PreToolUse',
      session_id: 'sess-1',
      tool_name: 'Write',
      tool_input: { file_path: '/tmp/a.ts' },
    };

    if (input.hook_event_name === 'PreToolUse') {
      expect(input.tool_name).toBe('Write');
    } else {
      throw new Error('Should have narrowed to PreToolUseInput');
    }
  });

  it('narrows to UserPromptSubmitInput via discriminant', () => {
    const input: HookInput = {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'sess-2',
      user_prompt: 'hi',
    };

    if (input.hook_event_name === 'UserPromptSubmit') {
      expect(input.user_prompt).toBe('hi');
    } else {
      throw new Error('Should have narrowed to UserPromptSubmitInput');
    }
  });

  it('narrows to StopInput via discriminant', () => {
    const input: HookInput = {
      hook_event_name: 'Stop',
      session_id: 'sess-3',
      stop_hook_active: false,
    };

    if (input.hook_event_name === 'Stop') {
      expect(input.stop_hook_active).toBe(false);
    } else {
      throw new Error('Should have narrowed to StopInput');
    }
  });
});

// ---------------------------------------------------------------------------
// DenyOutput
// ---------------------------------------------------------------------------
describe('DenyOutput', () => {
  it('has the expected shape', () => {
    const output: DenyOutput = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'No test file found',
      },
    };
    expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(output.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    expect(output.hookSpecificOutput.permissionDecisionReason).toBe(
      'No test file found'
    );
  });
});

// ---------------------------------------------------------------------------
// LanguageConfig
// ---------------------------------------------------------------------------
describe('LanguageConfig', () => {
  it('has enabled boolean', () => {
    const config: LanguageConfig = { enabled: true };
    expect(config.enabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ExemptConfig
// ---------------------------------------------------------------------------
describe('ExemptConfig', () => {
  it('has extensions and paths arrays', () => {
    const config: ExemptConfig = {
      extensions: ['.md', '.json'],
      paths: ['dist/', 'node_modules/'],
    };
    expect(config.extensions).toContain('.md');
    expect(config.paths).toContain('dist/');
  });
});

// ---------------------------------------------------------------------------
// CircuitBreakerConfig
// ---------------------------------------------------------------------------
describe('CircuitBreakerConfig', () => {
  it('has preToolUse and stop numeric fields', () => {
    const config: CircuitBreakerConfig = {
      preToolUse: 10,
      stop: 5,
    };
    expect(config.preToolUse).toBe(10);
    expect(config.stop).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// TddGateConfig
// ---------------------------------------------------------------------------
describe('TddGateConfig', () => {
  it('has all required top-level fields', () => {
    const config: TddGateConfig = {
      languages: {
        typescript: { enabled: true },
        python: { enabled: false },
      },
      exempt: {
        extensions: ['.md'],
        paths: ['dist/'],
      },
      bashDetection: true,
      completionAudit: false,
      circuitBreaker: {
        preToolUse: 20,
        stop: 10,
      },
    };
    expect(config.bashDetection).toBe(true);
    expect(config.completionAudit).toBe(false);
    expect(config.languages['typescript'].enabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// LanguageDefinition
// ---------------------------------------------------------------------------
describe('LanguageDefinition', () => {
  it('has name, extensions, testPatterns, and isTestFile', () => {
    const lang: LanguageDefinition = {
      name: 'TypeScript',
      extensions: ['.ts'],
      testPatterns: (basename: string) => [
        basename.replace('.ts', '.test.ts'),
        basename.replace('.ts', '.spec.ts'),
      ],
      isTestFile: (basename: string) =>
        basename.endsWith('.test.ts') || basename.endsWith('.spec.ts'),
    };

    expect(lang.name).toBe('TypeScript');
    expect(lang.extensions).toContain('.ts');
    expect(lang.testPatterns('foo.ts')).toEqual([
      'foo.test.ts',
      'foo.spec.ts',
    ]);
    expect(lang.isTestFile('foo.test.ts')).toBe(true);
    expect(lang.isTestFile('foo.ts')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// JournalEntryType
// ---------------------------------------------------------------------------
describe('JournalEntryType', () => {
  it('accepts TEST, IMPL, TEST_RUN values', () => {
    const t1: JournalEntryType = 'TEST';
    const t2: JournalEntryType = 'IMPL';
    const t3: JournalEntryType = 'TEST_RUN';
    expect(t1).toBe('TEST');
    expect(t2).toBe('IMPL');
    expect(t3).toBe('TEST_RUN');
  });
});

// ---------------------------------------------------------------------------
// JournalEntry
// ---------------------------------------------------------------------------
describe('JournalEntry', () => {
  it('has timestamp, type, and filePath fields', () => {
    const entry: JournalEntry = {
      timestamp: Date.now(),
      type: 'TEST',
      filePath: '/tmp/tdd-gate/src/foo.test.ts',
    };
    expect(typeof entry.timestamp).toBe('number');
    expect(entry.type).toBe('TEST');
    expect(entry.filePath).toContain('foo.test.ts');
  });
});

// ---------------------------------------------------------------------------
// BashWriteTarget
// ---------------------------------------------------------------------------
describe('BashWriteTarget', () => {
  it('has filePath and command fields', () => {
    const target: BashWriteTarget = {
      filePath: '/tmp/out.ts',
      command: 'cat >',
    };
    expect(target.filePath).toBe('/tmp/out.ts');
    expect(target.command).toBe('cat >');
  });
});

// ---------------------------------------------------------------------------
// BashAnalysisResult
// ---------------------------------------------------------------------------
describe('BashAnalysisResult', () => {
  it('has isTestCommand boolean and writeTargets array', () => {
    const result: BashAnalysisResult = {
      isTestCommand: true,
      writeTargets: [
        { filePath: '/tmp/out.ts', command: 'cat >' },
      ],
    };
    expect(result.isTestCommand).toBe(true);
    expect(result.writeTargets).toHaveLength(1);
    expect(result.writeTargets[0].command).toBe('cat >');
  });

  it('accepts empty writeTargets', () => {
    const result: BashAnalysisResult = {
      isTestCommand: false,
      writeTargets: [],
    };
    expect(result.writeTargets).toHaveLength(0);
  });
});
