"use strict";
/**
 * Progress Tracking Types for Goal-Oriented Testing
 *
 * Tracks conversation progress toward goals.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInitialProgressState = createInitialProgressState;
exports.isFieldCollected = isFieldCollected;
exports.getMissingFields = getMissingFields;
exports.calculateProgressSummary = calculateProgressSummary;
/**
 * Create initial progress state
 */
function createInitialProgressState(pendingFields) {
    return {
        collectedFields: new Map(),
        pendingFields: [...pendingFields],
        completedGoals: [],
        activeGoals: [],
        failedGoals: [],
        currentFlowState: 'initial',
        turnNumber: 0,
        lastAgentIntent: 'greeting',
        intentHistory: [],
        startedAt: new Date(),
        lastActivityAt: new Date(),
        issues: [],
    };
}
/**
 * Check if a field has been collected
 */
function isFieldCollected(state, field) {
    return state.collectedFields.has(field);
}
/**
 * Get all missing required fields
 */
function getMissingFields(state, requiredFields) {
    return requiredFields.filter(f => !state.collectedFields.has(f));
}
/**
 * Calculate progress summary
 */
function calculateProgressSummary(state, totalGoals) {
    const collectedCount = state.collectedFields.size;
    const pendingCount = state.pendingFields.length;
    const total = collectedCount + pendingCount;
    return {
        collectedCount,
        pendingCount,
        completedGoals: state.completedGoals.length,
        totalGoals,
        issues: state.issues,
        turnNumber: state.turnNumber,
        percentComplete: total > 0 ? Math.round((collectedCount / total) * 100) : 0,
        estimatedTurnsRemaining: pendingCount > 0 ? pendingCount * 2 : 0,
    };
}
//# sourceMappingURL=progress.js.map