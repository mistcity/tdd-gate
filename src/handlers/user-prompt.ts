/**
 * UserPromptSubmit handler — clears per-message state on each new user message.
 */

import { StateManager } from '../core/state.js';

export function handleUserPromptSubmit(sessionId: string): void {
  // Clear per-message state: journal and counter
  // Don't clear testRan marker (session-level)
  const state = new StateManager(sessionId);
  state.clearPerMessage();
}
