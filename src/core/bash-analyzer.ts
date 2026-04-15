/**
 * bash-analyzer.ts
 *
 * Analyzes bash command strings to detect file write operations and test
 * runner invocations.
 */

import type { BashAnalysisResult, BashWriteTarget } from '../types.js';

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

/** cat / echo / printf redirect (single or double >) */
const REDIRECT_PATTERN = /(?:cat|echo|printf)\s+.*?>{1,2}\s*([^\s;|&]+)/g;

/** tee [flags] file */
const TEE_PATTERN = /tee\s+(?:-[a-z]\s+)*([^\s;|&]+)/g;

/** heredoc redirect: (cat )?> file << ['"]?WORD['"]? */
const HEREDOC_PATTERN = /(?:cat\s+)?>\s*([^\s<]+)\s*<<\s*'?\w+'?/g;

// ---------------------------------------------------------------------------
// Test command prefixes
// ---------------------------------------------------------------------------

const TEST_COMMANDS: string[] = [
  'pytest',
  'python -m pytest',
  'python3 -m pytest',
  'npm test',
  'npm run test',
  'npx vitest',
  'npx jest',
  'yarn test',
  'go test',
  'cargo test',
  'mvn test',
  'gradle test',
  'gradlew test',
  './gradlew test',
  'dotnet test',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectMatches(
  pattern: RegExp,
  command: string,
  commandLabel: string,
): BashWriteTarget[] {
  const targets: BashWriteTarget[] = [];
  // Reset lastIndex because the same pattern object is reused across calls.
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(command)) !== null) {
    const filePath = match[1];
    if (filePath) {
      targets.push({ filePath, command: commandLabel });
    }
  }
  return targets;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function analyzeBashCommand(command: string, customTestCommands: string[] = []): BashAnalysisResult {
  try {
    if (typeof command !== 'string' || command.trim() === '') {
      return { isTestCommand: false, writeTargets: [] };
    }

    // --- Test command detection -------------------------------------------
    const normalized = command.trim();
    const allTestCommands = customTestCommands.length > 0
      ? [...TEST_COMMANDS, ...customTestCommands]
      : TEST_COMMANDS;
    const isTestCommand = allTestCommands.some(
      (tc) => normalized === tc || normalized.startsWith(tc + ' '),
    );

    // --- Write target detection --------------------------------------------
    const writeTargets: BashWriteTarget[] = [
      ...collectMatches(HEREDOC_PATTERN, command, 'heredoc'),
      ...collectMatches(REDIRECT_PATTERN, command, 'redirect'),
      ...collectMatches(TEE_PATTERN, command, 'tee'),
    ];

    // De-duplicate by filePath (heredoc and redirect patterns may both match
    // the same heredoc command).
    const seen = new Set<string>();
    const dedupedTargets = writeTargets.filter(({ filePath }) => {
      if (seen.has(filePath)) return false;
      seen.add(filePath);
      return true;
    });

    return { isTestCommand, writeTargets: dedupedTargets };
  } catch {
    return { isTestCommand: false, writeTargets: [] };
  }
}
