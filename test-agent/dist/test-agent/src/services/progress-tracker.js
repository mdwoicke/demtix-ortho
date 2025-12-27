"use strict";
/**
 * Progress Tracker Service
 *
 * Tracks conversation progress toward goals.
 * Detects issues like repetition, stuck conversations, etc.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressTracker = void 0;
const intent_1 = require("../tests/types/intent");
const progress_1 = require("../tests/types/progress");
const DEFAULT_CONFIG = {
    stuckThresholdTurns: 5,
    maxRepetitionCount: 2,
    detectIssues: true,
};
/**
 * Progress Tracker Service
 *
 * Tracks what data has been collected and progress toward goals.
 */
class ProgressTracker {
    constructor(goals, cfg) {
        this.goals = goals;
        this.config = { ...DEFAULT_CONFIG, ...cfg };
        // Calculate all required fields from goals
        const requiredFields = this.calculateRequiredFields();
        this.state = (0, progress_1.createInitialProgressState)(requiredFields);
        // Set active goals
        this.state.activeGoals = goals.map(g => g.id);
    }
    /**
     * Calculate all required fields from goals
     */
    calculateRequiredFields() {
        const fields = new Set();
        for (const goal of this.goals) {
            if (goal.type === 'data_collection' && goal.requiredFields) {
                for (const field of goal.requiredFields) {
                    fields.add(field);
                }
            }
        }
        return Array.from(fields);
    }
    /**
     * Update progress based on the latest turn
     */
    updateProgress(agentIntent, userResponse, turnNumber) {
        // Update turn info
        this.state.turnNumber = turnNumber;
        this.state.lastActivityAt = new Date();
        this.state.intentHistory.push(agentIntent.primaryIntent);
        this.state.lastAgentIntent = agentIntent.primaryIntent;
        // Map intent to field and record collection
        const field = this.intentToField(agentIntent.primaryIntent);
        if (field && !this.state.collectedFields.has(field)) {
            this.state.collectedFields.set(field, {
                field,
                value: userResponse,
                collectedAtTurn: turnNumber,
                confirmedByAgent: false,
                userResponse,
            });
            // Remove from pending
            this.state.pendingFields = this.state.pendingFields.filter(f => f !== field);
        }
        // Update flow state based on intent
        this.updateFlowState(agentIntent.primaryIntent);
        // Detect issues
        if (this.config.detectIssues) {
            this.detectIssues(agentIntent, turnNumber);
        }
        // Evaluate goals
        this.evaluateGoals();
    }
    /**
     * Map agent intent to collectable field
     */
    intentToField(intent) {
        const field = intent_1.INTENT_TO_FIELD[intent];
        return field ?? null;
    }
    /**
     * Update flow state based on intent
     */
    updateFlowState(intent) {
        const stateMap = {
            'greeting': 'greeting',
            'asking_parent_name': 'collecting_parent_info',
            'asking_spell_name': 'collecting_parent_info',
            'asking_phone': 'collecting_parent_info',
            'asking_email': 'collecting_parent_info',
            'asking_child_count': 'collecting_child_info',
            'asking_child_name': 'collecting_child_info',
            'asking_child_dob': 'collecting_child_info',
            'asking_child_age': 'collecting_child_info',
            'asking_new_patient': 'collecting_history',
            'asking_previous_visit': 'collecting_history',
            'asking_previous_ortho': 'collecting_history',
            'asking_insurance': 'collecting_insurance',
            'asking_special_needs': 'collecting_special_info',
            'asking_time_preference': 'scheduling',
            'asking_location_preference': 'scheduling',
            'offering_time_slots': 'booking',
            'confirming_booking': 'confirmation',
            'initiating_transfer': 'transfer',
            'saying_goodbye': 'ended',
        };
        // Set persistent flags when key intents are detected
        // These flags survive subsequent flow state changes (e.g., goodbye after booking)
        if (intent === 'confirming_booking') {
            this.state.bookingConfirmed = true;
        }
        if (intent === 'initiating_transfer') {
            this.state.transferInitiated = true;
        }
        if (stateMap[intent]) {
            this.state.currentFlowState = stateMap[intent];
        }
    }
    /**
     * Detect conversation issues
     */
    detectIssues(intent, turnNumber) {
        // Check for repetition
        if (this.isRepeatingIntent(intent.primaryIntent)) {
            this.state.issues.push({
                type: 'repeating',
                description: `Agent asked for ${intent.primaryIntent} again`,
                turnNumber,
                severity: 'medium',
                context: { intent: intent.primaryIntent },
            });
        }
        // Check for stuck (no progress in X turns)
        if (this.state.turnNumber >= this.config.stuckThresholdTurns &&
            this.state.collectedFields.size === 0) {
            this.state.issues.push({
                type: 'stuck',
                description: `No data collected after ${turnNumber} turns`,
                turnNumber,
                severity: 'high',
            });
        }
        // Check for unknown intent
        if (intent.primaryIntent === 'unknown' && intent.confidence < 0.5) {
            this.state.issues.push({
                type: 'unknown_intent',
                description: 'Could not determine agent intent',
                turnNumber,
                severity: 'low',
                context: { confidence: intent.confidence },
            });
        }
    }
    /**
     * Check if the same intent has appeared too many times recently
     */
    isRepeatingIntent(intent) {
        const history = this.state.intentHistory;
        if (history.length < this.config.maxRepetitionCount)
            return false;
        const recent = history.slice(-this.config.maxRepetitionCount);
        return recent.every(i => i === intent);
    }
    /**
     * Evaluate if goals have been completed
     */
    evaluateGoals() {
        for (const goal of this.goals) {
            if (this.state.completedGoals.includes(goal.id))
                continue;
            if (this.state.failedGoals.includes(goal.id))
                continue;
            const result = this.evaluateGoal(goal);
            if (result.passed) {
                this.state.completedGoals.push(goal.id);
                this.state.activeGoals = this.state.activeGoals.filter(id => id !== goal.id);
            }
        }
    }
    /**
     * Evaluate a single goal
     */
    evaluateGoal(goal) {
        switch (goal.type) {
            case 'data_collection':
                return this.evaluateDataCollectionGoal(goal);
            case 'booking_confirmed':
                return this.evaluateBookingGoal();
            case 'transfer_initiated':
                return this.evaluateTransferGoal();
            case 'conversation_ended':
                return this.evaluateEndedGoal();
            case 'custom':
                if (goal.successCriteria) {
                    const context = this.buildGoalContext();
                    return {
                        goalId: goal.id,
                        passed: goal.successCriteria(context),
                        message: 'Custom goal evaluation',
                    };
                }
                return { goalId: goal.id, passed: false, message: 'No success criteria defined' };
            default:
                return { goalId: goal.id, passed: false, message: 'Unknown goal type' };
        }
    }
    /**
     * Evaluate data collection goal
     */
    evaluateDataCollectionGoal(goal) {
        const requiredFields = goal.requiredFields ?? [];
        const collected = Array.from(this.state.collectedFields.keys());
        const missing = requiredFields.filter(f => !collected.includes(f));
        return {
            goalId: goal.id,
            passed: missing.length === 0,
            message: missing.length === 0
                ? 'All required data collected'
                : `Missing: ${missing.join(', ')}`,
            details: {
                required: requiredFields,
                collected: collected.filter(f => requiredFields.includes(f)),
                missing,
            },
        };
    }
    /**
     * Evaluate booking confirmed goal
     * Uses persistent flag to survive goodbye after booking confirmation
     */
    evaluateBookingGoal() {
        const isBookingConfirmed = this.state.bookingConfirmed || // Persistent flag (survives goodbye)
            this.state.currentFlowState === 'confirmation' ||
            this.state.lastAgentIntent === 'confirming_booking';
        return {
            goalId: 'booking-confirmed',
            passed: isBookingConfirmed,
            message: isBookingConfirmed ? 'Booking confirmed' : 'Booking not yet confirmed',
        };
    }
    /**
     * Evaluate transfer initiated goal
     * Uses persistent flag to survive goodbye after transfer initiation
     */
    evaluateTransferGoal() {
        const isTransfer = this.state.transferInitiated || // Persistent flag (survives goodbye)
            this.state.currentFlowState === 'transfer' ||
            this.state.lastAgentIntent === 'initiating_transfer';
        return {
            goalId: 'transfer-initiated',
            passed: isTransfer,
            message: isTransfer ? 'Transfer initiated' : 'No transfer detected',
        };
    }
    /**
     * Evaluate conversation ended goal
     */
    evaluateEndedGoal() {
        const isEnded = this.state.currentFlowState === 'ended' ||
            this.state.lastAgentIntent === 'saying_goodbye';
        return {
            goalId: 'conversation-ended',
            passed: isEnded,
            message: isEnded ? 'Conversation ended properly' : 'Conversation not ended',
        };
    }
    /**
     * Build goal context for custom evaluations
     */
    buildGoalContext() {
        return {
            collectedData: this.state.collectedFields,
            conversationHistory: [], // Would be passed in from runner
            agentConfirmedBooking: this.state.bookingConfirmed || this.state.lastAgentIntent === 'confirming_booking',
            agentInitiatedTransfer: this.state.transferInitiated || this.state.lastAgentIntent === 'initiating_transfer',
            turnCount: this.state.turnNumber,
            elapsedTimeMs: Date.now() - this.state.startedAt.getTime(),
        };
    }
    // ============================================================================
    // PUBLIC ACCESSORS
    // ============================================================================
    /**
     * Check if all required goals are complete
     */
    areGoalsComplete() {
        const requiredGoals = this.goals.filter(g => g.required);
        return requiredGoals.every(g => this.state.completedGoals.includes(g.id));
    }
    /**
     * Check if any goals have failed
     */
    hasFailedGoals() {
        return this.state.failedGoals.length > 0;
    }
    /**
     * Get current progress state
     */
    getState() {
        return { ...this.state };
    }
    /**
     * Get pending fields (not yet collected)
     */
    getPendingFields() {
        return [...this.state.pendingFields];
    }
    /**
     * Get collected fields
     */
    getCollectedFields() {
        return new Map(this.state.collectedFields);
    }
    /**
     * Get progress summary
     */
    getSummary() {
        return (0, progress_1.calculateProgressSummary)(this.state, this.goals.length);
    }
    /**
     * Get all issues
     */
    getIssues() {
        return [...this.state.issues];
    }
    /**
     * Get critical issues
     */
    getCriticalIssues() {
        return this.state.issues.filter(i => i.severity === 'critical');
    }
    /**
     * Check if conversation should abort (critical issues)
     */
    shouldAbort() {
        return this.getCriticalIssues().length > 0;
    }
    /**
     * Mark the booking as confirmed externally
     */
    markBookingConfirmed() {
        this.state.bookingConfirmed = true;
        this.state.currentFlowState = 'confirmation';
        this.evaluateGoals();
    }
    /**
     * Mark a transfer as initiated externally
     */
    markTransferInitiated() {
        this.state.transferInitiated = true;
        this.state.currentFlowState = 'transfer';
        this.evaluateGoals();
    }
    /**
     * Reset tracker for a new conversation
     */
    reset() {
        const requiredFields = this.calculateRequiredFields();
        this.state = (0, progress_1.createInitialProgressState)(requiredFields);
        this.state.activeGoals = this.goals.map(g => g.id);
    }
}
exports.ProgressTracker = ProgressTracker;
//# sourceMappingURL=progress-tracker.js.map