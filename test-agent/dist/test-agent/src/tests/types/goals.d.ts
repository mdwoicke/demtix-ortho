/**
 * Conversation Goal Types for Goal-Oriented Testing
 *
 * Defines what a test conversation should achieve.
 */
import type { ConversationTurn } from '../test-case';
/**
 * Types of conversation goals
 */
export type GoalType = 'data_collection' | 'booking_confirmed' | 'transfer_initiated' | 'error_handled' | 'conversation_ended' | 'custom';
/**
 * Fields that the agent should collect from the user
 */
export type CollectableField = 'parent_name' | 'parent_name_spelling' | 'parent_phone' | 'parent_email' | 'child_count' | 'child_names' | 'child_dob' | 'is_new_patient' | 'previous_visit' | 'previous_ortho' | 'insurance' | 'special_needs' | 'time_preference' | 'location_preference' | 'location_confirmation' | 'card_reminder' | 'address_provided' | 'parking_info';
/**
 * Context passed to goal evaluation functions
 */
export interface GoalContext {
    /** Data collected during the conversation */
    collectedData: Map<CollectableField, any>;
    /** Full conversation history */
    conversationHistory: ConversationTurn[];
    /** Whether agent confirmed a booking */
    agentConfirmedBooking: boolean;
    /** Whether agent initiated transfer to live agent */
    agentInitiatedTransfer: boolean;
    /** Number of conversation turns */
    turnCount: number;
    /** Elapsed time in milliseconds */
    elapsedTimeMs: number;
    /** Any extracted entities from agent responses */
    extractedEntities?: Record<string, any>;
}
/**
 * Result of evaluating a single goal
 */
export interface GoalResult {
    goalId: string;
    passed: boolean;
    message: string;
    details?: {
        required?: CollectableField[];
        collected?: CollectableField[];
        missing?: CollectableField[];
    };
}
/**
 * A single conversation goal
 */
export interface ConversationGoal {
    /** Unique identifier for this goal */
    id: string;
    /** Type of goal */
    type: GoalType;
    /** Human-readable description */
    description: string;
    /** For data_collection goals: which fields must be collected */
    requiredFields?: CollectableField[];
    /** Custom success criteria function */
    successCriteria?: (context: GoalContext) => boolean;
    /** Priority for ordering multiple goals (lower = higher priority) */
    priority: number;
    /** Whether this goal must be achieved for test to pass */
    required: boolean;
}
/**
 * Preset goals for common scenarios
 */
export declare const PRESET_GOALS: {
    /** Collect parent contact information */
    collectParentInfo: (required?: boolean) => ConversationGoal;
    /** Collect child information */
    collectChildInfo: (required?: boolean) => ConversationGoal;
    /** Collect insurance information */
    collectInsurance: (required?: boolean) => ConversationGoal;
    /** Collect patient history */
    collectHistory: (required?: boolean) => ConversationGoal;
    /** Booking confirmed */
    bookingConfirmed: (required?: boolean) => ConversationGoal;
    /** Transfer to live agent */
    transferInitiated: (required?: boolean) => ConversationGoal;
    /** Conversation ended properly */
    conversationEnded: (required?: boolean) => ConversationGoal;
};
//# sourceMappingURL=goals.d.ts.map