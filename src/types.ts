/**
 * Core TypeScript type definitions for tdd-gate.
 *
 * Hook input types describe the JSON payloads Claude Code sends via stdin.
 * Hook output types describe what tdd-gate writes to stdout in response.
 * Configuration and domain types support the gate logic.
 */

// ---------------------------------------------------------------------------
// Hook Input Types
// ---------------------------------------------------------------------------

/** Base fields shared by all hook events */
export interface HookInputBase {
  hook_event_name: string;
  session_id: string;
  cwd?: string;
}

/** PreToolUse event — fired when Claude invokes Write, Edit, MultiEdit, or Bash */
export interface PreToolUseInput extends HookInputBase {
  hook_event_name: 'PreToolUse';
  tool_name: 'Write' | 'Edit' | 'MultiEdit' | 'Bash';
  tool_input: {
    file_path?: string;   // Write / Edit / MultiEdit
    command?: string;     // Bash
    content?: string;     // Write
    old_string?: string;  // Edit
    new_string?: string;  // Edit
  };
}

/** UserPromptSubmit event — fired on each new user message */
export interface UserPromptSubmitInput extends HookInputBase {
  hook_event_name: 'UserPromptSubmit';
  user_prompt?: string;
}

/** Stop event — fired when Claude signals session completion */
export interface StopInput extends HookInputBase {
  hook_event_name: 'Stop';
  stop_hook_active?: boolean;
}

/** Union of all supported hook inputs */
export type HookInput = PreToolUseInput | UserPromptSubmitInput | StopInput;

// ---------------------------------------------------------------------------
// Hook Output Types
// ---------------------------------------------------------------------------

/**
 * Deny output written to stdout for PreToolUse denials.
 * Allow output is simply the string "ok".
 */
export interface DenyOutput {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse';
    permissionDecision: 'deny';
    permissionDecisionReason: string;
  };
}

// ---------------------------------------------------------------------------
// Configuration Types
// ---------------------------------------------------------------------------

export interface LanguageConfig {
  enabled: boolean;
}

export interface ExemptConfig {
  extensions: string[];
  paths: string[];
}

export interface CircuitBreakerConfig {
  preToolUse: number;
  stop: number;
}

export interface TddGateConfig {
  languages: Record<string, LanguageConfig>;
  exempt: ExemptConfig;
  bashDetection: boolean;
  completionAudit: boolean;
  circuitBreaker: CircuitBreakerConfig;
  testCommands: string[];
  testDirs: string[];
  impactAnalysis: boolean;
  impactAnalysisMaxFiles: number;
  impactAnalysisTimeout: number;
  mode: 'enforce' | 'observe';
}

// ---------------------------------------------------------------------------
// Impact Analysis Types
// ---------------------------------------------------------------------------

export interface ImpactResult {
  filePath: string;
  dependents: string[];
  missingTests: string[];
}

// ---------------------------------------------------------------------------
// Language Definition Types
// ---------------------------------------------------------------------------

export interface LanguageDefinition {
  name: string;
  extensions: string[];
  /** Given a source basename (e.g. "foo.ts"), returns expected test filenames */
  testPatterns: (basename: string) => string[];
  /** Returns true if the given basename looks like a test file */
  isTestFile: (basename: string) => boolean;
}

// ---------------------------------------------------------------------------
// Journal Entry Types
// ---------------------------------------------------------------------------

export type JournalEntryType = 'TEST' | 'IMPL' | 'TEST_RUN' | 'VIOLATION' | 'IMPACT_VIOLATION';

export interface JournalEntry {
  timestamp: number;
  type: JournalEntryType;
  filePath: string;
}

// ---------------------------------------------------------------------------
// Bash Analysis Types
// ---------------------------------------------------------------------------

export interface BashWriteTarget {
  filePath: string;
  command: string; // the matched bash pattern, e.g. "cat >"
}

export interface BashAnalysisResult {
  isTestCommand: boolean;
  writeTargets: BashWriteTarget[];
}
