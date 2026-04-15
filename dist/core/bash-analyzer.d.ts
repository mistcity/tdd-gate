/**
 * bash-analyzer.ts
 *
 * Analyzes bash command strings to detect file write operations and test
 * runner invocations.
 */
import type { BashAnalysisResult } from '../types.js';
export declare function analyzeBashCommand(command: string, customTestCommands?: string[]): BashAnalysisResult;
//# sourceMappingURL=bash-analyzer.d.ts.map