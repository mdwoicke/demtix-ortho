/**
 * Agent Intent Types for Goal-Oriented Testing
 *
 * Defines what the agent is asking for / doing in a response.
 */
/**
 * Possible intents detected from agent responses
 */
export type AgentIntent = 'greeting' | 'saying_goodbye' | 'asking_parent_name' | 'asking_spell_name' | 'asking_phone' | 'asking_email' | 'asking_child_count' | 'asking_child_name' | 'asking_child_dob' | 'asking_child_age' | 'asking_new_patient' | 'asking_previous_visit' | 'asking_previous_ortho' | 'asking_insurance' | 'asking_special_needs' | 'asking_time_preference' | 'asking_location_preference' | 'confirming_information' | 'confirming_spelling' | 'asking_proceed_confirmation' | 'reminding_bring_card' | 'searching_availability' | 'offering_time_slots' | 'confirming_booking' | 'offering_address' | 'providing_address' | 'providing_parking_info' | 'initiating_transfer' | 'handling_error' | 'asking_clarification' | 'unknown';
/**
 * Mapping from intent to the collectable field it relates to
 */
export declare const INTENT_TO_FIELD: Partial<Record<AgentIntent, string>>;
/**
 * Result of intent detection from agent response
 */
export interface IntentDetectionResult {
    /** Primary detected intent */
    primaryIntent: AgentIntent;
    /** Confidence score 0-1 */
    confidence: number;
    /** Secondary intents if agent asked multiple things */
    secondaryIntents?: AgentIntent[];
    /** Any information the agent mentioned/confirmed */
    extractedInfo?: Record<string, any>;
    /** Whether the response is a question */
    isQuestion: boolean;
    /** Whether a user response is expected/needed */
    requiresUserResponse: boolean;
    /** Raw reasoning from the LLM (for debugging) */
    reasoning?: string;
}
/**
 * Keywords that suggest specific intents (for fallback detection)
 */
export declare const INTENT_KEYWORDS: Record<AgentIntent, RegExp[]>;
/**
 * Simple keyword-based intent detection (fallback when LLM unavailable)
 * Uses priority ordering to check terminal intents first
 */
export declare function detectIntentByKeywords(response: string): AgentIntent;
//# sourceMappingURL=intent.d.ts.map