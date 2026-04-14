/**
 * Tests for IO utility functions.
 *
 * Tests cover:
 *  - parseHookInput: valid inputs, invalid JSON, missing required fields
 *  - allow: outputs "ok" and exits with code 0
 *  - deny: outputs correct JSON format and exits with code 0
 *  - blockCompletion: outputs "blocked" to stdout, message to stderr, exits with code 2
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { parseHookInput, allow, deny, blockCompletion } from './io.js';

// ---------------------------------------------------------------------------
// parseHookInput
// ---------------------------------------------------------------------------

describe('parseHookInput', () => {
  it('parses a valid PreToolUse input', () => {
    const raw = JSON.stringify({
      hook_event_name: 'PreToolUse',
      session_id: 'sess-123',
      tool_name: 'Write',
      tool_input: { file_path: '/tmp/foo.ts' },
    });
    const result = parseHookInput(raw);
    expect(result).not.toBeNull();
    expect(result?.hook_event_name).toBe('PreToolUse');
    expect(result?.session_id).toBe('sess-123');
  });

  it('parses a valid UserPromptSubmit input', () => {
    const raw = JSON.stringify({
      hook_event_name: 'UserPromptSubmit',
      session_id: 'sess-456',
      user_prompt: 'Hello world',
    });
    const result = parseHookInput(raw);
    expect(result).not.toBeNull();
    expect(result?.hook_event_name).toBe('UserPromptSubmit');
    expect(result?.session_id).toBe('sess-456');
  });

  it('parses a valid Stop input', () => {
    const raw = JSON.stringify({
      hook_event_name: 'Stop',
      session_id: 'sess-789',
      stop_hook_active: false,
    });
    const result = parseHookInput(raw);
    expect(result).not.toBeNull();
    expect(result?.hook_event_name).toBe('Stop');
    expect(result?.session_id).toBe('sess-789');
  });

  it('returns null for invalid JSON', () => {
    expect(parseHookInput('not-json')).toBeNull();
    expect(parseHookInput('{broken')).toBeNull();
  });

  it('returns null when session_id is missing', () => {
    const raw = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'Write',
      tool_input: {},
    });
    expect(parseHookInput(raw)).toBeNull();
  });

  it('returns null when hook_event_name is missing', () => {
    const raw = JSON.stringify({
      session_id: 'sess-000',
      tool_name: 'Write',
      tool_input: {},
    });
    expect(parseHookInput(raw)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseHookInput('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// allow
// ---------------------------------------------------------------------------

describe('allow', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stdoutSpy: MockInstance<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let exitSpy: MockInstance<any>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes "ok" to stdout and exits with code 0', () => {
    allow();
    expect(stdoutSpy).toHaveBeenCalledWith('ok\n');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});

// ---------------------------------------------------------------------------
// deny
// ---------------------------------------------------------------------------

describe('deny', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stdoutSpy: MockInstance<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let exitSpy: MockInstance<any>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('outputs correct Claude Code deny JSON format and exits with code 0', () => {
    deny('test reason');

    expect(exitSpy).toHaveBeenCalledWith(0);

    const writtenArg = (stdoutSpy.mock.calls[0]?.[0] as string) ?? '';
    const parsed = JSON.parse(writtenArg);
    expect(parsed).toEqual({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'test reason',
      },
    });
  });

  it('includes the provided reason in the deny output', () => {
    deny('no tests found for src/utils/io.ts');

    const writtenArg = (stdoutSpy.mock.calls[0]?.[0] as string) ?? '';
    const parsed = JSON.parse(writtenArg);
    expect(parsed.hookSpecificOutput.permissionDecisionReason).toBe(
      'no tests found for src/utils/io.ts'
    );
  });
});

// ---------------------------------------------------------------------------
// blockCompletion
// ---------------------------------------------------------------------------

describe('blockCompletion', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stdoutSpy: MockInstance<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stderrSpy: MockInstance<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let exitSpy: MockInstance<any>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes "blocked" to stdout', () => {
    blockCompletion('TDD gate blocked: missing tests');
    expect(stdoutSpy).toHaveBeenCalledWith('blocked\n');
  });

  it('writes the message to stderr', () => {
    blockCompletion('TDD gate blocked: missing tests');
    expect(stderrSpy).toHaveBeenCalledWith('TDD gate blocked: missing tests\n');
  });

  it('exits with code 2', () => {
    blockCompletion('TDD gate blocked: missing tests');
    expect(exitSpy).toHaveBeenCalledWith(2);
  });
});
