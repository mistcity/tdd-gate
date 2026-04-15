/**
 * StateManager — manages paths to per-session temporary state files.
 */
export declare class StateManager {
    private sessionId;
    private tmpDir;
    constructor(sessionId: string);
    get journalPath(): string;
    get counterPath(): string;
    get testRanPath(): string;
    /** Clear per-message state (journal + counter), keep testRan. */
    clearPerMessage(): void;
    /** Clear all state files. */
    clearAll(): void;
    private deleteFile;
}
//# sourceMappingURL=state.d.ts.map