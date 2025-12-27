/**
 * Goal Evaluator Service
 *
 * Evaluates final test results based on goal completion and constraint satisfaction.
 */
import type { GoalOrientedTestCase, GoalTestResult } from '../tests/types/goal-test';
import type { ProgressState } from '../tests/types/progress';
import type { ConversationTurn } from '../tests/test-case';
/**
 * Goal Evaluator Service
 *
 * Evaluates whether a goal-oriented test passed or failed.
 */
export declare class GoalEvaluator {
    /**
     * Evaluate the final test result
     */
    evaluateTest(testCase: GoalOrientedTestCase, progress: ProgressState, conversationHistory: ConversationTurn[], durationMs: number): GoalTestResult;
    /**
     * Evaluate all goals
     */
    private evaluateAllGoals;
    /**
     * Evaluate a single goal
     */
    private evaluateGoal;
    /**
     * Evaluate data collection goal
     */
    private evaluateDataCollectionGoal;
    /**
     * Evaluate booking confirmed goal
     */
    private evaluateBookingGoal;
    /**
     * Evaluate transfer initiated goal
     */
    private evaluateTransferGoal;
    /**
     * Evaluate conversation ended goal
     */
    private evaluateConversationEndedGoal;
    /**
     * Evaluate error handled goal
     */
    private evaluateErrorHandledGoal;
    /**
     * Check all constraints
     */
    private checkAllConstraints;
    /**
     * Check a single constraint
     */
    private checkConstraint;
    /**
     * Determine overall pass/fail
     */
    private determinePassFail;
    /**
     * Generate human-readable summary
     */
    private generateSummary;
    /**
     * Build goal context for evaluations
     */
    private buildGoalContext;
    /**
     * Generate detailed failure report
     */
    generateFailureReport(result: GoalTestResult): string;
}
//# sourceMappingURL=goal-evaluator.d.ts.map