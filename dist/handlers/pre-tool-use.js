/**
 * PreToolUse handler — core TDD enforcement logic.
 *
 * Intercepts Write/Edit/MultiEdit/Bash tool invocations and enforces
 * "test first" discipline: implementation files may only be written
 * after their corresponding test file has been edited in the same session.
 */
import { classifyFile, getExpectedTestPaths } from '../core/file-classifier.js';
import { analyzeBashCommand } from '../core/bash-analyzer.js';
const ALLOW = { action: 'allow' };
// ---------------------------------------------------------------------------
// TDD check for a single file path
// ---------------------------------------------------------------------------
function checkTdd(filePath, config, journal) {
    const classification = classifyFile(filePath, config);
    switch (classification.type) {
        case 'exempt':
        case 'unknown':
            return ALLOW;
        case 'test':
            journal.recordTest(filePath);
            return ALLOW;
        case 'impl': {
            const expectedTests = getExpectedTestPaths(filePath, config);
            if (journal.hasTestFor(expectedTests)) {
                return ALLOW;
            }
            if (config.mode === 'observe') {
                journal.recordViolation(filePath, expectedTests);
                return ALLOW;
            }
            const firstExpected = expectedTests[0] ?? '<unknown_test>';
            return {
                action: 'deny',
                reason: `TDD violation: Write test file ${firstExpected} first, then edit ${filePath}`,
            };
        }
    }
}
// ---------------------------------------------------------------------------
// Handle Write / Edit / MultiEdit tools
//
// MultiEdit uses the same `file_path` field as Write/Edit in its tool_input.
// If file_path is absent (e.g. malformed input), we fail-open (allow).
// ---------------------------------------------------------------------------
function handleFileWrite(input, config, journal) {
    const filePath = input.tool_input.file_path;
    if (!filePath)
        return ALLOW;
    return checkTdd(filePath, config, journal);
}
// ---------------------------------------------------------------------------
// Handle Bash tool
// ---------------------------------------------------------------------------
function handleBash(input, config, journal) {
    if (!config.bashDetection)
        return ALLOW;
    const command = input.tool_input.command;
    if (!command)
        return ALLOW;
    const analysis = analyzeBashCommand(command, config.testCommands);
    // Test command → record and allow
    if (analysis.isTestCommand) {
        journal.recordTestRun(command);
        return ALLOW;
    }
    // Check each write target through TDD check; deny on first violation
    for (const target of analysis.writeTargets) {
        const result = checkTdd(target.filePath, config, journal);
        if (result.action === 'deny') {
            return result;
        }
    }
    return ALLOW;
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function handlePreToolUse(input, config, journal, circuitBreaker) {
    // 1. Circuit breaker — if tripped, auto-allow everything
    if (circuitBreaker.check()) {
        return ALLOW;
    }
    // 2. Route by tool name
    switch (input.tool_name) {
        case 'Write':
        case 'Edit':
        case 'MultiEdit':
            return handleFileWrite(input, config, journal);
        case 'Bash':
            return handleBash(input, config, journal);
        default:
            return ALLOW;
    }
}
//# sourceMappingURL=pre-tool-use.js.map