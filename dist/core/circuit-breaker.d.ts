/**
 * CircuitBreaker — file-based counter that auto-allows when limit is exceeded.
 *
 * Designed for use in Claude Code hooks where repeated failures should
 * eventually be allowed through to avoid blocking the user indefinitely.
 */
export declare class CircuitBreaker {
    private counterPath;
    private limit;
    constructor(counterPath: string, limit: number);
    /**
     * Increment counter and return true if limit exceeded (should auto-allow).
     * Never throws — returns false (don't auto-allow) on any filesystem error.
     */
    check(): boolean;
    /** Reset the counter by deleting the counter file. */
    reset(): void;
}
//# sourceMappingURL=circuit-breaker.d.ts.map