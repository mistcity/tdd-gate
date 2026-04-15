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
// ---------------------------------------------------------------------------
// readStdin
// ---------------------------------------------------------------------------
/**
 * Read all of stdin into a string.
 * Returns an empty string on timeout (5 s) or any I/O error.
 */
export function readStdin() {
    return new Promise((resolve) => {
        let data = '';
        const timer = setTimeout(() => {
            process.stderr.write('[tdd-gate] stdin read timed out (fail-open)\n');
            resolve('');
        }, 5_000);
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk) => {
            data += chunk;
        });
        process.stdin.on('end', () => {
            clearTimeout(timer);
            resolve(data);
        });
        process.stdin.on('error', (err) => {
            clearTimeout(timer);
            process.stderr.write(`[tdd-gate] stdin error (fail-open): ${err.message}\n`);
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
export function parseHookInput(raw) {
    if (!raw)
        return null;
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' ||
            parsed === null ||
            !('hook_event_name' in parsed) ||
            !('session_id' in parsed)) {
            return null;
        }
        const obj = parsed;
        if (typeof obj['hook_event_name'] !== 'string' || typeof obj['session_id'] !== 'string') {
            return null;
        }
        return parsed;
    }
    catch {
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
export function allow() {
    process.stdout.write('ok\n');
    process.exit(0);
}
// ---------------------------------------------------------------------------
// allowWithSummary
// ---------------------------------------------------------------------------
/**
 * Approve the current hook invocation and output an audit summary to stderr.
 * Used in observe mode to report violations without blocking.
 * Writes "ok\n" to stdout, the summary to stderr, and exits with code 0.
 */
export function allowWithSummary(summary) {
    process.stdout.write('ok\n');
    process.stderr.write(`${summary}\n`);
    process.exit(0);
}
// ---------------------------------------------------------------------------
// deny
// ---------------------------------------------------------------------------
/**
 * Deny a PreToolUse hook invocation with a human-readable reason.
 * Writes the Claude Code deny JSON payload to stdout and exits with code 0.
 */
export function deny(reason) {
    const output = {
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
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
export function blockCompletion(message) {
    process.stdout.write('blocked\n');
    process.stderr.write(`${message}\n`);
    process.exit(2);
}
//# sourceMappingURL=io.js.map