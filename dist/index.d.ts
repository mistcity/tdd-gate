#!/usr/bin/env node
import type { HookInput } from './types.js';
/**
 * Route a parsed hook input to the appropriate handler and return the result.
 * Does NOT perform any I/O (no stdout writes, no process.exit).
 */
export declare function route(input: HookInput, cwd: string): {
    action: 'allow';
    summary?: string;
} | {
    action: 'deny';
    reason: string;
} | {
    action: 'block';
    message: string;
};
//# sourceMappingURL=index.d.ts.map