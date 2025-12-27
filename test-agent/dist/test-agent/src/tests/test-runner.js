"use strict";
/**
 * Test Execution Engine
 * Runs test cases and collects results
 *
 * Enhanced with AI-powered semantic evaluation for better accuracy
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestRunner = void 0;
const config_1 = require("../config/config");
const semantic_evaluator_1 = require("../services/semantic-evaluator");
class TestRunner {
    constructor(flowiseClient, cloud9Client, analyzer, database) {
        this.flowiseClient = flowiseClient;
        this.cloud9Client = cloud9Client;
        this.analyzer = analyzer;
        this.database = database;
    }
    async runTest(testCase, runId) {
        const startTime = Date.now();
        const context = await this.initializeContext(testCase);
        const findings = [];
        const transcript = [];
        this.flowiseClient.newSession();
        if (testCase.setup) {
            await testCase.setup(context);
        }
        let status = 'passed';
        let errorMessage;
        try {
            for (const step of testCase.steps) {
                const userMessage = typeof step.userMessage === 'function' ? step.userMessage(context) : step.userMessage;
                const stepResult = await this.executeStep(step, context, transcript, runId, testCase.id);
                if (!stepResult.passed && !step.optional) {
                    status = 'failed';
                    errorMessage = stepResult.message;
                    findings.push({
                        type: 'prompt-issue',
                        severity: stepResult.severity || 'high',
                        title: `Step "${step.id}" failed`,
                        description: stepResult.message,
                        affectedStep: step.id,
                        agentQuestion: userMessage,
                        expectedBehavior: this.getExpectedBehaviorDescription(step),
                        actualBehavior: transcript[transcript.length - 1]?.content || 'No response',
                        recommendation: stepResult.recommendation,
                    });
                    if (stepResult.severity === 'critical') {
                        break;
                    }
                }
                if (step.delay || config_1.config.tests.defaultDelayBetweenSteps) {
                    await this.delay(step.delay || config_1.config.tests.defaultDelayBetweenSteps);
                }
            }
            if (status === 'passed') {
                for (const expectation of testCase.expectations) {
                    if (expectation.validator) {
                        const result = expectation.validator(context);
                        if (!result.passed) {
                            status = 'failed';
                            errorMessage = `Expectation "${expectation.description}" failed: ${result.message}`;
                            findings.push({
                                type: 'bug',
                                severity: 'high',
                                title: `Expectation failed: ${expectation.description}`,
                                description: result.message,
                                recommendation: result.recommendation,
                            });
                        }
                    }
                }
            }
        }
        catch (error) {
            status = 'error';
            errorMessage = error.message;
            findings.push({
                type: 'bug',
                severity: 'critical',
                title: 'Test execution error',
                description: error.message,
            });
        }
        if (testCase.teardown) {
            try {
                await testCase.teardown(context);
            }
            catch (error) {
                // Ignore teardown errors
            }
        }
        const result = {
            runId,
            testId: testCase.id,
            testName: testCase.name,
            category: testCase.category,
            status,
            startedAt: new Date(startTime).toISOString(),
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - startTime,
            errorMessage,
            transcript,
            findings,
        };
        const resultId = this.database.saveTestResult(result);
        if (transcript.length > 0) {
            this.database.saveTranscript(resultId, transcript);
        }
        return result;
    }
    async executeStep(step, context, transcript, runId, testId) {
        const userMessage = typeof step.userMessage === 'function' ? step.userMessage(context) : step.userMessage;
        const userTurn = {
            role: 'user',
            content: userMessage,
            timestamp: new Date().toISOString(),
            stepId: step.id,
        };
        transcript.push(userTurn);
        context.conversationHistory.push(userTurn);
        let response;
        try {
            response = await this.flowiseClient.sendMessage(userMessage);
        }
        catch (error) {
            const errorTurn = {
                role: 'assistant',
                content: `[ERROR: ${error.message}]`,
                timestamp: new Date().toISOString(),
                stepId: step.id,
                validationPassed: false,
                validationMessage: error.message,
            };
            transcript.push(errorTurn);
            context.conversationHistory.push(errorTurn);
            return {
                passed: false,
                message: `API error: ${error.message}`,
                severity: 'critical',
                recommendation: 'Check Flowise API connectivity and configuration',
            };
        }
        const assistantTurn = {
            role: 'assistant',
            content: response.text,
            timestamp: new Date().toISOString(),
            responseTimeMs: response.responseTime,
            stepId: step.id,
        };
        transcript.push(assistantTurn);
        context.conversationHistory.push(assistantTurn);
        if (runId && testId && response.toolCalls && response.toolCalls.length > 0) {
            for (const toolCall of response.toolCalls) {
                const apiCall = {
                    runId,
                    testId,
                    stepId: step.id,
                    toolName: toolCall.toolName,
                    requestPayload: toolCall.input ? JSON.stringify(toolCall.input) : undefined,
                    responsePayload: toolCall.output ? JSON.stringify(toolCall.output) : undefined,
                    status: toolCall.status,
                    durationMs: toolCall.durationMs,
                    timestamp: new Date().toISOString(),
                };
                this.database.saveApiCall(apiCall);
            }
        }
        // Validate response (hybrid: semantic + regex)
        const validation = await this.validateResponse(response.text, step, context, userMessage);
        assistantTurn.validationPassed = validation.passed;
        assistantTurn.validationMessage = validation.message;
        if (step.extractData && validation.passed) {
            const extractedData = step.extractData(response.text, context);
            context.extractedData = { ...context.extractedData, ...extractedData };
        }
        if (step.updateContext && validation.passed) {
            const updates = step.updateContext(response.text, context);
            Object.assign(context, updates);
        }
        return validation;
    }
    /**
     * Extract just the conversational text from a response, excluding JSON payload
     */
    extractAnswerText(response) {
        // Try to match ANSWER: ... PAYLOAD: format
        const answerMatch = response.match(/^ANSWER:\s*([\s\S]*?)(?:\n\s*PAYLOAD:|$)/i);
        if (answerMatch) {
            return answerMatch[1].trim();
        }
        // Handle responses without ANSWER: prefix but with PAYLOAD:
        const payloadIndex = response.indexOf('\nPAYLOAD:');
        if (payloadIndex !== -1) {
            return response.substring(0, payloadIndex).trim();
        }
        // Also check for PAYLOAD: without newline (edge case)
        const payloadIndexAlt = response.indexOf('PAYLOAD:');
        if (payloadIndexAlt !== -1 && payloadIndexAlt > 20) {
            return response.substring(0, payloadIndexAlt).trim();
        }
        // No payload found, return full response
        return response;
    }
    /**
     * Validate a response using hybrid approach (semantic + regex)
     */
    async validateResponse(response, step, context, userMessage) {
        // Extract answer text (exclude JSON payload)
        const textToCheck = this.extractAnswerText(response);
        // FAST PATH: Critical error detection (only check answer text, not JSON payload)
        const criticalPatterns = [
            /\bnull\b|undefined|NaN/i,
            /error|exception|stack trace/i,
            /\[object Object\]/i,
        ];
        for (const pattern of criticalPatterns) {
            if (pattern.test(textToCheck)) {
                return {
                    passed: false,
                    message: `Critical error detected: ${pattern.source}`,
                    severity: 'critical',
                    recommendation: 'Check for programming errors leaking into responses',
                };
            }
        }
        // SEMANTIC PATH: AI-powered evaluation
        if (config_1.config.semanticEvaluation.enabled &&
            config_1.config.semanticEvaluation.mode === 'realtime' &&
            semantic_evaluator_1.semanticEvaluator.isAvailable()) {
            try {
                const evalContext = {
                    stepId: step.id,
                    stepDescription: step.description,
                    userMessage,
                    assistantResponse: response,
                    conversationHistory: context.conversationHistory.map(t => ({
                        role: t.role,
                        content: t.content,
                    })),
                    expectedBehaviors: step.expectedPatterns.map(p => String(p)),
                    unexpectedBehaviors: step.unexpectedPatterns.map(p => String(p)),
                };
                const evaluation = await semantic_evaluator_1.semanticEvaluator.evaluateStep(evalContext);
                return {
                    passed: evaluation.validation.passed,
                    message: evaluation.validation.reasoning,
                    severity: evaluation.validation.severity === 'none'
                        ? undefined
                        : evaluation.validation.severity,
                    recommendation: evaluation.validation.suggestedAction,
                    confidence: evaluation.validation.confidence,
                    semanticEvaluation: evaluation,
                };
            }
            catch (error) {
                console.warn('[TestRunner] Semantic evaluation failed, falling back to regex:', error);
            }
        }
        // FALLBACK: Regex-based validation
        return this.validateWithRegex(response, step, context);
    }
    validateWithRegex(response, step, context) {
        // Extract answer text only (exclude JSON payload)
        const textToCheck = this.extractAnswerText(response);
        for (const pattern of step.unexpectedPatterns) {
            const resolvedPattern = typeof pattern === 'function' ? pattern(context) : pattern;
            const regex = typeof resolvedPattern === 'string'
                ? new RegExp(resolvedPattern, 'i')
                : resolvedPattern;
            if (regex.test(textToCheck)) {
                return {
                    passed: false,
                    message: `Unexpected pattern found: "${resolvedPattern}"`,
                    severity: 'high',
                    recommendation: 'Review chatbot response for unexpected content',
                };
            }
        }
        const missingPatterns = [];
        for (const pattern of step.expectedPatterns) {
            const resolvedPattern = typeof pattern === 'function' ? pattern(context) : pattern;
            const regex = typeof resolvedPattern === 'string'
                ? new RegExp(resolvedPattern, 'i')
                : resolvedPattern;
            if (!regex.test(response)) {
                missingPatterns.push(String(resolvedPattern));
            }
        }
        if (missingPatterns.length > 0) {
            return {
                passed: false,
                message: `Missing expected patterns: ${missingPatterns.join(', ')}`,
                severity: 'medium',
                recommendation: 'Update prompt to ensure expected information is included in responses',
            };
        }
        if (step.validator) {
            return step.validator(response, context);
        }
        return { passed: true, message: 'All validations passed' };
    }
    async initializeContext(testCase) {
        const context = {
            patients: [],
            locations: [],
            providers: [],
            appointmentTypes: [],
            availableSlots: [],
            conversationHistory: [],
            extractedData: {},
        };
        for (const req of testCase.dataRequirements) {
            switch (req.type) {
                case 'patient':
                    context.patients = await this.cloud9Client.getTestPatients();
                    break;
                case 'location':
                    context.locations = await this.cloud9Client.getLocations();
                    break;
                case 'provider':
                    context.providers = await this.cloud9Client.getProviders();
                    break;
                case 'appointmentType':
                    context.appointmentTypes = await this.cloud9Client.getAppointmentTypes();
                    break;
            }
        }
        return context;
    }
    getExpectedBehaviorDescription(step) {
        const patterns = step.expectedPatterns.map(p => String(p)).join(', ');
        return step.description || `Response should match: ${patterns}`;
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.TestRunner = TestRunner;
//# sourceMappingURL=test-runner.js.map