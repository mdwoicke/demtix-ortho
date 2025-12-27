"use strict";
/**
 * Semantic Evaluator Service
 *
 * Uses Claude API to perform semantic analysis of chatbot responses,
 * replacing brittle regex patterns with AI-powered understanding.
 *
 * Modes:
 * - real-time: Evaluate each step immediately (highest accuracy, highest cost)
 * - batch: Evaluate all steps after test completes (balanced)
 * - failures-only: Only use LLM for failed tests (lowest cost)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.semanticEvaluator = exports.SemanticEvaluator = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const crypto_1 = require("crypto");
const config_1 = require("../config/config");
const evaluation_schemas_1 = require("../schemas/evaluation-schemas");
// =============================================================================
// Semantic Evaluator Service
// =============================================================================
class SemanticEvaluator {
    constructor(evaluatorConfig) {
        this.client = null;
        this.cache = new Map();
        this.config = {
            enabled: evaluatorConfig?.enabled ?? true,
            mode: evaluatorConfig?.mode ?? 'failures-only',
            fallbackToRegex: evaluatorConfig?.fallbackToRegex ?? true,
            cacheEnabled: evaluatorConfig?.cacheEnabled ?? true,
            cacheTTLMs: evaluatorConfig?.cacheTTLMs ?? 300000, // 5 minutes
            minConfidenceThreshold: evaluatorConfig?.minConfidenceThreshold ?? 0.7,
            batchSize: evaluatorConfig?.batchSize ?? 10,
            timeout: evaluatorConfig?.timeout ?? 30000,
        };
        this.initializeClient();
    }
    initializeClient() {
        const token = process.env.CLAUDE_CODE_OAUTH_TOKEN ||
            process.env.ANTHROPIC_API_KEY;
        if (token) {
            this.client = new sdk_1.default({ apiKey: token });
            console.log('[SemanticEvaluator] Initialized with API token');
        }
        else {
            console.log('[SemanticEvaluator] No API token found - will use regex fallback');
        }
    }
    /**
     * Check if LLM-based evaluation is available
     */
    isAvailable() {
        return this.client !== null && this.config.enabled;
    }
    /**
     * Get the current evaluation mode
     */
    getMode() {
        return this.config.mode;
    }
    /**
     * Evaluate a single conversation step
     */
    async evaluateStep(context) {
        const startTime = Date.now();
        // Check cache first
        if (this.config.cacheEnabled) {
            const cached = this.getCachedEvaluation(context);
            if (cached) {
                return cached;
            }
        }
        // If LLM not available, use fallback
        if (!this.client || !this.config.enabled) {
            return this.fallbackEvaluation(context, startTime);
        }
        try {
            const prompt = this.buildEvaluationPrompt(context);
            const response = await this.client.messages.create({
                model: config_1.config.llmAnalysis.model,
                max_tokens: 2048,
                temperature: 0.1, // Low for consistent evaluation
                messages: [{ role: 'user', content: prompt }],
            });
            const responseText = response.content[0].type === 'text'
                ? response.content[0].text
                : '';
            const evaluation = this.parseAndValidate(responseText, context, startTime);
            // Cache the result
            if (this.config.cacheEnabled) {
                this.cacheEvaluation(context, evaluation);
            }
            return evaluation;
        }
        catch (error) {
            console.error('[SemanticEvaluator] Evaluation failed:', error);
            return this.fallbackEvaluation(context, startTime);
        }
    }
    /**
     * Evaluate multiple steps in a batch (more efficient)
     */
    async evaluateBatch(contexts) {
        if (contexts.length === 0)
            return [];
        // If LLM not available, fall back for all
        if (!this.client || !this.config.enabled) {
            return contexts.map(ctx => this.fallbackEvaluation(ctx, Date.now()));
        }
        const startTime = Date.now();
        const evaluations = [];
        // Process in batches to avoid token limits
        for (let i = 0; i < contexts.length; i += this.config.batchSize) {
            const batch = contexts.slice(i, i + this.config.batchSize);
            const batchResults = await this.evaluateBatchInternal(batch, startTime);
            evaluations.push(...batchResults);
        }
        return evaluations;
    }
    async evaluateBatchInternal(contexts, overallStartTime) {
        // For batch, we send a combined prompt
        const prompt = this.buildBatchPrompt(contexts);
        try {
            const response = await this.client.messages.create({
                model: config_1.config.llmAnalysis.model,
                max_tokens: 4096,
                temperature: 0.1,
                messages: [{ role: 'user', content: prompt }],
            });
            const responseText = response.content[0].type === 'text'
                ? response.content[0].text
                : '';
            return this.parseBatchResponse(responseText, contexts, overallStartTime);
        }
        catch (error) {
            console.error('[SemanticEvaluator] Batch evaluation failed:', error);
            return contexts.map(ctx => this.fallbackEvaluation(ctx, overallStartTime));
        }
    }
    /**
     * Build the evaluation prompt for a single step
     */
    buildEvaluationPrompt(context) {
        const historyStr = context.conversationHistory
            .slice(-6) // Last 6 turns for context
            .map(t => `[${t.role}]: ${t.content.substring(0, 400)}`)
            .join('\n');
        const expectedStr = context.expectedBehaviors.length > 0
            ? context.expectedBehaviors.map(b => `- ${b}`).join('\n')
            : '- Respond helpfully and professionally';
        const unexpectedStr = context.unexpectedBehaviors.length > 0
            ? context.unexpectedBehaviors.map(b => `- ${b}`).join('\n')
            : '- No specific behaviors to avoid';
        const semanticStr = context.semanticExpectations && context.semanticExpectations.length > 0
            ? context.semanticExpectations.map(e => `- ${e.type}${e.description ? ': ' + e.description : ''} (${e.required ? 'required' : 'optional'})`).join('\n')
            : '';
        return `You are evaluating a chatbot response for an orthodontic appointment scheduling assistant named "Allie".

## Conversation Context
Step: ${context.stepId}${context.stepDescription ? ' - ' + context.stepDescription : ''}

**User said:** "${context.userMessage}"

**Assistant responded:** "${context.assistantResponse}"

## Recent History
${historyStr}

## Expected Behaviors
${expectedStr}
${semanticStr ? '\n## Semantic Expectations\n' + semanticStr : ''}

## Should NOT Happen
${unexpectedStr}

## Your Task
Evaluate the assistant's response and return a JSON object with this exact structure:

\`\`\`json
{
  "responseQuality": {
    "isHelpful": true,
    "isOnTopic": true,
    "hasError": false,
    "errorType": "none",
    "uncertaintyLevel": "none",
    "professionalTone": true,
    "confidence": 0.95,
    "reasoning": "Response appropriately greets and asks for information"
  },
  "intent": {
    "primaryIntent": "greeting",
    "confidence": 0.9,
    "extractedEntities": {}
  },
  "flowState": {
    "flowState": "greeting",
    "isProgressingCorrectly": true,
    "isStuck": false,
    "isRepeating": false,
    "missingInformation": [],
    "confidence": 0.9
  },
  "validation": {
    "passed": true,
    "matchedExpectations": ["greeting", "asks for name"],
    "unmatchedExpectations": [],
    "unexpectedBehaviors": [],
    "severity": "none",
    "confidence": 0.95,
    "reasoning": "Response meets all expected behaviors"
  }
}
\`\`\`

Return ONLY the JSON object, no other text.`;
    }
    /**
     * Build a batch prompt for multiple steps
     */
    buildBatchPrompt(contexts) {
        const stepsStr = contexts.map((ctx, i) => `
### Step ${i + 1}: ${ctx.stepId}
**User:** "${ctx.userMessage}"
**Assistant:** "${ctx.assistantResponse}"
**Expected:** ${ctx.expectedBehaviors.slice(0, 3).join(', ')}
`).join('\n');
        return `You are evaluating multiple chatbot responses for "Allie", an orthodontic scheduling assistant.

## Steps to Evaluate
${stepsStr}

## Your Task
For EACH step, provide an evaluation. Return a JSON array with one object per step:

\`\`\`json
[
  {
    "stepId": "step-1",
    "validation": {
      "passed": true,
      "matchedExpectations": ["greeting"],
      "unmatchedExpectations": [],
      "unexpectedBehaviors": [],
      "severity": "none",
      "confidence": 0.9,
      "reasoning": "Response is appropriate"
    },
    "intent": { "primaryIntent": "greeting", "confidence": 0.9 },
    "flowState": { "flowState": "greeting", "isProgressingCorrectly": true, "confidence": 0.9 }
  }
]
\`\`\`

Return ONLY the JSON array.`;
    }
    /**
     * Parse and validate LLM response for single step
     */
    parseAndValidate(responseText, context, startTime) {
        try {
            // Extract JSON from response
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                responseText.match(/\{[\s\S]*"validation"[\s\S]*\}/);
            if (!jsonMatch) {
                console.warn('[SemanticEvaluator] No JSON found in response');
                return this.fallbackEvaluation(context, startTime);
            }
            const jsonStr = jsonMatch[1] || jsonMatch[0];
            const parsed = JSON.parse(jsonStr);
            // Build full evaluation object
            const evaluation = {
                stepId: context.stepId,
                responseQuality: {
                    isHelpful: parsed.responseQuality?.isHelpful ?? true,
                    isOnTopic: parsed.responseQuality?.isOnTopic ?? true,
                    hasError: parsed.responseQuality?.hasError ?? false,
                    errorType: parsed.responseQuality?.errorType ?? 'none',
                    uncertaintyLevel: parsed.responseQuality?.uncertaintyLevel ?? 'none',
                    professionalTone: parsed.responseQuality?.professionalTone ?? true,
                    confidence: parsed.responseQuality?.confidence ?? 0.7,
                    reasoning: parsed.responseQuality?.reasoning ?? 'LLM evaluation',
                },
                intent: {
                    primaryIntent: parsed.intent?.primaryIntent ?? 'unclear',
                    confidence: parsed.intent?.confidence ?? 0.5,
                    extractedEntities: parsed.intent?.extractedEntities,
                },
                flowState: {
                    flowState: parsed.flowState?.flowState ?? 'greeting',
                    isProgressingCorrectly: parsed.flowState?.isProgressingCorrectly ?? true,
                    isStuck: parsed.flowState?.isStuck ?? false,
                    isRepeating: parsed.flowState?.isRepeating ?? false,
                    missingInformation: parsed.flowState?.missingInformation ?? [],
                    confidence: parsed.flowState?.confidence ?? 0.5,
                },
                validation: {
                    passed: parsed.validation?.passed ?? true,
                    matchedExpectations: parsed.validation?.matchedExpectations ?? [],
                    unmatchedExpectations: parsed.validation?.unmatchedExpectations ?? [],
                    unexpectedBehaviors: parsed.validation?.unexpectedBehaviors ?? [],
                    severity: parsed.validation?.severity ?? 'none',
                    confidence: parsed.validation?.confidence ?? 0.7,
                    reasoning: parsed.validation?.reasoning ?? 'LLM evaluation',
                },
                timestamp: new Date().toISOString(),
                evaluationTimeMs: Date.now() - startTime,
                isFallback: false,
            };
            // Validate with Zod (optional strict validation)
            const result = evaluation_schemas_1.SemanticEvaluationSchema.safeParse(evaluation);
            if (!result.success) {
                console.warn('[SemanticEvaluator] Zod validation warnings:', result.error.issues);
                // Return the evaluation anyway since we've built a valid-ish object
            }
            return evaluation;
        }
        catch (error) {
            console.error('[SemanticEvaluator] Parse error:', error);
            return this.fallbackEvaluation(context, startTime);
        }
    }
    /**
     * Parse batch response
     */
    parseBatchResponse(responseText, contexts, startTime) {
        try {
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                responseText.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                return contexts.map(ctx => this.fallbackEvaluation(ctx, startTime));
            }
            const jsonStr = jsonMatch[1] || jsonMatch[0];
            const parsed = JSON.parse(jsonStr);
            if (!Array.isArray(parsed)) {
                return contexts.map(ctx => this.fallbackEvaluation(ctx, startTime));
            }
            // Map parsed results to contexts
            return contexts.map((ctx, i) => {
                const result = parsed[i];
                if (!result) {
                    return this.fallbackEvaluation(ctx, startTime);
                }
                return {
                    stepId: ctx.stepId,
                    responseQuality: {
                        isHelpful: true,
                        isOnTopic: true,
                        hasError: false,
                        errorType: 'none',
                        uncertaintyLevel: 'none',
                        professionalTone: true,
                        confidence: 0.7,
                        reasoning: 'Batch evaluation',
                    },
                    intent: {
                        primaryIntent: result.intent?.primaryIntent ?? 'unclear',
                        confidence: result.intent?.confidence ?? 0.5,
                    },
                    flowState: {
                        flowState: result.flowState?.flowState ?? 'greeting',
                        isProgressingCorrectly: result.flowState?.isProgressingCorrectly ?? true,
                        isStuck: false,
                        isRepeating: false,
                        missingInformation: [],
                        confidence: result.flowState?.confidence ?? 0.5,
                    },
                    validation: {
                        passed: result.validation?.passed ?? true,
                        matchedExpectations: result.validation?.matchedExpectations ?? [],
                        unmatchedExpectations: result.validation?.unmatchedExpectations ?? [],
                        unexpectedBehaviors: result.validation?.unexpectedBehaviors ?? [],
                        severity: result.validation?.severity ?? 'none',
                        confidence: result.validation?.confidence ?? 0.7,
                        reasoning: result.validation?.reasoning ?? 'Batch evaluation',
                    },
                    timestamp: new Date().toISOString(),
                    evaluationTimeMs: Date.now() - startTime,
                    isFallback: false,
                };
            });
        }
        catch (error) {
            console.error('[SemanticEvaluator] Batch parse error:', error);
            return contexts.map(ctx => this.fallbackEvaluation(ctx, startTime));
        }
    }
    /**
     * Fallback evaluation using regex patterns (when LLM unavailable)
     */
    fallbackEvaluation(context, startTime) {
        const response = context.assistantResponse.toLowerCase();
        // Critical error detection (fast regex checks)
        const hasError = /error|exception|failed|null|undefined|nan/i.test(response);
        const isUncertain = /i don't know|i'm not sure|cannot|unable|i can't/i.test(response);
        // Words that may indicate issues but don't fail the test (used for low severity warnings only)
        const hasSoftWarnings = /i'm sorry|apologize|unfortunately|issue with/i.test(response);
        // Helper to parse regex literal strings like "/.+/i" into RegExp
        const parseRegexString = (str) => {
            // Check if it looks like a regex literal: /pattern/flags
            const regexLiteralMatch = str.match(/^\/(.+)\/([gimsuy]*)$/);
            if (regexLiteralMatch) {
                return new RegExp(regexLiteralMatch[1], regexLiteralMatch[2] || 'i');
            }
            // Otherwise treat as plain regex pattern
            return new RegExp(str, 'i');
        };
        // Check expected patterns
        const matchedExpectations = [];
        const unmatchedExpectations = [];
        for (const expected of context.expectedBehaviors) {
            try {
                // Try to use it as a regex pattern (handles /pattern/flags format)
                const pattern = parseRegexString(expected);
                if (pattern.test(context.assistantResponse)) {
                    matchedExpectations.push(expected);
                }
                else {
                    unmatchedExpectations.push(expected);
                }
            }
            catch {
                // If not a valid regex, do simple includes check
                if (context.assistantResponse.toLowerCase().includes(expected.toLowerCase())) {
                    matchedExpectations.push(expected);
                }
                else {
                    unmatchedExpectations.push(expected);
                }
            }
        }
        // Check unexpected patterns
        const unexpectedBehaviors = [];
        for (const unexpected of context.unexpectedBehaviors) {
            try {
                const pattern = parseRegexString(unexpected);
                if (pattern.test(context.assistantResponse)) {
                    unexpectedBehaviors.push(unexpected);
                }
            }
            catch {
                if (context.assistantResponse.toLowerCase().includes(unexpected.toLowerCase())) {
                    unexpectedBehaviors.push(unexpected);
                }
            }
        }
        // Determine pass/fail
        const passed = !hasError &&
            unmatchedExpectations.length === 0 &&
            unexpectedBehaviors.length === 0;
        // Determine severity
        let severity = 'none';
        if (hasError)
            severity = 'critical';
        else if (unexpectedBehaviors.length > 0)
            severity = 'high';
        else if (unmatchedExpectations.length > 0)
            severity = 'medium';
        else if (hasSoftWarnings)
            severity = 'low';
        // Guess intent from response content
        let primaryIntent = 'unclear';
        if (/hello|hi|welcome|how (can|may) i help/i.test(response))
            primaryIntent = 'greeting';
        else if (/schedule|book|appointment/i.test(response))
            primaryIntent = 'schedule_appointment';
        else if (/confirm|scheduled|booked|set/i.test(response))
            primaryIntent = 'confirmation';
        else if (/name|first|last/i.test(response))
            primaryIntent = 'ask_question';
        return {
            stepId: context.stepId,
            responseQuality: {
                isHelpful: !hasError && response.length > 20,
                isOnTopic: true, // Cannot determine without LLM
                hasError,
                errorType: hasError ? 'technical' : 'none',
                uncertaintyLevel: isUncertain ? 'high' : 'none',
                professionalTone: !hasSoftWarnings,
                confidence: 0.5, // Low confidence for fallback
                reasoning: 'Regex-based fallback evaluation - LLM unavailable',
            },
            intent: {
                primaryIntent: primaryIntent,
                confidence: 0.4,
            },
            flowState: {
                flowState: 'greeting', // Default - cannot determine without LLM
                isProgressingCorrectly: passed,
                isStuck: false,
                isRepeating: false,
                missingInformation: [],
                confidence: 0.3,
            },
            validation: {
                passed,
                matchedExpectations,
                unmatchedExpectations,
                unexpectedBehaviors,
                severity,
                confidence: 0.5,
                reasoning: hasError
                    ? 'Critical error detected in response'
                    : unexpectedBehaviors.length > 0
                        ? `Found unexpected behaviors: ${unexpectedBehaviors.join(', ')}`
                        : unmatchedExpectations.length > 0
                            ? `Missing expected behaviors: ${unmatchedExpectations.join(', ')}`
                            : 'All regex checks passed',
                suggestedAction: hasError ? 'Review error handling' : undefined,
            },
            timestamp: new Date().toISOString(),
            evaluationTimeMs: Date.now() - startTime,
            isFallback: true,
        };
    }
    /**
     * Generate cache key from context
     */
    getCacheKey(context) {
        const content = `${context.stepId}:${context.userMessage}:${context.assistantResponse.substring(0, 200)}`;
        return (0, crypto_1.createHash)('md5').update(content).digest('hex');
    }
    /**
     * Get cached evaluation if available and not expired
     */
    getCachedEvaluation(context) {
        const key = this.getCacheKey(context);
        const entry = this.cache.get(key);
        if (entry && (Date.now() - entry.timestamp) < this.config.cacheTTLMs) {
            return entry.evaluation;
        }
        // Remove expired entry
        if (entry) {
            this.cache.delete(key);
        }
        return null;
    }
    /**
     * Cache an evaluation result
     */
    cacheEvaluation(context, evaluation) {
        const key = this.getCacheKey(context);
        this.cache.set(key, {
            evaluation,
            timestamp: Date.now(),
        });
        // Clean up old entries (keep cache size reasonable)
        if (this.cache.size > 1000) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }
    }
    /**
     * Clear the evaluation cache
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            enabled: this.config.cacheEnabled,
        };
    }
}
exports.SemanticEvaluator = SemanticEvaluator;
// =============================================================================
// Singleton Instance
// =============================================================================
exports.semanticEvaluator = new SemanticEvaluator();
//# sourceMappingURL=semantic-evaluator.js.map