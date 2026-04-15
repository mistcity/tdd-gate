#!/usr/bin/env node
import { readStdin, parseHookInput, allow, deny, blockCompletion, allowWithSummary } from './utils/io.js';
import { handlePreToolUse } from './handlers/pre-tool-use.js';
import { handleUserPromptSubmit } from './handlers/user-prompt.js';
import { handleStop } from './handlers/stop.js';
import { loadConfig } from './core/config.js';
import { StateManager } from './core/state.js';
import { Journal } from './core/journal.js';
import { CircuitBreaker } from './core/circuit-breaker.js';
// ---------------------------------------------------------------------------
// route — pure routing logic, exported for testing
// ---------------------------------------------------------------------------
/**
 * Route a parsed hook input to the appropriate handler and return the result.
 * Does NOT perform any I/O (no stdout writes, no process.exit).
 */
export function route(input, cwd) {
    const sessionId = input.session_id;
    const config = loadConfig(cwd);
    switch (input.hook_event_name) {
        case 'PreToolUse': {
            const state = new StateManager(sessionId);
            const journal = new Journal(state.journalPath);
            const cb = new CircuitBreaker(state.counterPath, config.circuitBreaker.preToolUse);
            return handlePreToolUse(input, config, journal, cb);
        }
        case 'UserPromptSubmit': {
            handleUserPromptSubmit(sessionId);
            return { action: 'allow' };
        }
        case 'Stop': {
            const stopInput = input;
            // Prevent recursion: if stop hook is already active, just allow
            if (stopInput.stop_hook_active)
                return { action: 'allow' };
            const state = new StateManager(sessionId);
            const journal = new Journal(state.journalPath);
            const cb = new CircuitBreaker(state.counterPath, config.circuitBreaker.stop);
            return handleStop(sessionId, cwd, config, journal, cb);
        }
        default:
            return { action: 'allow' };
    }
}
// ---------------------------------------------------------------------------
// main — reads stdin, routes, and writes output
// ---------------------------------------------------------------------------
async function main() {
    try {
        const raw = await readStdin();
        const input = parseHookInput(raw);
        if (!input) {
            allow();
            return;
        }
        const cwd = input.cwd ?? process.cwd();
        const result = route(input, cwd);
        switch (result.action) {
            case 'deny':
                deny(result.reason);
                break;
            case 'block':
                blockCompletion(result.message);
                break;
            case 'allow':
                if ('summary' in result && result.summary) {
                    allowWithSummary(result.summary);
                }
                else {
                    allow();
                }
                break;
        }
    }
    catch (err) {
        process.stderr.write(`[tdd-gate] internal error (fail-open): ${err instanceof Error ? err.message : String(err)}\n`);
        allow();
    }
}
main();
//# sourceMappingURL=index.js.map