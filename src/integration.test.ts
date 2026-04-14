/**
 * Integration tests — exercise the full flow: JSON input → route() → handler result.
 *
 * Uses route() exported from src/index.ts to test the complete routing and
 * handling pipeline without dealing with stdin/stdout.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { route } from './index.js';
import type { PreToolUseInput, UserPromptSubmitInput, StopInput, HookInput } from './types.js';
import { StateManager } from './core/state.js';

// Mock child_process for Stop handler git calls
vi.mock('child_process', () => ({
  execFileSync: vi.fn(() => ''),
}));

// ---------------------------------------------------------------------------
// Helper builders — reduce boilerplate
// ---------------------------------------------------------------------------

function makeWrite(sessionId: string, filePath: string): PreToolUseInput {
  return {
    hook_event_name: 'PreToolUse',
    session_id: sessionId,
    tool_name: 'Write',
    tool_input: { file_path: filePath },
  };
}

function makeBash(sessionId: string, command: string): PreToolUseInput {
  return {
    hook_event_name: 'PreToolUse',
    session_id: sessionId,
    tool_name: 'Bash',
    tool_input: { command },
  };
}

function makeUserPromptSubmit(sessionId: string): UserPromptSubmitInput {
  return {
    hook_event_name: 'UserPromptSubmit',
    session_id: sessionId,
  };
}

function makeStop(sessionId: string, stopHookActive = false): StopInput {
  return {
    hook_event_name: 'Stop',
    session_id: sessionId,
    stop_hook_active: stopHookActive,
  };
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

const SESSION_IDS = [
  'integ-test-1',
  'integ-test-2',
  'integ-test-3',
  'integ-test-4',
  'integ-test-5',
  'integ-test-6',
  'integ-test-7',
  'integ-test-8',
  'integ-test-9a',
  'integ-test-9b',
  'integ-test-9c',
];

beforeEach(() => {
  // Clean up any stale state from previous runs
  for (const id of SESSION_IDS) {
    new StateManager(id).clearAll();
  }
});

afterEach(() => {
  // Clean up after each test
  for (const id of SESSION_IDS) {
    new StateManager(id).clearAll();
  }
});

// ---------------------------------------------------------------------------
// Scenario 1: Full TDD Flow (Red-Green)
// ---------------------------------------------------------------------------

describe('Scenario 1: Full TDD flow (Red-Green)', () => {
  it('write test file → allow, then write impl file → allow', () => {
    const sessionId = 'integ-test-1';

    // Step 1: Write test file → should be allowed and recorded in journal
    const testResult = route(makeWrite(sessionId, '/project/foo.test.ts'), '/project');
    expect(testResult).toEqual({ action: 'allow' });

    // Step 2: Write impl file → should be allowed because test was already recorded
    const implResult = route(makeWrite(sessionId, '/project/foo.ts'), '/project');
    expect(implResult).toEqual({ action: 'allow' });
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: TDD Violation
// ---------------------------------------------------------------------------

describe('Scenario 2: TDD violation', () => {
  it('write impl file without writing test first → deny with expected test name', () => {
    const sessionId = 'integ-test-2';

    // Write impl without any test → should be denied
    const result = route(makeWrite(sessionId, '/project/bar.ts'), '/project');
    expect(result.action).toBe('deny');

    // Deny reason should mention the expected test file name
    if (result.action === 'deny') {
      expect(result.reason).toContain('bar.test.ts');
    }
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: Bash Write TDD Check
// ---------------------------------------------------------------------------

describe('Scenario 3: Bash write TDD check', () => {
  it('bash echo > impl.ts without test → deny', () => {
    const sessionId = 'integ-test-3';

    const result = route(makeBash(sessionId, 'echo "hello" > /project/impl.ts'), '/project');
    expect(result.action).toBe('deny');
  });

  it('record test via Write, then bash echo > impl.ts → allow', () => {
    const sessionId = 'integ-test-3';

    // Record the test file via Write
    route(makeWrite(sessionId, '/project/impl.test.ts'), '/project');

    // Now bash write the impl file → should be allowed
    const result = route(makeBash(sessionId, 'echo "hello" > /project/impl.ts'), '/project');
    expect(result).toEqual({ action: 'allow' });
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: Bash Test Command
// ---------------------------------------------------------------------------

describe('Scenario 4: Bash test command', () => {
  it('npm test → allow', () => {
    const sessionId = 'integ-test-4';

    const result = route(makeBash(sessionId, 'npm test'), '/project');
    expect(result).toEqual({ action: 'allow' });
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: Exempt Files Pass Through
// ---------------------------------------------------------------------------

describe('Scenario 5: Exempt files pass through', () => {
  it('.json file → allow', () => {
    const sessionId = 'integ-test-5';

    const result = route(makeWrite(sessionId, '/project/config.json'), '/project');
    expect(result).toEqual({ action: 'allow' });
  });

  it('.md file → allow', () => {
    const sessionId = 'integ-test-5';

    const result = route(makeWrite(sessionId, '/project/README.md'), '/project');
    expect(result).toEqual({ action: 'allow' });
  });

  it('file in exempt path → allow', () => {
    const sessionId = 'integ-test-5';

    // node_modules is not in exempt paths by default, but we can test a file
    // that has an exempt extension (.yaml)
    const result = route(makeWrite(sessionId, '/project/config/app.yaml'), '/project');
    expect(result).toEqual({ action: 'allow' });
  });
});

// ---------------------------------------------------------------------------
// Scenario 6: UserPromptSubmit Resets State
// ---------------------------------------------------------------------------

describe('Scenario 6: UserPromptSubmit resets state', () => {
  it('write test, then UserPromptSubmit clears journal, then write impl → deny', () => {
    const sessionId = 'integ-test-6';

    // Step 1: Write test file (records in journal)
    route(makeWrite(sessionId, '/project/widget.test.ts'), '/project');

    // Step 2: UserPromptSubmit event (clears journal)
    route(makeUserPromptSubmit(sessionId), '/project');

    // Step 3: Write impl file → deny (journal was cleared, no test recorded)
    const result = route(makeWrite(sessionId, '/project/widget.ts'), '/project');
    expect(result.action).toBe('deny');
  });
});

// ---------------------------------------------------------------------------
// Scenario 7: Stop Handler Allows
// ---------------------------------------------------------------------------

describe('Scenario 7: Stop handler allows', () => {
  it('Stop event with no git changes → allow', () => {
    const sessionId = 'integ-test-7';

    // execFileSync is mocked to return '' (empty output = no changed files)
    const result = route(makeStop(sessionId), '/project');
    expect(result).toEqual({ action: 'allow' });
  });

  it('Stop event with stop_hook_active=true → allow (prevent recursion)', () => {
    const sessionId = 'integ-test-7';

    const result = route(makeStop(sessionId, true), '/project');
    expect(result).toEqual({ action: 'allow' });
  });
});

// ---------------------------------------------------------------------------
// Scenario 8: Unknown Events Pass Through
// ---------------------------------------------------------------------------

describe('Scenario 8: Unknown events pass through', () => {
  it('unknown event name → allow', () => {
    const input = {
      hook_event_name: 'SomeUnknownEvent',
      session_id: 'integ-test-8',
    } as unknown as HookInput;

    const result = route(input, '/project');
    expect(result).toEqual({ action: 'allow' });
  });
});

// ---------------------------------------------------------------------------
// Scenario 9: Multiple Language Support
// ---------------------------------------------------------------------------

describe('Scenario 9: Multiple language support', () => {
  it('Python: test_foo.py → allow, then foo.py → allow', () => {
    const sessionId = 'integ-test-9a';

    // Write the Python test file
    const testResult = route(makeWrite(sessionId, '/project/test_foo.py'), '/project');
    expect(testResult).toEqual({ action: 'allow' });

    // Write the Python impl file → should be allowed because test was recorded
    const implResult = route(makeWrite(sessionId, '/project/foo.py'), '/project');
    expect(implResult).toEqual({ action: 'allow' });
  });

  it('Go: foo_test.go → allow, then foo.go → allow', () => {
    const sessionId = 'integ-test-9b';

    // Write the Go test file
    const testResult = route(makeWrite(sessionId, '/project/foo_test.go'), '/project');
    expect(testResult).toEqual({ action: 'allow' });

    // Write the Go impl file → should be allowed because test was recorded
    const implResult = route(makeWrite(sessionId, '/project/foo.go'), '/project');
    expect(implResult).toEqual({ action: 'allow' });
  });

  it('Kotlin: FooTest.kt → allow, then Foo.kt → allow', () => {
    const sessionId = 'integ-test-9c';

    // Write the Kotlin test file
    const testResult = route(makeWrite(sessionId, '/project/FooTest.kt'), '/project');
    expect(testResult).toEqual({ action: 'allow' });

    // Write the Kotlin impl file → should be allowed because test was recorded
    const implResult = route(makeWrite(sessionId, '/project/Foo.kt'), '/project');
    expect(implResult).toEqual({ action: 'allow' });
  });
});
