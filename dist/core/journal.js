/**
 * Journal — tracks test/implementation edit order for TDD enforcement.
 *
 * Entries are stored as plain-text lines:
 *   {timestamp} {TYPE} {filePath}\n
 *
 * All methods are fail-safe and never throw to the caller.
 */
import fs from 'fs';
import path from 'path';
export class Journal {
    filePath;
    appendFailed = false;
    constructor(journalPath) {
        this.filePath = journalPath;
    }
    /** Record that a test file was edited/created. */
    recordTest(testFilePath) {
        this.append('TEST', testFilePath);
    }
    /** Record that an implementation file was edited/created. */
    recordImpl(implFilePath) {
        this.append('IMPL', implFilePath);
    }
    /** Record that a test command was executed. */
    recordTestRun(command) {
        this.append('TEST_RUN', command);
    }
    /** Record a TDD violation (impl written without test) in observe mode. */
    recordViolation(implFilePath, expectedTests) {
        this.append('VIOLATION', `${implFilePath}|${expectedTests.join('|')}`);
    }
    /** Record an impact violation (dependent test not run) in observe mode. */
    recordImpactViolation(changedFile, dependent, missingTest) {
        this.append('IMPACT_VIOLATION', `${changedFile}|${dependent}|${missingTest}`);
    }
    /**
     * Check if any test has been recorded matching any of the expected test paths.
     * Matches by basename to handle different directory layouts.
     * Returns false on any error.
     */
    hasTestFor(expectedTestPaths) {
        if (this.appendFailed)
            return true;
        try {
            const entries = this.getEntries();
            const expectedBasenames = expectedTestPaths.map(p => path.basename(p));
            return entries.some(entry => {
                if (entry.type !== 'TEST')
                    return false;
                const entryBasename = path.basename(entry.filePath);
                return expectedBasenames.includes(entryBasename);
            });
        }
        catch {
            return false;
        }
    }
    /**
     * Check if any test run was recorded in this session.
     * Returns false on any error.
     */
    hasTestRun() {
        if (this.appendFailed)
            return true;
        try {
            const entries = this.getEntries();
            return entries.some(entry => entry.type === 'TEST_RUN');
        }
        catch {
            return false;
        }
    }
    /**
     * Read all entries from the journal file.
     * Returns [] on error or empty file.
     */
    getEntries() {
        try {
            const content = fs.readFileSync(this.filePath, 'utf-8');
            if (!content.trim())
                return [];
            const entries = [];
            for (const line of content.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed)
                    continue;
                // Format: "{timestamp} {TYPE} {filePath}"
                // We use a single split with limit to handle paths with spaces
                const spaceIdx1 = trimmed.indexOf(' ');
                if (spaceIdx1 === -1)
                    continue;
                const rest = trimmed.slice(spaceIdx1 + 1);
                const spaceIdx2 = rest.indexOf(' ');
                if (spaceIdx2 === -1)
                    continue;
                const type = rest.slice(0, spaceIdx2);
                const filePath = rest.slice(spaceIdx2 + 1);
                if (type && filePath) {
                    entries.push({ type, filePath });
                }
            }
            return entries;
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                process.stderr.write(`[tdd-gate] journal read failed (fail-open): ${err instanceof Error ? err.message : String(err)}\n`);
            }
            return [];
        }
    }
    /** Get all VIOLATION entries from the journal. */
    getViolations() {
        const entries = this.getEntries();
        return entries
            .filter(e => e.type === 'VIOLATION')
            .map(e => {
            const parts = e.filePath.split('|');
            return { implFile: parts[0], expectedTests: parts.slice(1) };
        });
    }
    /** Get all IMPACT_VIOLATION entries from the journal. */
    getImpactViolations() {
        const entries = this.getEntries();
        return entries
            .filter(e => e.type === 'IMPACT_VIOLATION')
            .map(e => {
            const parts = e.filePath.split('|');
            return { changedFile: parts[0], dependent: parts[1], missingTest: parts[2] };
        });
    }
    append(type, filePath) {
        try {
            const timestamp = Date.now();
            const line = `${timestamp} ${type} ${filePath}\n`;
            fs.appendFileSync(this.filePath, line, 'utf-8');
        }
        catch (err) {
            this.appendFailed = true;
            process.stderr.write(`[tdd-gate] journal write failed (${type} ${filePath}): ${err instanceof Error ? err.message : String(err)}. TDD checks will allow all operations.\n`);
        }
    }
}
//# sourceMappingURL=journal.js.map