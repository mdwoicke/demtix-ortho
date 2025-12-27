"use strict";
/**
 * Intent Detector Service
 *
 * Uses LLM to detect what the agent is asking for from its response.
 * Falls back to keyword-based detection when LLM is unavailable.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentDetector = void 0;
exports.getIntentDetector = getIntentDetector;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const intent_1 = require("../tests/types/intent");
const DEFAULT_CONFIG = {
    useLlm: true,
    model: 'claude-opus-4-5-20251101', // Using Opus 4.5 for all LLM calls
    temperature: 0.1,
    maxTokens: 512,
    timeout: 15000,
    cacheEnabled: true,
    cacheTtlMs: 300000, // 5 minutes
};
/**
 * Intent Detector Service
 *
 * Analyzes agent responses to determine what information they're asking for.
 */
class IntentDetector {
    constructor(cfg) {
        this.client = null;
        this.cache = new Map();
        this.config = { ...DEFAULT_CONFIG, ...cfg };
        this.initializeClient();
    }
    initializeClient() {
        const token = process.env.CLAUDE_CODE_OAUTH_TOKEN ||
            process.env.ANTHROPIC_API_KEY;
        if (token && this.config.useLlm) {
            this.client = new sdk_1.default({ apiKey: token });
            console.log('[IntentDetector] Initialized with LLM support');
        }
        else {
            console.log('[IntentDetector] Running in keyword-only mode');
        }
    }
    /**
     * Check if LLM-based detection is available
     */
    isLlmAvailable() {
        return this.client !== null;
    }
    /**
     * Check for terminal intent patterns that should override LLM detection
     * These are high-confidence patterns that indicate definitive state changes
     */
    checkForTerminalIntentOverride(agentResponse) {
        // Explicit booking confirmation patterns
        const bookingPatterns = [
            /\bappointment has been (successfully )?scheduled\b/i,
            /\bI have booked\b/i,
            /\byour appointment is confirmed\b/i,
            /\bappointment.*scheduled.*for (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i,
        ];
        for (const pattern of bookingPatterns) {
            if (pattern.test(agentResponse)) {
                return {
                    primaryIntent: 'confirming_booking',
                    confidence: 0.95,
                    isQuestion: false,
                    requiresUserResponse: false,
                    reasoning: 'Explicit booking confirmation detected',
                };
            }
        }
        return null;
    }
    /**
     * Detect the intent from an agent response
     */
    async detectIntent(agentResponse, conversationHistory, pendingFields = []) {
        // FIRST: Check for terminal intent patterns that should override everything
        const terminalOverride = this.checkForTerminalIntentOverride(agentResponse);
        if (terminalOverride) {
            return terminalOverride;
        }
        // Check cache
        const cacheKey = this.getCacheKey(agentResponse, pendingFields);
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            return cached;
        }
        // Try LLM detection
        if (this.client && this.config.useLlm) {
            try {
                const result = await this.detectWithLlm(agentResponse, conversationHistory, pendingFields);
                this.saveToCache(cacheKey, result);
                return result;
            }
            catch (error) {
                console.warn('[IntentDetector] LLM detection failed, falling back to keywords:', error);
            }
        }
        // Fall back to keyword detection
        const result = this.detectWithKeywords(agentResponse);
        this.saveToCache(cacheKey, result);
        return result;
    }
    /**
     * Detect intent using LLM
     */
    async detectWithLlm(agentResponse, conversationHistory, pendingFields) {
        const prompt = this.buildPrompt(agentResponse, conversationHistory, pendingFields);
        const response = await this.client.messages.create({
            model: this.config.model,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            messages: [{ role: 'user', content: prompt }],
        });
        const textContent = response.content.find(c => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
            throw new Error('No text response from LLM');
        }
        return this.parseResponse(textContent.text);
    }
    /**
     * Build the prompt for intent detection
     */
    buildPrompt(agentResponse, conversationHistory, pendingFields) {
        // Get recent history (last 4 turns)
        const recentHistory = conversationHistory.slice(-4);
        const historyText = recentHistory.length > 0
            ? recentHistory.map(t => `[${t.role}]: ${t.content}`).join('\n')
            : 'No prior conversation';
        return `You are analyzing an orthodontic scheduling assistant's response to detect what information it's asking for.

## Agent's Response
"${agentResponse}"

## Recent Conversation History
${historyText}

## Fields Not Yet Collected
${pendingFields.length > 0 ? pendingFields.join(', ') : 'None specified'}

## Your Task
Identify the agent's PRIMARY intent from this response. What information is the agent asking for or what action is it taking?

Return ONLY a JSON object (no markdown, no explanation):

{
  "primaryIntent": "asking_parent_name",
  "confidence": 0.95,
  "secondaryIntents": [],
  "isQuestion": true,
  "requiresUserResponse": true,
  "reasoning": "Agent asks 'May I have your first and last name?'"
}

## Valid Intent Values
- greeting, saying_goodbye
- asking_parent_name, asking_spell_name, asking_phone, asking_email
- asking_child_count, asking_child_name, asking_child_dob, asking_child_age
- asking_new_patient, asking_previous_visit, asking_previous_ortho
- asking_insurance, asking_special_needs, asking_time_preference, asking_location_preference
- confirming_information, confirming_spelling, asking_proceed_confirmation
- offering_time_slots, confirming_booking
- initiating_transfer, handling_error, asking_clarification
- unknown

Note: Use asking_proceed_confirmation when agent asks "Would you like to proceed anyway?" (e.g., for out-of-network insurance)

## Guidelines
- Choose the MOST SPECIFIC intent that matches
- If agent asks multiple things, put additional intents in secondaryIntents
- requiresUserResponse=true if the agent is expecting user input
- isQuestion=true if the response ends with a question or asks for information
- confidence should be 0.7-1.0 based on how clear the intent is`;
    }
    /**
     * Parse LLM response into IntentDetectionResult
     */
    parseResponse(text) {
        try {
            // Try to extract JSON from the response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            const parsed = JSON.parse(jsonMatch[0]);
            // Validate primaryIntent
            const validIntents = Object.keys(intent_1.INTENT_KEYWORDS);
            if (!validIntents.includes(parsed.primaryIntent)) {
                parsed.primaryIntent = 'unknown';
            }
            return {
                primaryIntent: parsed.primaryIntent,
                confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
                secondaryIntents: (parsed.secondaryIntents || []).filter((i) => validIntents.includes(i)),
                isQuestion: parsed.isQuestion ?? true,
                requiresUserResponse: parsed.requiresUserResponse ?? true,
                extractedInfo: parsed.extractedInfo,
                reasoning: parsed.reasoning,
            };
        }
        catch (error) {
            console.warn('[IntentDetector] Failed to parse LLM response:', error);
            // Return a safe default
            return {
                primaryIntent: 'unknown',
                confidence: 0.3,
                isQuestion: true,
                requiresUserResponse: true,
                reasoning: 'Failed to parse LLM response',
            };
        }
    }
    /**
     * Detect intent using keyword matching
     */
    detectWithKeywords(agentResponse) {
        const primaryIntent = (0, intent_1.detectIntentByKeywords)(agentResponse);
        // Determine if it's a question
        const isQuestion = /\?/.test(agentResponse) ||
            /\b(what|how|when|where|who|which|could you|would you|can you|may i)\b/i.test(agentResponse);
        // Determine if response is expected
        const terminalIntents = ['saying_goodbye', 'confirming_booking', 'initiating_transfer'];
        const requiresUserResponse = !terminalIntents.includes(primaryIntent);
        return {
            primaryIntent,
            confidence: primaryIntent === 'unknown' ? 0.3 : 0.7,
            isQuestion,
            requiresUserResponse,
            reasoning: `Keyword match for '${primaryIntent}'`,
        };
    }
    /**
     * Generate cache key
     */
    getCacheKey(response, pendingFields) {
        // Use first 100 chars of response + pending fields
        const prefix = response.slice(0, 100).toLowerCase().replace(/\s+/g, ' ');
        return `${prefix}|${pendingFields.sort().join(',')}`;
    }
    /**
     * Get from cache if valid
     */
    getFromCache(key) {
        if (!this.config.cacheEnabled)
            return null;
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        if (Date.now() - entry.timestamp > this.config.cacheTtlMs) {
            this.cache.delete(key);
            return null;
        }
        return entry.result;
    }
    /**
     * Save to cache
     */
    saveToCache(key, result) {
        if (!this.config.cacheEnabled)
            return;
        this.cache.set(key, {
            result,
            timestamp: Date.now(),
        });
        // Clean old entries periodically
        if (this.cache.size > 100) {
            this.cleanCache();
        }
    }
    /**
     * Clean expired cache entries
     */
    cleanCache() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.config.cacheTtlMs) {
                this.cache.delete(key);
            }
        }
    }
    /**
     * Clear the cache
     */
    clearCache() {
        this.cache.clear();
    }
}
exports.IntentDetector = IntentDetector;
// Default singleton instance
let defaultInstance = null;
function getIntentDetector() {
    if (!defaultInstance) {
        defaultInstance = new IntentDetector();
    }
    return defaultInstance;
}
//# sourceMappingURL=intent-detector.js.map