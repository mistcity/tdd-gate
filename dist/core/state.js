/**
 * StateManager — manages paths to per-session temporary state files.
 */
import os from 'os';
import path from 'path';
import fs from 'fs';
export class StateManager {
    sessionId;
    tmpDir;
    constructor(sessionId) {
        // Sanitize session ID: keep only alphanumeric, hyphen, underscore
        this.sessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
        this.tmpDir = os.tmpdir();
    }
    get journalPath() {
        return path.join(this.tmpDir, `tdd-gate-journal-${this.sessionId}.log`);
    }
    get counterPath() {
        return path.join(this.tmpDir, `tdd-gate-counter-${this.sessionId}`);
    }
    get testRanPath() {
        return path.join(this.tmpDir, `tdd-gate-test-ran-${this.sessionId}`);
    }
    /** Clear per-message state (journal + counter), keep testRan. */
    clearPerMessage() {
        this.deleteFile(this.journalPath);
        this.deleteFile(this.counterPath);
    }
    /** Clear all state files. */
    clearAll() {
        this.deleteFile(this.journalPath);
        this.deleteFile(this.counterPath);
        this.deleteFile(this.testRanPath);
    }
    deleteFile(filePath) {
        try {
            fs.unlinkSync(filePath);
        }
        catch (err) {
            const nodeErr = err;
            if (nodeErr.code !== 'ENOENT') {
                process.stderr.write(`[tdd-gate] state cleanup failed for ${filePath}: ${err instanceof Error ? err.message : String(err)}\n`);
            }
        }
    }
}
//# sourceMappingURL=state.js.map