"use strict";
/**
 * Response Generator Service
 *
 * Generates user responses based on agent intent and persona inventory.
 * Uses hybrid approach: templates by default when useLlm=false, LLM when useLlm=true.
 * LLM usage is controlled independently of persona verbosity level.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseGenerator = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const DEFAULT_CONFIG = {
    useLlm: false, // Templates by default (hybrid approach)
    model: 'claude-opus-4-5-20251101', // Opus 4.5 for highest quality response generation
    temperature: 0.7,
    maxTokens: 256,
};
/**
 * Response templates for each intent
 */
const RESPONSE_TEMPLATES = {
    // Parent info
    'asking_parent_name': (inv) => `${inv.parentFirstName} ${inv.parentLastName}`,
    'asking_spell_name': (inv) => {
        const fullName = `${inv.parentFirstName} ${inv.parentLastName}`;
        return fullName.split('').join('-').toUpperCase();
    },
    'asking_phone': (inv) => inv.parentPhone,
    'asking_email': (inv) => inv.parentEmail || 'I don\'t have an email',
    // Child info
    'asking_child_count': (inv) => {
        const count = inv.children.length;
        if (count === 1)
            return 'One child';
        if (count === 2)
            return 'Two children';
        return `${count} children`;
    },
    'asking_child_name': (inv, ctx) => {
        const child = inv.children[ctx.currentChildIndex] || inv.children[0];
        if (!child)
            return 'Sorry, I don\'t have that information';
        return `${child.firstName} ${child.lastName}`;
    },
    'asking_child_dob': (inv, ctx) => {
        const child = inv.children[ctx.currentChildIndex] || inv.children[0];
        if (!child)
            return 'I\'m not sure';
        // Format DOB nicely
        const dob = new Date(child.dateOfBirth);
        return dob.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    },
    'asking_child_age': (inv, ctx) => {
        const child = inv.children[ctx.currentChildIndex] || inv.children[0];
        if (!child)
            return 'I\'m not sure';
        const dob = new Date(child.dateOfBirth);
        const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        return `${age} years old`;
    },
    // Patient status
    'asking_new_patient': (inv) => {
        const firstChild = inv.children[0];
        if (!firstChild)
            return 'Yes, new patient';
        return firstChild.isNewPatient ? 'Yes, this would be our first visit' : 'No, we\'ve been here before';
    },
    'asking_previous_visit': (inv) => inv.previousVisitToOffice ? 'Yes, we\'ve visited before' : 'No, this is our first time',
    'asking_previous_ortho': (inv) => {
        if (inv.previousOrthoTreatment)
            return 'Yes, had braces before';
        const child = inv.children[0];
        if (child?.hadBracesBefore)
            return 'Yes, they had braces before at a different orthodontist';
        return 'No, no previous orthodontic treatment';
    },
    // Preferences
    'asking_insurance': (inv) => {
        if (!inv.insuranceProvider && inv.hasInsurance === false)
            return 'No insurance';
        if (!inv.insuranceProvider)
            return 'I\'m not sure about insurance';
        return inv.insuranceProvider;
    },
    'asking_special_needs': (inv) => {
        const child = inv.children[0];
        if (child?.specialNeeds)
            return child.specialNeeds;
        return 'No special needs or conditions';
    },
    'asking_time_preference': (inv) => {
        if (inv.preferredDateRange) {
            const start = new Date(inv.preferredDateRange.start);
            const end = new Date(inv.preferredDateRange.end);
            const startStr = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            const endStr = end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            return `Any time between ${startStr} and ${endStr}`;
        }
        if (inv.preferredTimeOfDay && inv.preferredTimeOfDay !== 'any') {
            return `${inv.preferredTimeOfDay} works best`;
        }
        return 'Any time works for us';
    },
    'asking_location_preference': (inv) => inv.preferredLocation || 'Either location is fine',
    // Confirmations
    'confirming_information': () => 'Yes, that\'s correct',
    'confirming_spelling': () => 'Yes, that\'s right',
    'asking_proceed_confirmation': () => 'Yes, please proceed anyway',
    'reminding_bring_card': () => 'Okay, I\'ll bring the insurance card', // Acknowledge card reminder
    // Booking flow
    'searching_availability': () => 'Okay, thank you', // Wait while bot searches
    'offering_time_slots': () => 'Yes, that time works',
    'confirming_booking': () => 'Great, thank you!', // After booking is confirmed - DON'T say goodbye yet
    // Post-booking info
    'offering_address': () => 'Yes, could you give me the address?', // User requests address
    'providing_address': () => 'Thank you, I got the address', // Acknowledge address received
    'providing_parking_info': () => 'Perfect, thanks for the parking info!', // Acknowledge parking info
    // Terminal
    'saying_goodbye': () => 'Thank you, goodbye!',
    // Transfers
    'initiating_transfer': () => 'Okay, I\'ll hold',
    // Error handling
    'handling_error': () => 'Can you please try again?',
    'asking_clarification': () => 'Sorry, could you repeat that?',
    // Greeting (usually we initiate, but in case agent greets)
    'greeting': () => 'Hi, I need to schedule an orthodontic appointment for my child',
    // Unknown
    'unknown': () => 'Yes',
};
/**
 * Response Generator Service
 */
class ResponseGenerator {
    constructor(persona, cfg) {
        this.client = null;
        this.config = { ...DEFAULT_CONFIG, ...cfg };
        this.persona = persona;
        this.context = {
            currentChildIndex: 0,
            providedData: new Set(),
            conversationHistory: [],
        };
        this.initializeClient();
    }
    initializeClient() {
        // Only initialize LLM client when explicitly enabled via config
        // Verbosity level no longer forces LLM - templates work for all verbosity levels
        if (this.config.useLlm) {
            const token = process.env.CLAUDE_CODE_OAUTH_TOKEN ||
                process.env.ANTHROPIC_API_KEY;
            if (token) {
                this.client = new sdk_1.default({ apiKey: token });
            }
        }
    }
    /**
     * Generate a response to the agent's question
     */
    async generateResponse(intent, conversationHistory) {
        this.context.conversationHistory = conversationHistory;
        // Get data for this intent
        const data = this.getDataForIntent(intent.primaryIntent);
        // Decide: template or LLM?
        const useTemplate = !this.shouldUseLlm(intent);
        if (useTemplate) {
            return this.generateTemplateResponse(intent.primaryIntent, data);
        }
        // Use LLM when enabled via config
        return this.generateLlmResponse(intent, data, conversationHistory);
    }
    /**
     * Determine if we should use LLM instead of template
     */
    shouldUseLlm(intent) {
        // No LLM client available - use templates
        if (!this.client)
            return false;
        // LLM is enabled - use it for unknown intents or low confidence
        if (intent.primaryIntent === 'unknown')
            return true;
        if (intent.confidence < 0.5)
            return true;
        // LLM is enabled - use it for all responses (respects verbosity in prompt)
        // The LLM prompt already handles different verbosity levels appropriately
        return true;
    }
    /**
     * Get relevant data from persona inventory for an intent
     */
    getDataForIntent(intent) {
        const inv = this.persona.inventory;
        const child = inv.children[this.context.currentChildIndex] || inv.children[0];
        switch (intent) {
            case 'asking_parent_name':
                this.markProvided('parent_name');
                return { firstName: inv.parentFirstName, lastName: inv.parentLastName };
            case 'asking_spell_name':
                this.markProvided('parent_name_spelling');
                return { firstName: inv.parentFirstName, lastName: inv.parentLastName };
            case 'asking_phone':
                this.markProvided('parent_phone');
                return { phone: inv.parentPhone };
            case 'asking_email':
                this.markProvided('parent_email');
                return { email: inv.parentEmail };
            case 'asking_child_count':
                this.markProvided('child_count');
                return { count: inv.children.length };
            case 'asking_child_name':
                this.markProvided('child_names');
                return { firstName: child?.firstName, lastName: child?.lastName };
            case 'asking_child_dob':
            case 'asking_child_age':
                this.markProvided('child_dob');
                return { dob: child?.dateOfBirth };
            case 'asking_new_patient':
                this.markProvided('is_new_patient');
                return { isNewPatient: child?.isNewPatient ?? true };
            case 'asking_previous_visit':
                this.markProvided('previous_visit');
                return { previousVisit: inv.previousVisitToOffice ?? false };
            case 'asking_previous_ortho':
                this.markProvided('previous_ortho');
                return { previousOrtho: inv.previousOrthoTreatment ?? child?.hadBracesBefore ?? false };
            case 'asking_insurance':
                this.markProvided('insurance');
                return { provider: inv.insuranceProvider, hasInsurance: inv.hasInsurance };
            case 'asking_special_needs':
                this.markProvided('special_needs');
                return { specialNeeds: child?.specialNeeds };
            case 'asking_time_preference':
                this.markProvided('time_preference');
                return {
                    timeOfDay: inv.preferredTimeOfDay,
                    dateRange: inv.preferredDateRange,
                    days: inv.preferredDays,
                };
            case 'asking_location_preference':
                this.markProvided('location_preference');
                return { location: inv.preferredLocation };
            default:
                return {};
        }
    }
    /**
     * Mark a field as provided
     */
    markProvided(field) {
        this.context.providedData.add(field);
    }
    /**
     * Get fields that have been provided
     */
    getProvidedFields() {
        return Array.from(this.context.providedData);
    }
    /**
     * Generate response using template
     */
    generateTemplateResponse(intent, data) {
        const template = RESPONSE_TEMPLATES[intent];
        if (!template) {
            // No template for this intent, return generic response
            return 'Yes';
        }
        try {
            return template(this.persona.inventory, this.context);
        }
        catch (error) {
            console.warn('[ResponseGenerator] Template error for', intent, error);
            return 'Yes';
        }
    }
    /**
     * Generate response using LLM
     */
    async generateLlmResponse(intent, data, history) {
        if (!this.client) {
            // Fall back to template
            return this.generateTemplateResponse(intent.primaryIntent, data);
        }
        const traits = this.persona.traits;
        const recentHistory = history.slice(-4);
        const childInfo = this.persona.inventory.children.map(c => `${c.firstName} ${c.lastName} (DOB: ${c.dateOfBirth})`).join(', ');
        const prompt = `You are simulating a PARENT calling an orthodontic office to schedule an appointment FOR THEIR CHILD.

## CRITICAL RULE
The appointment is ALWAYS for your CHILD, never for yourself. You are the parent calling on behalf of your child.
Your children: ${childInfo}

## Your Persona
- Name: ${this.persona.name} (you are the PARENT)
- Verbosity: ${traits.verbosity}
- Provides extra unrequested info: ${traits.providesExtraInfo}

## Agent's Question Intent
${intent.primaryIntent} (confidence: ${intent.confidence})
${intent.reasoning || ''}

## Your Data to Provide
${JSON.stringify(data, null, 2)}

## Recent Conversation
${recentHistory.map(t => `[${t.role}]: ${t.content}`).join('\n')}

## Instructions
Generate a natural response as this persona would give.
${traits.verbosity === 'terse' ? 'Keep it very brief - just the requested info.' : ''}
${traits.verbosity === 'verbose' ? 'Be conversational and add some natural filler.' : ''}
${traits.providesExtraInfo ? 'You can volunteer related information if natural.' : 'Only answer what was asked.'}
IMPORTANT: If asked who the appointment is for, ALWAYS say it's for your CHILD, not yourself.
IMPORTANT: When discussing scheduling preferences, NEVER request specific days of the week (Monday, Tuesday, Wednesday, etc.). Only express general preferences like "morning", "afternoon", or "anytime". Be flexible about which day - just express time-of-day preference.

Return ONLY the response text, nothing else.`;
        try {
            const response = await this.client.messages.create({
                model: this.config.model,
                max_tokens: this.config.maxTokens,
                temperature: this.config.temperature,
                messages: [{ role: 'user', content: prompt }],
            });
            const textContent = response.content.find(c => c.type === 'text');
            if (textContent && textContent.type === 'text') {
                return textContent.text.trim();
            }
        }
        catch (error) {
            console.warn('[ResponseGenerator] LLM generation failed:', error);
        }
        // Fall back to template
        return this.generateTemplateResponse(intent.primaryIntent, data);
    }
    /**
     * Move to next child (for multi-child scenarios)
     */
    nextChild() {
        if (this.context.currentChildIndex < this.persona.inventory.children.length - 1) {
            this.context.currentChildIndex++;
        }
    }
    /**
     * Get current child index
     */
    getCurrentChildIndex() {
        return this.context.currentChildIndex;
    }
    /**
     * Reset for a new conversation
     */
    reset() {
        this.context = {
            currentChildIndex: 0,
            providedData: new Set(),
            conversationHistory: [],
        };
    }
}
exports.ResponseGenerator = ResponseGenerator;
//# sourceMappingURL=response-generator.js.map