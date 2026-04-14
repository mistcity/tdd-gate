import { describe, it, expect, vi, afterEach } from 'vitest';
import { route } from './index.js';
import type { PreToolUseInput, UserPromptSubmitInput, StopInput, HookInput } from './types.js';
import os from 'os';
import fs from 'fs';
import path from 'path';

// Mock child_process to prevent real git calls from Stop handler
vi.mock('child_process', () => ({
  execFileSync: vi.fn(() => ''),
}));

// Helper to clean up state files for a given sessionId after each test
const createdSessions: string[] = [];

afterEach(() => {
  for (const sessionId of createdSessions) {
    const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const tmpDir = os.tmpdir();
    const suffixes = ['journal', 'test-ran'];
    for (const suffix of suffixes) {
      const filePath = path.join(tmpDir, `tdd-gate-${suffix}-${safeId}.log`);
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    }
    // counter file has no .log suffix
    const counterPath = path.join(tmpDir, `tdd-gate-counter-${safeId}`);
    try { fs.unlinkSync(counterPath); } catch { /* ignore */ }
  }
  createdSessions.length = 0;
});

describe('route', () => {
  it('routes PreToolUse and allows exempt files', () => {
    const sessionId = 'test-route-1';
    createdSessions.push(sessionId);
    const input: PreToolUseInput = {
      hook_event_name: 'PreToolUse',
      session_id: sessionId,
      tool_name: 'Write',
      tool_input: { file_path: '/tmp/foo.json' },
    };
    expect(route(input, '/tmp')).toEqual({ action: 'allow' });
  });

  it('routes PreToolUse and denies impl without test', () => {
    const sessionId = 'test-route-2';
    createdSessions.push(sessionId);
    const input: PreToolUseInput = {
      hook_event_name: 'PreToolUse',
      session_id: sessionId,
      tool_name: 'Write',
      tool_input: { file_path: '/tmp/foo.ts' },
    };
    const result = route(input, '/tmp');
    expect(result.action).toBe('deny');
  });

  it('routes UserPromptSubmit and allows', () => {
    const sessionId = 'test-route-3';
    createdSessions.push(sessionId);
    const input: UserPromptSubmitInput = {
      hook_event_name: 'UserPromptSubmit',
      session_id: sessionId,
    };
    expect(route(input, '/tmp')).toEqual({ action: 'allow' });
  });

  it('routes Stop and allows when stop_hook_active', () => {
    const sessionId = 'test-route-4';
    createdSessions.push(sessionId);
    const input: StopInput = {
      hook_event_name: 'Stop',
      session_id: sessionId,
      stop_hook_active: true,
    };
    expect(route(input, '/tmp')).toEqual({ action: 'allow' });
  });

  it('routes unknown event name and allows', () => {
    const input = {
      hook_event_name: 'SomeOtherEvent',
      session_id: 'test-route-5',
    } as unknown as HookInput;
    expect(route(input, '/tmp')).toEqual({ action: 'allow' });
  });

  it('routes Stop (non-recursive) and allows when no git changes', () => {
    const sessionId = 'test-route-6';
    createdSessions.push(sessionId);
    const input: StopInput = {
      hook_event_name: 'Stop',
      session_id: sessionId,
      stop_hook_active: false,
    };
    // execFileSync is mocked to return '' (no changed files) → allow
    expect(route(input, '/tmp')).toEqual({ action: 'allow' });
  });

  it('routes PreToolUse and allows after test file recorded', () => {
    const sessionId = 'test-route-7';
    createdSessions.push(sessionId);
    // First write the test file → journal records it
    const testInput: PreToolUseInput = {
      hook_event_name: 'PreToolUse',
      session_id: sessionId,
      tool_name: 'Write',
      tool_input: { file_path: '/tmp/foo.test.ts' },
    };
    expect(route(testInput, '/tmp')).toEqual({ action: 'allow' });

    // Now write the impl file → should be allowed because test was recorded
    const implInput: PreToolUseInput = {
      hook_event_name: 'PreToolUse',
      session_id: sessionId,
      tool_name: 'Write',
      tool_input: { file_path: '/tmp/foo.ts' },
    };
    expect(route(implInput, '/tmp')).toEqual({ action: 'allow' });
  });
});
