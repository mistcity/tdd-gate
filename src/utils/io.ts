/**
 * IO utility functions for tdd-gate hooks.
 *
 * Provides:
 *  - readStdin   – read all of stdin with a 5-second timeout
 *  - parseHookInput – safely parse raw JSON into a typed HookInput
 *  - allow        – approve a hook call (stdout "ok", exit 0)
 *  - deny         – deny a PreToolUse with a reason (JSON to stdout, exit 0)
 *  - blockCompletion – block a Stop with a message (stdout + stderr, exit 2)
 */

import type { HookInput } from '../types.js';

// ---------------------------------------------------------------------------
// readStdin
// ---------------------------------------------------------------------------

/**
 * Read all of stdin into a string.
 * Returns an empty string on timeout (5 s) or any I/O error.
 */
export function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    const timer = setTimeout(() => resolve(''), 5_000);

    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (chunk: string) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      clearTimeout(timer);
      resolve(data);
    });

    process.stdin.on('error', () => {
      clearTimeout(timer);
      resolve('');
    });
  });
}

// ---------------------------------------------------------------------------
// parseHookInput
// ---------------------------------------------------------------------------

/**
 * Parse a raw JSON string into a HookInput.
 * Returns null if:
 *  - the string is empty or not valid JSON
 *  - the parsed object is missing hook_event_name or session_id
 * Never throws.
 */
export function parseHookInput(raw: string): HookInput | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('hook_event_name' in parsed) ||
      !('session_id' in parsed)
    ) {
      return null;
    }

    const obj = parsed as Record<string, unknown>;

    if (typeof obj['hook_event_name'] !== 'string' || typeof obj['session_id'] !== 'string') {
      return null;
    }

    return parsed as HookInput;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// allow
// ---------------------------------------------------------------------------

/**
 * Approve the current hook invocation.
 * Writes "ok\n" to stdout and exits with code 0.
 */
export function allow(): void {
  process.stdout.write('ok\n');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// deny
// ---------------------------------------------------------------------------

/**
 * Deny a PreToolUse hook invocation with a human-readable reason.
 * Writes the Claude Code deny JSON payload to stdout and exits with code 0.
 */
export function deny(reason: string): void {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse' as const,
      permissionDecision: 'deny' as const,
      permissionDecisionReason: reason,
    },
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// blockCompletion
// ---------------------------------------------------------------------------

/**
 * Block a Stop hook (completion gate failed).
 * Writes "blocked\n" to stdout, the message to stderr, and exits with code 2.
 */
export function blockCompletion(message: string): void {
  process.stdout.write('blocked\n');
  process.stderr.write(`${message}\n`);
  process.exit(2);
}
