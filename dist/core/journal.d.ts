/**
 * Journal — tracks test/implementation edit order for TDD enforcement.
 *
 * Entries are stored as plain-text lines:
 *   {timestamp} {TYPE} {filePath}\n
 *
 * All methods are fail-safe and never throw to the caller.
 */
export declare class Journal {
    private filePath;
    private appendFailed;
    constructor(journalPath: string);
    /** Record that a test file was edited/created. */
    recordTest(testFilePath: string): void;
    /** Record that an implementation file was edited/created. */
    recordImpl(implFilePath: string): void;
    /** Record that a test command was executed. */
    recordTestRun(command: string): void;
    /** Record a TDD violation (impl written without test) in observe mode. */
    recordViolation(implFilePath: string, expectedTests: string[]): void;
    /** Record an impact violation (dependent test not run) in observe mode. */
    recordImpactViolation(changedFile: string, dependent: string, missingTest: string): void;
    /**
     * Check if any test has been recorded matching any of the expected test paths.
     * Matches by basename to handle different directory layouts.
     * Returns false on any error.
     */
    hasTestFor(expectedTestPaths: string[]): boolean;
    /**
     * Check if any test run was recorded in this session.
     * Returns false on any error.
     */
    hasTestRun(): boolean;
    /**
     * Read all entries from the journal file.
     * Returns [] on error or empty file.
     */
    getEntries(): Array<{
        type: string;
        filePath: string;
    }>;
    /** Get all VIOLATION entries from the journal. */
    getViolations(): Array<{
        implFile: string;
        expectedTests: string[];
    }>;
    /** Get all IMPACT_VIOLATION entries from the journal. */
    getImpactViolations(): Array<{
        changedFile: string;
        dependent: string;
        missingTest: string;
    }>;
    private append;
}
//# sourceMappingURL=journal.d.ts.map