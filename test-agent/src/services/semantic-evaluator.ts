/**
 * Semantic Evaluator Service
 *
 * Uses Claude API or CLI to perform semantic analysis of chatbot responses,
 * replacing brittle regex patterns with AI-powered understanding.
 * Enhanced with Langfuse tracing for comprehensive observability.
 *
 * Modes:
 * - real-time: Evaluate each step immediately (highest accuracy, highest cost)
 * - batch: Evaluate all steps after test completes (balanced)
 * - failures-only: Only use LLM for failed tests (lowest cost)
 */

import { createHash } from 'crypto';
import { config } from '../config/config';
import {
  SemanticEvaluation,
  SemanticEvaluationSchema,
  EvaluationContext,
  SemanticExpectation,
  NegativeExpectation,
} from '../schemas/evaluation-schemas';
import { getLLMProvider, LLMProvider } from '../../../shared/services/llm-provider';
import { isClaudeCliEnabled } from '../../../shared/config/llm-config';
import {
  getLangfuseService,
  getCurrentTraceContext,
  scoreSemanticEvaluation,
} from '../../../shared/services';

// =============================================================================
// Types
// =============================================================================

export interface EvaluatorConfig {
  enabled: boolean;
  mode: 'realtime' | 'batch' | 'failures-only';
  fallbackToRegex: boolean;
  cacheEnabled: boolean;
  cacheTTLMs: number;
  minConfidenceThreshold: number;
  batchSize: number;
  timeout: number;
}

interface CacheEntry {
  evaluation: SemanticEvaluation;
  timestamp: number;
}

// =============================================================================
// Semantic Evaluator Service
// =============================================================================

export class SemanticEvaluator {
  private llmProvider: LLMProvider;
  private cache: Map<string, CacheEntry> = new Map();
  private evaluatorConfig: EvaluatorConfig;

  constructor(evaluatorConfig?: Partial<EvaluatorConfig>) {
    this.evaluatorConfig = {
      enabled: evaluatorConfig?.enabled ?? true,
      mode: evaluatorConfig?.mode ?? 'failures-only',
      fallbackToRegex: evaluatorConfig?.fallbackToRegex ?? true,
      cacheEnabled: evaluatorConfig?.cacheEnabled ?? true,
      cacheTTLMs: evaluatorConfig?.cacheTTLMs ?? 300000, // 5 minutes
      minConfidenceThreshold: evaluatorConfig?.minConfidenceThreshold ?? 0.7,
      batchSize: evaluatorConfig?.batchSize ?? 10,
      timeout: evaluatorConfig?.timeout ?? 30000,
    };

    this.llmProvider = getLLMProvider();
    this.logInitialization();
  }

  private async logInitialization(): Promise<void> {
    const mode = isClaudeCliEnabled() ? 'CLI' : 'API';
    const status = await this.llmProvider.checkAvailability();
    if (status.available) {
      console.log(`[SemanticEvaluator] Initialized with ${mode} mode (provider: ${status.provider})`);
    } else {
      console.log(`[SemanticEvaluator] ${mode} mode not available - will use regex fallback`);
    }
  }

  /**
   * Check if LLM-based evaluation is available
   */
  isAvailable(): boolean {
    return this.llmProvider.isAvailable() && this.evaluatorConfig.enabled;
  }

  /**
   * Get the current evaluation mode
   */
  getMode(): 'realtime' | 'batch' | 'failures-only' {
    return this.evaluatorConfig.mode;
  }

  /**
   * Evaluate a single conversation step
   * Includes Langfuse span tracking for observability
   */
  async evaluateStep(context: EvaluationContext): Promise<SemanticEvaluation> {
    const startTime = Date.now();

    // Check cache first
    if (this.evaluatorConfig.cacheEnabled) {
      const cached = this.getCachedEvaluation(context);
      if (cached) {
        return cached;
      }
    }

    // Get Langfuse context and start span tracking
    const langfuse = getLangfuseService();
    const traceContext = getCurrentTraceContext();
    let span: any = null;

    if (traceContext && await langfuse.ensureInitialized()) {
      try {
        span = await langfuse.startSpan({
          name: `semantic-eval-${context.stepId}`,
          traceId: traceContext.traceId,
          parentObservationId: traceContext.parentObservationId,
          input: {
            stepId: context.stepId,
            userMessage: context.userMessage.substring(0, 200),
            assistantResponse: context.assistantResponse.substring(0, 200),
            expectedBehaviors: context.expectedBehaviors.slice(0, 5),
          },
          metadata: {
            type: 'semantic-evaluation',
            mode: this.evaluatorConfig.mode,
            cacheEnabled: this.evaluatorConfig.cacheEnabled,
          },
        });
      } catch (e: any) {
        // Ignore Langfuse errors
      }
    }

    // Check if LLM is available
    const status = await this.llmProvider.checkAvailability();
    if (!status.available || !this.evaluatorConfig.enabled) {
      const evaluation = this.fallbackEvaluation(context, startTime);
      await this.endEvaluationSpan(span, evaluation, traceContext);
      return evaluation;
    }

    try {
      const prompt = this.buildEvaluationPrompt(context);

      const response = await this.llmProvider.execute({
        prompt,
        model: config.llmAnalysis.model,
        maxTokens: 2048,
        temperature: 0.1, // Low for consistent evaluation
        timeout: this.evaluatorConfig.timeout,
        purpose: 'semantic-evaluation',
        metadata: { stepId: context.stepId },
      });

      if (!response.success) {
        console.error('[SemanticEvaluator] LLM call failed:', response.error);
        const evaluation = this.fallbackEvaluation(context, startTime);
        await this.endEvaluationSpan(span, evaluation, traceContext);
        return evaluation;
      }

      const responseText = response.content || '';
      const evaluation = this.parseAndValidate(responseText, context, startTime);

      // Cache the result
      if (this.evaluatorConfig.cacheEnabled) {
        this.cacheEvaluation(context, evaluation);
      }

      await this.endEvaluationSpan(span, evaluation, traceContext);
      return evaluation;

    } catch (error) {
      console.error('[SemanticEvaluator] Evaluation failed:', error);
      const evaluation = this.fallbackEvaluation(context, startTime);
      await this.endEvaluationSpan(span, evaluation, traceContext);
      return evaluation;
    }
  }

  /**
   * End evaluation span and submit score
   */
  private async endEvaluationSpan(
    span: any,
    evaluation: SemanticEvaluation,
    traceContext: any
  ): Promise<void> {
    if (!span) return;

    const langfuse = getLangfuseService();

    try {
      langfuse.endSpan(span.id, {
        output: {
          passed: evaluation.validation.passed,
          confidence: evaluation.validation.confidence,
          matchedExpectations: evaluation.validation.matchedExpectations.length,
          unmatchedExpectations: evaluation.validation.unmatchedExpectations.length,
          isFallback: evaluation.isFallback,
        },
        level: evaluation.validation.passed ? 'DEFAULT' : 'WARNING',
        statusMessage: evaluation.validation.reasoning?.substring(0, 200),
      });
    } catch (e: any) {
      // Ignore
    }

    // Submit semantic confidence score
    if (traceContext) {
      try {
        await scoreSemanticEvaluation(traceContext.traceId, {
          passed: evaluation.validation.passed,
          confidence: evaluation.validation.confidence,
          reasoning: evaluation.validation.reasoning,
          matchedExpectations: evaluation.validation.matchedExpectations,
          unmatchedExpectations: evaluation.validation.unmatchedExpectations,
          isFallback: evaluation.isFallback,
        }, span.id);
      } catch (e: any) {
        // Ignore scoring errors
      }
    }
  }

  /**
   * Evaluate multiple steps in a batch (more efficient)
   */
  async evaluateBatch(contexts: EvaluationContext[]): Promise<SemanticEvaluation[]> {
    if (contexts.length === 0) return [];

    // Check if LLM is available
    const status = await this.llmProvider.checkAvailability();
    if (!status.available || !this.evaluatorConfig.enabled) {
      return contexts.map(ctx => this.fallbackEvaluation(ctx, Date.now()));
    }

    const startTime = Date.now();
    const evaluations: SemanticEvaluation[] = [];

    // Process in batches to avoid token limits
    for (let i = 0; i < contexts.length; i += this.evaluatorConfig.batchSize) {
      const batch = contexts.slice(i, i + this.evaluatorConfig.batchSize);
      const batchResults = await this.evaluateBatchInternal(batch, startTime);
      evaluations.push(...batchResults);
    }

    return evaluations;
  }

  private async evaluateBatchInternal(
    contexts: EvaluationContext[],
    overallStartTime: number
  ): Promise<SemanticEvaluation[]> {
    // For batch, we send a combined prompt
    const prompt = this.buildBatchPrompt(contexts);

    try {
      const response = await this.llmProvider.execute({
        prompt,
        model: config.llmAnalysis.model,
        maxTokens: 4096,
        temperature: 0.1,
        timeout: this.evaluatorConfig.timeout,
      });

      if (!response.success) {
        console.error('[SemanticEvaluator] Batch evaluation failed:', response.error);
        return contexts.map(ctx => this.fallbackEvaluation(ctx, overallStartTime));
      }

      const responseText = response.content || '';
      return this.parseBatchResponse(responseText, contexts, overallStartTime);

    } catch (error) {
      console.error('[SemanticEvaluator] Batch evaluation failed:', error);
      return contexts.map(ctx => this.fallbackEvaluation(ctx, overallStartTime));
    }
  }

  /**
   * Build the evaluation prompt for a single step
   */
  private buildEvaluationPrompt(context: EvaluationContext): string {
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
      ? context.semanticExpectations.map(e =>
          `- ${e.type}${e.description ? ': ' + e.description : ''} (${e.required ? 'required' : 'optional'})`
        ).join('\n')
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
  private buildBatchPrompt(contexts: EvaluationContext[]): string {
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
  private parseAndValidate(
    responseText: string,
    context: EvaluationContext,
    startTime: number
  ): SemanticEvaluation {
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
      const evaluation: SemanticEvaluation = {
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
      const result = SemanticEvaluationSchema.safeParse(evaluation);
      if (!result.success) {
        console.warn('[SemanticEvaluator] Zod validation warnings:', result.error.issues);
        // Return the evaluation anyway since we've built a valid-ish object
      }

      return evaluation;

    } catch (error) {
      console.error('[SemanticEvaluator] Parse error:', error);
      return this.fallbackEvaluation(context, startTime);
    }
  }

  /**
   * Parse batch response
   */
  private parseBatchResponse(
    responseText: string,
    contexts: EvaluationContext[],
    startTime: number
  ): SemanticEvaluation[] {
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
            errorType: 'none' as const,
            uncertaintyLevel: 'none' as const,
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
        } as SemanticEvaluation;
      });

    } catch (error) {
      console.error('[SemanticEvaluator] Batch parse error:', error);
      return contexts.map(ctx => this.fallbackEvaluation(ctx, startTime));
    }
  }

  /**
   * Fallback evaluation using regex patterns (when LLM unavailable)
   */
  private fallbackEvaluation(
    context: EvaluationContext,
    startTime: number
  ): SemanticEvaluation {
    const response = context.assistantResponse.toLowerCase();

    // Critical error detection (fast regex checks)
    const hasError = /error|exception|failed|null|undefined|nan/i.test(response);
    const isUncertain = /i don't know|i'm not sure|cannot|unable|i can't/i.test(response);
    // Words that may indicate issues but don't fail the test (used for low severity warnings only)
    const hasSoftWarnings = /i'm sorry|apologize|unfortunately|issue with/i.test(response);

    // Helper to parse regex literal strings like "/.+/i" into RegExp
    const parseRegexString = (str: string): RegExp => {
      // Check if it looks like a regex literal: /pattern/flags
      const regexLiteralMatch = str.match(/^\/(.+)\/([gimsuy]*)$/);
      if (regexLiteralMatch) {
        return new RegExp(regexLiteralMatch[1], regexLiteralMatch[2] || 'i');
      }
      // Otherwise treat as plain regex pattern
      return new RegExp(str, 'i');
    };

    // Check expected patterns
    const matchedExpectations: string[] = [];
    const unmatchedExpectations: string[] = [];

    for (const expected of context.expectedBehaviors) {
      try {
        // Try to use it as a regex pattern (handles /pattern/flags format)
        const pattern = parseRegexString(expected);
        if (pattern.test(context.assistantResponse)) {
          matchedExpectations.push(expected);
        } else {
          unmatchedExpectations.push(expected);
        }
      } catch {
        // If not a valid regex, do simple includes check
        if (context.assistantResponse.toLowerCase().includes(expected.toLowerCase())) {
          matchedExpectations.push(expected);
        } else {
          unmatchedExpectations.push(expected);
        }
      }
    }

    // Check unexpected patterns
    const unexpectedBehaviors: string[] = [];
    for (const unexpected of context.unexpectedBehaviors) {
      try {
        const pattern = parseRegexString(unexpected);
        if (pattern.test(context.assistantResponse)) {
          unexpectedBehaviors.push(unexpected);
        }
      } catch {
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
    let severity: 'none' | 'low' | 'medium' | 'high' | 'critical' = 'none';
    if (hasError) severity = 'critical';
    else if (unexpectedBehaviors.length > 0) severity = 'high';
    else if (unmatchedExpectations.length > 0) severity = 'medium';
    else if (hasSoftWarnings) severity = 'low';

    // Guess intent from response content
    let primaryIntent: string = 'unclear';
    if (/hello|hi|welcome|how (can|may) i help/i.test(response)) primaryIntent = 'greeting';
    else if (/schedule|book|appointment/i.test(response)) primaryIntent = 'schedule_appointment';
    else if (/confirm|scheduled|booked|set/i.test(response)) primaryIntent = 'confirmation';
    else if (/name|first|last/i.test(response)) primaryIntent = 'ask_question';

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
        primaryIntent: primaryIntent as any,
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
  private getCacheKey(context: EvaluationContext): string {
    const content = `${context.stepId}:${context.userMessage}:${context.assistantResponse.substring(0, 200)}`;
    return createHash('md5').update(content).digest('hex');
  }

  /**
   * Get cached evaluation if available and not expired
   */
  private getCachedEvaluation(context: EvaluationContext): SemanticEvaluation | null {
    const key = this.getCacheKey(context);
    const entry = this.cache.get(key);

    if (entry && (Date.now() - entry.timestamp) < this.evaluatorConfig.cacheTTLMs) {
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
  private cacheEvaluation(context: EvaluationContext, evaluation: SemanticEvaluation): void {
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
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; enabled: boolean } {
    return {
      size: this.cache.size,
      enabled: this.evaluatorConfig.cacheEnabled,
    };
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const semanticEvaluator = new SemanticEvaluator();
