/**
 * PreToolUse handler — core TDD enforcement logic.
 *
 * Intercepts Write/Edit/MultiEdit/Bash tool invocations and enforces
 * "test first" discipline: implementation files may only be written
 * after their corresponding test file has been edited in the same session.
 */

import { classifyFile, getExpectedTestPaths } from '../core/file-classifier.js';
import { analyzeBashCommand } from '../core/bash-analyzer.js';
import type { Journal } from '../core/journal.js';
import type { CircuitBreaker } from '../core/circuit-breaker.js';
import type { PreToolUseInput, TddGateConfig } from '../types.js';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

type PreToolUseResult =
  | { action: 'allow' }
  | { action: 'deny'; reason: string };

const ALLOW: PreToolUseResult = { action: 'allow' };

// ---------------------------------------------------------------------------
// TDD check for a single file path
// ---------------------------------------------------------------------------

function checkTdd(
  filePath: string,
  config: TddGateConfig,
  journal: Journal,
): PreToolUseResult {
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

function handleFileWrite(
  input: PreToolUseInput,
  config: TddGateConfig,
  journal: Journal,
): PreToolUseResult {
  const filePath = input.tool_input.file_path;
  if (!filePath) return ALLOW;

  return checkTdd(filePath, config, journal);
}

// ---------------------------------------------------------------------------
// Handle Bash tool
// ---------------------------------------------------------------------------

function handleBash(
  input: PreToolUseInput,
  config: TddGateConfig,
  journal: Journal,
): PreToolUseResult {
  if (!config.bashDetection) return ALLOW;

  const command = input.tool_input.command;
  if (!command) return ALLOW;

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

export function handlePreToolUse(
  input: PreToolUseInput,
  config: TddGateConfig,
  journal: Journal,
  circuitBreaker: CircuitBreaker,
): PreToolUseResult {
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
