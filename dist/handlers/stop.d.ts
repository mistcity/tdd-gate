/**
 * Stop handler — completion audit that checks whether impl files changed
 * without corresponding test files or a recorded test run.
 */
import { Journal } from '../core/journal.js';
import { CircuitBreaker } from '../core/circuit-breaker.js';
import type { TddGateConfig } from '../types.js';
export declare function handleStop(_sessionId: string, cwd: string, config: TddGateConfig, journal: Journal, circuitBreaker: CircuitBreaker): {
    action: 'allow';
    summary?: string;
} | {
    action: 'block';
    message: string;
};
//# sourceMappingURL=stop.d.ts.map