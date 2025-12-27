/**
 * Progress Tracker Service
 *
 * Tracks conversation progress toward goals.
 * Detects issues like repetition, stuck conversations, etc.
 */
import type { ConversationGoal, CollectableField } from '../tests/types/goals';
import type { IntentDetectionResult } from '../tests/types/intent';
import { ProgressState, CollectedValue, ProgressIssue, ProgressSummary } from '../tests/types/progress';
/**
 * Configuration for progress tracking
 */
export interface ProgressTrackerConfig {
    /** Threshold for detecting stuck conversations */
    stuckThresholdTurns: number;
    /** Maximum consecutive same-intent detections before flagging repetition */
    maxRepetitionCount: number;
    /** Enable issue detection */
    detectIssues: boolean;
}
/**
 * Progress Tracker Service
 *
 * Tracks what data has been collected and progress toward goals.
 */
export declare class ProgressTracker {
    private state;
    private goals;
    private config;
    constructor(goals: ConversationGoal[], cfg?: Partial<ProgressTrackerConfig>);
    /**
     * Calculate all required fields from goals
     */
    private calculateRequiredFields;
    /**
     * Update progress based on the latest turn
     */
    updateProgress(agentIntent: IntentDetectionResult, userResponse: string, turnNumber: number): void;
    /**
     * Map agent intent to collectable field
     */
    private intentToField;
    /**
     * Update flow state based on intent
     */
    private updateFlowState;
    /**
     * Detect conversation issues
     */
    private detectIssues;
    /**
     * Check if the same intent has appeared too many times recently
     */
    private isRepeatingIntent;
    /**
     * Evaluate if goals have been completed
     */
    private evaluateGoals;
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
    private evaluateEndedGoal;
    /**
     * Build goal context for custom evaluations
     */
    private buildGoalContext;
    /**
     * Check if all required goals are complete
     */
    areGoalsComplete(): boolean;
    /**
     * Check if any goals have failed
     */
    hasFailedGoals(): boolean;
    /**
     * Get current progress state
     */
    getState(): ProgressState;
    /**
     * Get pending fields (not yet collected)
     */
    getPendingFields(): CollectableField[];
    /**
     * Get collected fields
     */
    getCollectedFields(): Map<CollectableField, CollectedValue>;
    /**
     * Get progress summary
     */
    getSummary(): ProgressSummary;
    /**
     * Get all issues
     */
    getIssues(): ProgressIssue[];
    /**
     * Get critical issues
     */
    getCriticalIssues(): ProgressIssue[];
    /**
     * Check if conversation should abort (critical issues)
     */
    shouldAbort(): boolean;
    /**
     * Mark the booking as confirmed externally
     */
    markBookingConfirmed(): void;
    /**
     * Mark a transfer as initiated externally
     */
    markTransferInitiated(): void;
    /**
     * Reset tracker for a new conversation
     */
    reset(): void;
}
//# sourceMappingURL=progress-tracker.d.ts.map