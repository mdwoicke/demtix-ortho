/**
 * Real-Time Failure Detector
 * Detects failure patterns during test execution for early termination
 */

import { EventEmitter } from 'events';

// Extended turn interface with optional fields for failure detection
export interface ExtendedConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  toolCalls?: Array<{
    name: string;
    result?: any;
    error?: string;
  }>;
}

export interface FailureSignal {
  type: FailureSignalType;
  severity: 'warning' | 'error' | 'critical';
  message: string;
  turnIndex: number;
  confidence: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export type FailureSignalType =
  | 'intent-loop'           // Same intent detected 3+ times in a row
  | 'conversation-stall'    // No meaningful progress for N turns
  | 'goal-regression'       // Previously satisfied goal became unsatisfied
  | 'terminal-mismatch'     // Reached terminal state unexpectedly
  | 'error-response'        // Bot returned error message
  | 'tool-failure'          // Tool call failed
  | 'topic-drift'           // Conversation went off-topic
  | 'excessive-turns'       // Too many conversation turns
  | 'api-timeout'           // API call took too long
  | 'repetition';           // Same response repeated

export interface DetectorConfig {
  maxIntentRepetitions?: number;      // Default: 3
  maxStallTurns?: number;             // Default: 4
  maxTotalTurns?: number;             // Default: 20
  enableEarlyTermination?: boolean;   // Default: true
  onSignal?: (signal: FailureSignal) => void;
}

interface ConversationState {
  intents: string[];
  goals: Map<string, { satisfied: boolean; turnIndex: number }>;
  turnCount: number;
  lastProgressTurn: number;
  responses: string[];
  toolCalls: Array<{ name: string; success: boolean }>;
}

export class RealtimeFailureDetector extends EventEmitter {
  private config: Required<DetectorConfig>;
  private state: ConversationState;
  private signals: FailureSignal[] = [];
  private shouldTerminate: boolean = false;

  constructor(config: DetectorConfig = {}) {
    super();
    this.config = {
      maxIntentRepetitions: config.maxIntentRepetitions ?? 3,
      maxStallTurns: config.maxStallTurns ?? 4,
      maxTotalTurns: config.maxTotalTurns ?? 20,
      enableEarlyTermination: config.enableEarlyTermination ?? true,
      onSignal: config.onSignal ?? (() => {})
    };

    this.state = this.createInitialState();
  }

  private createInitialState(): ConversationState {
    return {
      intents: [],
      goals: new Map(),
      turnCount: 0,
      lastProgressTurn: 0,
      responses: [],
      toolCalls: []
    };
  }

  /**
   * Reset detector state for a new test
   */
  reset(): void {
    this.state = this.createInitialState();
    this.signals = [];
    this.shouldTerminate = false;
  }

  /**
   * Process a new conversation turn
   */
  processTurn(turn: ExtendedConversationTurn, currentGoals?: Map<string, boolean>): FailureSignal[] {
    const newSignals: FailureSignal[] = [];
    this.state.turnCount++;

    // Track intent
    if (turn.intent) {
      this.state.intents.push(turn.intent);
      const loopSignal = this.detectIntentLoop();
      if (loopSignal) newSignals.push(loopSignal);
    }

    // Track bot responses
    if (turn.role === 'assistant' && turn.content) {
      this.state.responses.push(turn.content);

      // Check for repetition
      const repSignal = this.detectRepetition();
      if (repSignal) newSignals.push(repSignal);

      // Check for error responses
      const errSignal = this.detectErrorResponse(turn.content);
      if (errSignal) newSignals.push(errSignal);
    }

    // Track goal changes
    if (currentGoals) {
      const regressionSignal = this.detectGoalRegression(currentGoals);
      if (regressionSignal) newSignals.push(regressionSignal);
    }

    // Check for tool failures
    if (turn.toolCalls) {
      for (const tc of turn.toolCalls) {
        const success = !tc.error && tc.result !== undefined;
        this.state.toolCalls.push({ name: tc.name, success });

        if (!success) {
          newSignals.push({
            type: 'tool-failure',
            severity: 'warning',
            message: `Tool call failed: ${tc.name}`,
            turnIndex: this.state.turnCount,
            confidence: 0.9,
            timestamp: new Date(),
            metadata: { toolName: tc.name, error: tc.error }
          });
        }
      }
    }

    // Check for stall
    const stallSignal = this.detectStall(currentGoals);
    if (stallSignal) newSignals.push(stallSignal);

    // Check for excessive turns
    if (this.state.turnCount > this.config.maxTotalTurns) {
      newSignals.push({
        type: 'excessive-turns',
        severity: 'error',
        message: `Conversation exceeded ${this.config.maxTotalTurns} turns`,
        turnIndex: this.state.turnCount,
        confidence: 1.0,
        timestamp: new Date()
      });
    }

    // Emit signals
    for (const signal of newSignals) {
      this.signals.push(signal);
      this.config.onSignal(signal);
      this.emit('signal', signal);

      // Check for termination
      if (this.config.enableEarlyTermination && this.shouldTerminateEarly(signal)) {
        this.shouldTerminate = true;
        this.emit('terminate', {
          reason: signal.type,
          signals: this.signals
        });
      }
    }

    return newSignals;
  }

  /**
   * Detect intent loop (same intent 3+ times)
   */
  private detectIntentLoop(): FailureSignal | null {
    const intents = this.state.intents;
    if (intents.length < this.config.maxIntentRepetitions) {
      return null;
    }

    const recent = intents.slice(-this.config.maxIntentRepetitions);
    const allSame = recent.every(i => i === recent[0]);

    if (allSame) {
      return {
        type: 'intent-loop',
        severity: 'error',
        message: `Intent "${recent[0]}" repeated ${this.config.maxIntentRepetitions} times`,
        turnIndex: this.state.turnCount,
        confidence: 0.95,
        timestamp: new Date(),
        metadata: { intent: recent[0], count: this.config.maxIntentRepetitions }
      };
    }

    return null;
  }

  /**
   * Detect response repetition
   */
  private detectRepetition(): FailureSignal | null {
    const responses = this.state.responses;
    if (responses.length < 2) {
      return null;
    }

    // Check if last 2 responses are identical (after normalization)
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const last = normalize(responses[responses.length - 1]);
    const prev = normalize(responses[responses.length - 2]);

    if (last === prev && last.length > 20) {
      return {
        type: 'repetition',
        severity: 'warning',
        message: 'Bot repeated same response',
        turnIndex: this.state.turnCount,
        confidence: 0.85,
        timestamp: new Date()
      };
    }

    return null;
  }

  /**
   * Detect error-like responses from bot
   */
  private detectErrorResponse(content: string): FailureSignal | null {
    const errorPatterns = [
      /i('m| am) (sorry|afraid|unable|not able)/i,
      /cannot (help|assist|process)/i,
      /error (occurred|processing)/i,
      /something went wrong/i,
      /please try again/i,
      /I don't (understand|have)/i,
      /technical (difficulties|issues)/i
    ];

    for (const pattern of errorPatterns) {
      if (pattern.test(content)) {
        return {
          type: 'error-response',
          severity: 'warning',
          message: 'Bot may have encountered an error',
          turnIndex: this.state.turnCount,
          confidence: 0.7,
          timestamp: new Date(),
          metadata: { pattern: pattern.source }
        };
      }
    }

    return null;
  }

  /**
   * Detect goal regression (goal was satisfied, now unsatisfied)
   */
  private detectGoalRegression(currentGoals: Map<string, boolean>): FailureSignal | null {
    for (const [goalId, satisfied] of currentGoals) {
      const prevState = this.state.goals.get(goalId);

      if (prevState && prevState.satisfied && !satisfied) {
        return {
          type: 'goal-regression',
          severity: 'critical',
          message: `Goal "${goalId}" regressed from satisfied to unsatisfied`,
          turnIndex: this.state.turnCount,
          confidence: 0.95,
          timestamp: new Date(),
          metadata: { goalId, satisfiedAt: prevState.turnIndex }
        };
      }

      // Update state
      this.state.goals.set(goalId, {
        satisfied,
        turnIndex: this.state.turnCount
      });
    }

    return null;
  }

  /**
   * Detect conversation stall (no progress for N turns)
   */
  private detectStall(currentGoals?: Map<string, boolean>): FailureSignal | null {
    // Check if any new goals were satisfied
    let madeProgress = false;

    if (currentGoals) {
      for (const [goalId, satisfied] of currentGoals) {
        const prevState = this.state.goals.get(goalId);
        if (satisfied && (!prevState || !prevState.satisfied)) {
          madeProgress = true;
          this.state.lastProgressTurn = this.state.turnCount;
          break;
        }
      }
    }

    const turnsSinceProgress = this.state.turnCount - this.state.lastProgressTurn;

    if (turnsSinceProgress >= this.config.maxStallTurns) {
      return {
        type: 'conversation-stall',
        severity: 'warning',
        message: `No goal progress for ${turnsSinceProgress} turns`,
        turnIndex: this.state.turnCount,
        confidence: 0.8,
        timestamp: new Date(),
        metadata: { turnsSinceProgress }
      };
    }

    return null;
  }

  /**
   * Determine if we should terminate early based on signal
   */
  private shouldTerminateEarly(signal: FailureSignal): boolean {
    // Always terminate on critical signals
    if (signal.severity === 'critical') {
      return true;
    }

    // Terminate on high-confidence errors
    if (signal.severity === 'error' && signal.confidence >= 0.9) {
      return true;
    }

    // Terminate if too many warnings accumulated
    const warningCount = this.signals.filter(s => s.severity === 'warning').length;
    if (warningCount >= 5) {
      return true;
    }

    // Terminate on intent loop + stall combination
    const hasLoop = this.signals.some(s => s.type === 'intent-loop');
    const hasStall = this.signals.some(s => s.type === 'conversation-stall');
    if (hasLoop && hasStall) {
      return true;
    }

    return false;
  }

  /**
   * Get all detected signals
   */
  getSignals(): FailureSignal[] {
    return [...this.signals];
  }

  /**
   * Check if early termination is recommended
   */
  get shouldTerminateTest(): boolean {
    return this.shouldTerminate;
  }

  /**
   * Get summary of detection state
   */
  getSummary(): {
    turnCount: number;
    signalCount: number;
    severityCounts: Record<string, number>;
    typeCounts: Record<string, number>;
    shouldTerminate: boolean;
  } {
    const severityCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};

    for (const signal of this.signals) {
      severityCounts[signal.severity] = (severityCounts[signal.severity] ?? 0) + 1;
      typeCounts[signal.type] = (typeCounts[signal.type] ?? 0) + 1;
    }

    return {
      turnCount: this.state.turnCount,
      signalCount: this.signals.length,
      severityCounts,
      typeCounts,
      shouldTerminate: this.shouldTerminate
    };
  }
}

// Export factory function
export function createFailureDetector(config?: DetectorConfig): RealtimeFailureDetector {
  return new RealtimeFailureDetector(config);
}
