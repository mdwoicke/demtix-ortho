"use strict";
/**
 * Conversation Goal Types for Goal-Oriented Testing
 *
 * Defines what a test conversation should achieve.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRESET_GOALS = void 0;
/**
 * Preset goals for common scenarios
 */
exports.PRESET_GOALS = {
    /** Collect parent contact information */
    collectParentInfo: (required = true) => ({
        id: 'collect-parent-info',
        type: 'data_collection',
        description: 'Agent collects parent name and contact info',
        requiredFields: ['parent_name', 'parent_phone'],
        priority: 1,
        required,
    }),
    /** Collect child information */
    collectChildInfo: (required = true) => ({
        id: 'collect-child-info',
        type: 'data_collection',
        description: 'Agent collects child name and date of birth',
        requiredFields: ['child_count', 'child_names', 'child_dob'],
        priority: 2,
        required,
    }),
    /** Collect insurance information */
    collectInsurance: (required = true) => ({
        id: 'collect-insurance',
        type: 'data_collection',
        description: 'Agent collects insurance information',
        requiredFields: ['insurance'],
        priority: 3,
        required,
    }),
    /** Collect patient history */
    collectHistory: (required = true) => ({
        id: 'collect-history',
        type: 'data_collection',
        description: 'Agent collects visit and treatment history',
        requiredFields: ['is_new_patient', 'previous_visit', 'previous_ortho'],
        priority: 3,
        required,
    }),
    /** Booking confirmed */
    bookingConfirmed: (required = true) => ({
        id: 'booking-confirmed',
        type: 'booking_confirmed',
        description: 'Agent confirms the appointment is booked',
        priority: 10,
        required,
    }),
    /** Transfer to live agent */
    transferInitiated: (required = true) => ({
        id: 'transfer-initiated',
        type: 'transfer_initiated',
        description: 'Agent transfers to live agent',
        priority: 10,
        required,
    }),
    /** Conversation ended properly */
    conversationEnded: (required = false) => ({
        id: 'conversation-ended',
        type: 'conversation_ended',
        description: 'Conversation ended with proper goodbye',
        priority: 11,
        required,
    }),
};
//# sourceMappingURL=goals.js.map