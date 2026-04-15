/**
 * Stop handler — completion audit that checks whether impl files changed
 * without corresponding test files or a recorded test run.
 */

import { execFileSync } from 'child_process';
import path from 'path';
import { Journal } from '../core/journal.js';
import { CircuitBreaker } from '../core/circuit-breaker.js';
import { classifyFile, getExpectedTestPaths } from '../core/file-classifier.js';
import { analyzeImpact } from '../core/impact-analyzer.js';
import type { TddGateConfig } from '../types.js';

export function handleStop(
  _sessionId: string,
  cwd: string,
  config: TddGateConfig,
  journal: Journal,
  circuitBreaker: CircuitBreaker,
): { action: 'allow' } | { action: 'block'; message: string } {
  // 1. If completionAudit is disabled, allow
  if (!config.completionAudit) return { action: 'allow' };

  // 2. Circuit breaker check
  if (circuitBreaker.check()) return { action: 'allow' };

  // 3. Get changed files from git — fail-open on any error
  let changedFiles: Set<string>;
  try {
    const gitOpts: { encoding: 'utf-8'; timeout: number; stdio: ['pipe', 'pipe', 'pipe'] } = {
      encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'],
    };
    const headOutput = execFileSync('git', ['-C', cwd, 'diff', '--name-only', 'HEAD'], gitOpts) as string;
    const cachedOutput = execFileSync('git', ['-C', cwd, 'diff', '--name-only', '--cached'], gitOpts) as string;

    const parseLines = (output: string): string[] =>
      output.split('\n').map((f) => f.trim()).filter((f) => f.length > 0);

    changedFiles = new Set([...parseLines(headOutput), ...parseLines(cachedOutput)]);
  } catch {
    // Not a git repo or git unavailable — fail-open
    return { action: 'allow' };
  }

  if (changedFiles.size === 0) return { action: 'allow' };

  // 4. Classify changed files
  const implFiles: string[] = [];
  let testFilesChanged = false;

  for (const file of changedFiles) {
    const classification = classifyFile(file, config);
    if (classification.type === 'impl') {
      implFiles.push(file);
    } else if (classification.type === 'test') {
      testFilesChanged = true;
    }
  }

  // 5. Block only if: impl files exist AND no test files changed AND no test run recorded
  if (implFiles.length === 0) return { action: 'allow' };

  const hasDirectViolation = !testFilesChanged && !journal.hasTestRun();

  // 5.5 Impact analysis: check if dependents of changed impl files also need tests
  const absImplPaths = implFiles.map((f) => path.resolve(cwd, f));
  const impactResults = analyzeImpact(absImplPaths, cwd, config, journal);

  // Gather impact lines for uncovered dependents
  const impactLines = impactResults.flatMap((result) => {
    const changedBasename = path.basename(result.filePath);
    return result.dependents.map((dep, i) => {
      const depBasename = path.basename(dep);
      const testName = result.missingTests[i] || 'unknown test';
      return `  - ${depBasename} depends on modified ${changedBasename} → run ${testName}`;
    });
  });

  const hasImpactViolation = impactLines.length > 0;

  // If neither direct nor impact violations, allow
  if (!hasDirectViolation && !hasImpactViolation) return { action: 'allow' };

  // Build combined block message
  const messageParts: string[] = [];

  if (hasDirectViolation) {
    const lines = implFiles.map((f) => {
      const expectedPaths = getExpectedTestPaths(f, config);
      const expectedNames = expectedPaths
        .slice(0, 2)
        .map((p) => p.split('/').pop()!)
        .join(' or ');
      return `  - ${f} (expected: ${expectedNames})`;
    });

    messageParts.push(
      'Completion audit: The following implementation files were changed without corresponding test files:',
      ...lines,
      'Please add tests before completing.',
    );
  }

  if (hasImpactViolation) {
    if (messageParts.length > 0) messageParts.push('');
    messageParts.push(
      'Impact analysis: The following files depend on your changes and need tests:',
      ...impactLines,
    );
  }

  return { action: 'block', message: messageParts.join('\n') };
}
