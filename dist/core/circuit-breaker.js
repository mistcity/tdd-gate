/**
 * CircuitBreaker — file-based counter that auto-allows when limit is exceeded.
 *
 * Designed for use in Claude Code hooks where repeated failures should
 * eventually be allowed through to avoid blocking the user indefinitely.
 */
import fs from 'fs';
export class CircuitBreaker {
    counterPath;
    limit;
    constructor(counterPath, limit) {
        this.counterPath = counterPath;
        this.limit = limit;
    }
    /**
     * Increment counter and return true if limit exceeded (should auto-allow).
     * Never throws — returns false (don't auto-allow) on any filesystem error.
     */
    check() {
        try {
            let count = 0;
            try {
                const raw = fs.readFileSync(this.counterPath, 'utf-8').trim();
                const parsed = parseInt(raw, 10);
                if (!isNaN(parsed)) {
                    count = parsed;
                }
            }
            catch (err) {
                const nodeErr = err;
                if (nodeErr.code !== 'ENOENT') {
                    process.stderr.write(`[tdd-gate] circuit breaker read failed: ${err instanceof Error ? err.message : String(err)}\n`);
                }
                // ENOENT: file doesn't exist yet, start from 0
            }
            count += 1;
            fs.writeFileSync(this.counterPath, String(count), 'utf-8');
            return count > this.limit;
        }
        catch {
            // Any write error — fail safe (don't auto-allow)
            return false;
        }
    }
    /** Reset the counter by deleting the counter file. */
    reset() {
        try {
            fs.unlinkSync(this.counterPath);
        }
        catch (err) {
            const nodeErr = err;
            if (nodeErr.code !== 'ENOENT') {
                // Silently ignore other errors
            }
        }
    }
}
//# sourceMappingURL=circuit-breaker.js.map