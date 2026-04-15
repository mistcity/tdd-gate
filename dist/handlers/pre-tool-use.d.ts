/**
 * PreToolUse handler — core TDD enforcement logic.
 *
 * Intercepts Write/Edit/MultiEdit/Bash tool invocations and enforces
 * "test first" discipline: implementation files may only be written
 * after their corresponding test file has been edited in the same session.
 */
import type { Journal } from '../core/journal.js';
import type { CircuitBreaker } from '../core/circuit-breaker.js';
import type { PreToolUseInput, TddGateConfig } from '../types.js';
type PreToolUseResult = {
    action: 'allow';
} | {
    action: 'deny';
    reason: string;
};
export declare function handlePreToolUse(input: PreToolUseInput, config: TddGateConfig, journal: Journal, circuitBreaker: CircuitBreaker): PreToolUseResult;
export {};
//# sourceMappingURL=pre-tool-use.d.ts.map