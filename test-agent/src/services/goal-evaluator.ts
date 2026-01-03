/**
 * Goal Evaluator Service
 *
 * Evaluates final test results based on goal completion and constraint satisfaction.
 */

import type {
  ConversationGoal,
  GoalContext,
  GoalResult,
  CollectableField,
} from '../tests/types/goals';
import type {
  GoalOrientedTestCase,
  GoalTestResult,
  TestConstraint,
  ConstraintViolation,
} from '../tests/types/goal-test';
import type { ProgressState, ProgressIssue } from '../tests/types/progress';
import type { ConversationTurn } from '../tests/test-case';

/**
 * Result of checking for appointmentGUID in conversation
 */
interface AppointmentGUIDResult {
  found: boolean;
  appointmentGUID: string | null;
  turnNumber: number | null;
}

/**
 * Goal Evaluator Service
 *
 * Evaluates whether a goal-oriented test passed or failed.
 */
export class GoalEvaluator {
  /**
   * Evaluate the final test result
   */
  evaluateTest(
    testCase: GoalOrientedTestCase,
    progress: ProgressState,
    conversationHistory: ConversationTurn[],
    durationMs: number
  ): GoalTestResult {
    // Evaluate each goal
    const goalResults = this.evaluateAllGoals(
      testCase.goals,
      progress,
      conversationHistory
    );

    // Check constraints
    const constraintViolations = this.checkAllConstraints(
      testCase.constraints,
      progress,
      conversationHistory,
      durationMs
    );

    // Determine overall pass/fail
    const passed = this.determinePassFail(
      testCase.goals,
      goalResults,
      constraintViolations
    );

    // Generate summary
    const summary = this.generateSummary(
      passed,
      goalResults,
      constraintViolations,
      progress
    );

    return {
      passed,
      goalResults,
      constraintViolations,
      summary,
      progress,
      transcript: conversationHistory,
      turnCount: progress.turnNumber,
      durationMs,
      issues: progress.issues,
    };
  }

  /**
   * Evaluate all goals
   */
  private evaluateAllGoals(
    goals: ConversationGoal[],
    progress: ProgressState,
    conversationHistory: ConversationTurn[]
  ): GoalResult[] {
    const context = this.buildGoalContext(progress, conversationHistory);
    return goals.map(goal => this.evaluateGoal(goal, context, progress));
  }

  /**
   * Evaluate a single goal
   */
  private evaluateGoal(
    goal: ConversationGoal,
    context: GoalContext,
    progress: ProgressState
  ): GoalResult {
    // FIRST: Check if this goal was already completed during the conversation
    // This is important because state may change after goal completion
    if (progress.completedGoals.includes(goal.id)) {
      return {
        goalId: goal.id,
        passed: true,
        message: `Goal completed during conversation`,
      };
    }

    switch (goal.type) {
      case 'data_collection':
        return this.evaluateDataCollectionGoal(goal, progress);

      case 'booking_confirmed':
        return this.evaluateBookingGoal(goal.id, context, progress);

      case 'transfer_initiated':
        return this.evaluateTransferGoal(goal.id, context, progress);

      case 'conversation_ended':
        return this.evaluateConversationEndedGoal(goal.id, progress);

      case 'error_handled':
        return this.evaluateErrorHandledGoal(goal.id, context, progress);

      case 'custom':
        if (goal.successCriteria) {
          const passed = goal.successCriteria(context);
          return {
            goalId: goal.id,
            passed,
            message: passed ? 'Custom criteria met' : 'Custom criteria not met',
          };
        }
        return {
          goalId: goal.id,
          passed: false,
          message: 'No success criteria defined for custom goal',
        };

      default:
        return {
          goalId: goal.id,
          passed: false,
          message: `Unknown goal type: ${goal.type}`,
        };
    }
  }

  /**
   * Evaluate data collection goal
   */
  private evaluateDataCollectionGoal(
    goal: ConversationGoal,
    progress: ProgressState
  ): GoalResult {
    const requiredFields = goal.requiredFields ?? [];
    const collectedKeys = Array.from(progress.collectedFields.keys());
    const missing = requiredFields.filter(f => !collectedKeys.includes(f));

    return {
      goalId: goal.id,
      passed: missing.length === 0,
      message: missing.length === 0
        ? `All ${requiredFields.length} required fields collected`
        : `Missing ${missing.length} of ${requiredFields.length} fields: ${missing.join(', ')}`,
      details: {
        required: requiredFields,
        collected: collectedKeys.filter(k => requiredFields.includes(k)),
        missing,
      },
    };
  }

  /**
   * Evaluate booking confirmed goal
   *
   * IMPORTANT: A booking is only truly confirmed when:
   * 1. The agent says the booking is confirmed (progress.bookingConfirmed or context flags), AND
   * 2. If a PAYLOAD with appointmentGUID is found, it must be non-null
   *
   * This prevents false positives where agent says "let me verify" or similar
   * phrases that sound like confirmation but the actual API call failed.
   */
  private evaluateBookingGoal(
    goalId: string,
    context: GoalContext,
    progress: ProgressState
  ): GoalResult {
    // Check multiple sources for verbal/intent confirmation
    const agentSaidConfirmed = progress.bookingConfirmed ||  // Persistent flag set when confirming_booking detected
      context.agentConfirmedBooking ||
      progress.currentFlowState === 'confirmation' ||
      progress.completedGoals.includes(goalId);

    // Check for appointmentGUID in PAYLOAD to verify actual booking success
    const appointmentResult = this.checkForAppointmentGUID(context.conversationHistory);

    // Determine actual booking success
    let confirmed = false;
    let message = '';

    if (appointmentResult.found) {
      // PAYLOAD was found - use appointmentGUID as source of truth
      if (appointmentResult.appointmentGUID) {
        // Valid appointmentGUID = booking succeeded
        confirmed = true;
        message = `Booking confirmed with appointmentGUID: ${appointmentResult.appointmentGUID.substring(0, 8)}...`;
      } else {
        // appointmentGUID is null = booking failed despite what agent said
        confirmed = false;
        message = agentSaidConfirmed
          ? 'Agent claimed booking confirmed but appointmentGUID is null (booking actually failed)'
          : 'Booking failed - appointmentGUID is null';
      }
    } else {
      // No PAYLOAD found - fall back to agent's verbal confirmation
      // This is less reliable but necessary for tests where PAYLOAD isn't exposed
      confirmed = agentSaidConfirmed;
      message = confirmed
        ? 'Agent confirmed the booking (no PAYLOAD verification available)'
        : 'Booking was not confirmed';
    }

    return {
      goalId,
      passed: confirmed,
      message,
      details: appointmentResult.found ? {
        appointmentGUID: appointmentResult.appointmentGUID,
        verifiedByPayload: true,
        payloadTurnNumber: appointmentResult.turnNumber,
      } : undefined,
    };
  }

  /**
   * Evaluate transfer initiated goal
   */
  private evaluateTransferGoal(
    goalId: string,
    context: GoalContext,
    progress: ProgressState
  ): GoalResult {
    const transferred = context.agentInitiatedTransfer ||
      progress.currentFlowState === 'transfer' ||
      progress.completedGoals.includes(goalId);

    return {
      goalId,
      passed: transferred,
      message: transferred
        ? 'Agent transferred to live agent'
        : 'Transfer was not initiated',
    };
  }

  /**
   * Evaluate conversation ended goal
   */
  private evaluateConversationEndedGoal(goalId: string, progress: ProgressState): GoalResult {
    const ended = progress.currentFlowState === 'ended' ||
      progress.lastAgentIntent === 'saying_goodbye';

    return {
      goalId,
      passed: ended,
      message: ended
        ? 'Conversation ended properly with goodbye'
        : 'Conversation did not end properly',
    };
  }

  /**
   * Evaluate error handled goal
   */
  private evaluateErrorHandledGoal(
    goalId: string,
    context: GoalContext,
    progress: ProgressState
  ): GoalResult {
    // Check if there were error situations and they were handled
    const hadErrors = progress.issues.some(i => i.type === 'error');
    const handledGracefully = progress.lastAgentIntent !== 'handling_error' ||
      progress.completedGoals.length > 0;

    return {
      goalId,
      passed: !hadErrors || handledGracefully,
      message: hadErrors
        ? (handledGracefully ? 'Errors were handled gracefully' : 'Errors were not handled properly')
        : 'No errors occurred',
    };
  }

  /**
   * Check all constraints
   */
  private checkAllConstraints(
    constraints: TestConstraint[],
    progress: ProgressState,
    conversationHistory: ConversationTurn[],
    durationMs: number
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const context = this.buildGoalContext(progress, conversationHistory);

    for (const constraint of constraints) {
      const violation = this.checkConstraint(constraint, context, progress, durationMs);
      if (violation) {
        violations.push(violation);
      }
    }

    // Always check for PAYLOAD leakage (implicit constraint)
    const payloadLeakage = this.checkForPayloadLeakage(conversationHistory);
    if (payloadLeakage.hasLeakage) {
      violations.push({
        constraint: {
          type: 'must_not_happen',
          description: 'Agent must not expose raw PAYLOAD/JSON to user',
          severity: 'medium',
        },
        message: `PAYLOAD leakage detected: ${payloadLeakage.leakedContent}`,
        turnNumber: payloadLeakage.turnNumber ?? undefined,
      });
    }

    return violations;
  }

  /**
   * Convert backend turn number to transcript-based turn number.
   *
   * Backend turnNumber counts conversation exchanges (user-assistant pairs).
   * Frontend expects turns as individual messages (1-indexed).
   *
   * Formula: transcriptTurn = 2 * backendTurn
   * This points to the assistant message at that conversation turn.
   */
  private toTranscriptTurn(backendTurn: number): number {
    return 2 * backendTurn;
  }

  /**
   * Check a single constraint
   */
  private checkConstraint(
    constraint: TestConstraint,
    context: GoalContext,
    progress: ProgressState,
    durationMs: number
  ): ConstraintViolation | null {
    // Convert backend turn to transcript-based turn for frontend display
    const transcriptTurn = this.toTranscriptTurn(progress.turnNumber);

    switch (constraint.type) {
      case 'must_happen':
        if (constraint.condition && !constraint.condition(context)) {
          return {
            constraint,
            message: `Required condition not met: ${constraint.description}`,
          };
        }
        return null;

      case 'must_not_happen':
        if (constraint.condition && constraint.condition(context)) {
          return {
            constraint,
            message: `Forbidden condition occurred: ${constraint.description}`,
            turnNumber: transcriptTurn,
          };
        }
        return null;

      case 'max_turns':
        if (constraint.maxTurns && progress.turnNumber > constraint.maxTurns) {
          return {
            constraint,
            message: `Exceeded max turns: ${progress.turnNumber} > ${constraint.maxTurns}`,
            turnNumber: transcriptTurn,
          };
        }
        return null;

      case 'max_time':
        if (constraint.maxTimeMs && durationMs > constraint.maxTimeMs) {
          return {
            constraint,
            message: `Exceeded max time: ${durationMs}ms > ${constraint.maxTimeMs}ms`,
          };
        }
        return null;

      default:
        return null;
    }
  }

  /**
   * Determine overall pass/fail
   */
  private determinePassFail(
    goals: ConversationGoal[],
    goalResults: GoalResult[],
    violations: ConstraintViolation[]
  ): boolean {
    // Check for critical constraint violations
    const criticalViolations = violations.filter(v => v.constraint.severity === 'critical');
    if (criticalViolations.length > 0) {
      return false;
    }

    // Check required goals
    for (const goal of goals) {
      if (!goal.required) continue;
      const result = goalResults.find(r => r.goalId === goal.id);
      if (!result || !result.passed) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(
    passed: boolean,
    goalResults: GoalResult[],
    violations: ConstraintViolation[],
    progress: ProgressState
  ): string {
    const parts: string[] = [];

    // Overall status
    parts.push(passed ? 'TEST PASSED' : 'TEST FAILED');

    // Goal summary
    const passedGoals = goalResults.filter(r => r.passed).length;
    const totalGoals = goalResults.length;
    parts.push(`Goals: ${passedGoals}/${totalGoals} achieved`);

    // Failed goals
    const failedGoals = goalResults.filter(r => !r.passed);
    if (failedGoals.length > 0) {
      parts.push(`Failed goals: ${failedGoals.map(g => g.goalId).join(', ')}`);
    }

    // Constraint violations
    if (violations.length > 0) {
      parts.push(`Violations: ${violations.length}`);
      const critical = violations.filter(v => v.constraint.severity === 'critical');
      if (critical.length > 0) {
        parts.push(`Critical: ${critical.map(v => v.constraint.description).join('; ')}`);
      }
    }

    // Progress info
    parts.push(`Turns: ${progress.turnNumber}`);
    parts.push(`Fields collected: ${progress.collectedFields.size}`);

    // Issues
    if (progress.issues.length > 0) {
      parts.push(`Issues detected: ${progress.issues.length}`);
    }

    return parts.join(' | ');
  }

  /**
   * Build goal context for evaluations
   */
  private buildGoalContext(
    progress: ProgressState,
    conversationHistory: ConversationTurn[]
  ): GoalContext {
    return {
      collectedData: progress.collectedFields as Map<CollectableField, any>,
      conversationHistory,
      // Include persistent flags that survive subsequent intents
      agentConfirmedBooking:
        progress.bookingConfirmed ||  // Persistent flag
        progress.lastAgentIntent === 'confirming_booking' ||
        progress.currentFlowState === 'confirmation',
      agentInitiatedTransfer:
        progress.transferInitiated ||  // Persistent flag
        progress.lastAgentIntent === 'initiating_transfer' ||
        progress.currentFlowState === 'transfer',
      turnCount: progress.turnNumber,
      elapsedTimeMs: Date.now() - progress.startedAt.getTime(),
    };
  }

  /**
   * Check conversation history for valid appointmentGUID in PAYLOAD
   *
   * Looks for patterns like:
   * - PAYLOAD: { "appointmentGUID": "..." }
   * - "appointmentGUID": "non-null-value"
   *
   * A valid appointmentGUID indicates the booking was actually successful.
   * If the agent says booking confirmed but PAYLOAD has null appointmentGUID,
   * the booking actually failed.
   */
  private checkForAppointmentGUID(conversationHistory: ConversationTurn[]): AppointmentGUIDResult {
    // Look through assistant messages for PAYLOAD containing appointmentGUID
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const turn = conversationHistory[i];
      if (turn.role !== 'assistant') continue;

      const content = turn.content;

      // Pattern 1: PAYLOAD: { ... "appointmentGUID": "value" ... }
      const payloadMatch = content.match(/PAYLOAD:\s*(\{[\s\S]*?\})/i);
      if (payloadMatch) {
        try {
          const payload = JSON.parse(payloadMatch[1]);
          if ('appointmentGUID' in payload) {
            const guid = payload.appointmentGUID;
            // Check if it's a valid GUID (not null, not empty, not "null" string)
            const isValid = guid && guid !== 'null' && guid !== '' && typeof guid === 'string';
            return {
              found: true,
              appointmentGUID: isValid ? guid : null,
              turnNumber: i + 1, // 1-indexed
            };
          }
        } catch (e) {
          // JSON parse failed, continue looking
        }
      }

      // Pattern 2: Raw JSON containing appointmentGUID (agent leaked payload)
      const jsonMatch = content.match(/"appointmentGUID"\s*:\s*"?([^",}\s]+)"?/);
      if (jsonMatch) {
        const guid = jsonMatch[1];
        const isValid = guid && guid !== 'null' && guid !== '';
        return {
          found: true,
          appointmentGUID: isValid ? guid : null,
          turnNumber: i + 1,
        };
      }
    }

    return { found: false, appointmentGUID: null, turnNumber: null };
  }

  /**
   * Check if agent response contains raw PAYLOAD leakage
   *
   * Detects when the agent accidentally exposes internal PAYLOAD JSON to the user.
   * This is considered an error as users shouldn't see internal system data.
   */
  private checkForPayloadLeakage(conversationHistory: ConversationTurn[]): {
    hasLeakage: boolean;
    turnNumber: number | null;
    leakedContent: string | null;
  } {
    for (let i = 0; i < conversationHistory.length; i++) {
      const turn = conversationHistory[i];
      if (turn.role !== 'assistant') continue;

      const content = turn.content;

      // Check for raw PAYLOAD exposure patterns
      // Pattern 1: "PAYLOAD:" followed by JSON in the visible response
      if (/PAYLOAD:\s*\{/i.test(content)) {
        // Extract a snippet for the error message
        const snippet = content.substring(
          content.toUpperCase().indexOf('PAYLOAD:'),
          Math.min(content.length, content.toUpperCase().indexOf('PAYLOAD:') + 100)
        );
        return {
          hasLeakage: true,
          turnNumber: i + 1,
          leakedContent: snippet + '...',
        };
      }

      // Pattern 2: Raw JSON with internal field names exposed
      const internalFields = [
        '"appointmentGUID"',
        '"patientGUID"',
        '"locationGUID"',
        '"providerGUID"',
        '"scheduleViewGUID"',
      ];
      for (const field of internalFields) {
        if (content.includes(field) && content.includes('{') && content.includes('}')) {
          // Only flag if it looks like raw JSON, not just a mention
          const hasJsonStructure = /\{\s*"[^"]+"\s*:\s*[^}]+\}/.test(content);
          if (hasJsonStructure) {
            return {
              hasLeakage: true,
              turnNumber: i + 1,
              leakedContent: `Contains internal field: ${field}`,
            };
          }
        }
      }
    }

    return { hasLeakage: false, turnNumber: null, leakedContent: null };
  }

  /**
   * Generate detailed failure report
   */
  generateFailureReport(result: GoalTestResult): string {
    if (result.passed) {
      return 'Test passed - no failures to report';
    }

    const lines: string[] = ['=== FAILURE REPORT ===', ''];

    // Failed goals
    const failedGoals = result.goalResults.filter(r => !r.passed);
    if (failedGoals.length > 0) {
      lines.push('FAILED GOALS:');
      for (const goal of failedGoals) {
        lines.push(`  - ${goal.goalId}: ${goal.message}`);
        if (goal.details?.missing) {
          lines.push(`    Missing fields: ${goal.details.missing.join(', ')}`);
        }
      }
      lines.push('');
    }

    // Constraint violations
    if (result.constraintViolations.length > 0) {
      lines.push('CONSTRAINT VIOLATIONS:');
      for (const violation of result.constraintViolations) {
        lines.push(`  - [${violation.constraint.severity}] ${violation.message}`);
        if (violation.turnNumber) {
          lines.push(`    At turn: ${violation.turnNumber}`);
        }
      }
      lines.push('');
    }

    // Issues
    if (result.issues.length > 0) {
      lines.push('DETECTED ISSUES:');
      for (const issue of result.issues) {
        lines.push(`  - [${issue.severity}] ${issue.type}: ${issue.description}`);
        lines.push(`    At turn: ${issue.turnNumber}`);
      }
      lines.push('');
    }

    // Progress summary
    lines.push('FINAL STATE:');
    lines.push(`  Turns: ${result.turnCount}`);
    lines.push(`  Duration: ${result.durationMs}ms`);
    lines.push(`  Flow state: ${result.progress.currentFlowState}`);
    lines.push(`  Fields collected: ${result.progress.collectedFields.size}`);
    lines.push(`  Fields pending: ${result.progress.pendingFields.length}`);

    return lines.join('\n');
  }
}
