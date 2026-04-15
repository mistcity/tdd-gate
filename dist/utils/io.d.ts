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
/**
 * Read all of stdin into a string.
 * Returns an empty string on timeout (5 s) or any I/O error.
 */
export declare function readStdin(): Promise<string>;
/**
 * Parse a raw JSON string into a HookInput.
 * Returns null if:
 *  - the string is empty or not valid JSON
 *  - the parsed object is missing hook_event_name or session_id
 * Never throws.
 */
export declare function parseHookInput(raw: string): HookInput | null;
/**
 * Approve the current hook invocation.
 * Writes "ok\n" to stdout and exits with code 0.
 */
export declare function allow(): void;
/**
 * Approve the current hook invocation and output an audit summary to stderr.
 * Used in observe mode to report violations without blocking.
 * Writes "ok\n" to stdout, the summary to stderr, and exits with code 0.
 */
export declare function allowWithSummary(summary: string): void;
/**
 * Deny a PreToolUse hook invocation with a human-readable reason.
 * Writes the Claude Code deny JSON payload to stdout and exits with code 0.
 */
export declare function deny(reason: string): void;
/**
 * Block a Stop hook (completion gate failed).
 * Writes "blocked\n" to stdout, the message to stderr, and exits with code 2.
 */
export declare function blockCompletion(message: string): void;
//# sourceMappingURL=io.d.ts.map