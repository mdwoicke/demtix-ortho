"use strict";
/**
 * Goal-Oriented Test Runner
 *
 * Executes goal-oriented tests using dynamic conversation flow.
 * Instead of fixed step sequences, it adapts to what the agent asks
 * and generates appropriate responses from persona inventory.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoalTestRunner = void 0;
exports.createGoalTestRunner = createGoalTestRunner;
const intent_detector_1 = require("../services/intent-detector");
const response_generator_1 = require("../services/response-generator");
const progress_tracker_1 = require("../services/progress-tracker");
const goal_evaluator_1 = require("../services/goal-evaluator");
const data_generator_1 = require("../services/data-generator");
const DEFAULT_CONFIG = {
    maxTurns: 30,
    delayBetweenTurns: 500,
    turnTimeout: 30000,
    saveProgressSnapshots: true,
    continueOnError: true,
};
/**
 * Goal-Oriented Test Runner
 *
 * Executes tests by:
 * 1. Sending initial message to agent
 * 2. Detecting what agent asks for (IntentDetector)
 * 3. Generating appropriate response from persona (ResponseGenerator)
 * 4. Tracking progress toward goals (ProgressTracker)
 * 5. Continuing until goals complete or max turns reached
 * 6. Evaluating final result (GoalEvaluator)
 */
class GoalTestRunner {
    constructor(flowiseClient, database, intentDetector, cfg) {
        this.flowiseClient = flowiseClient;
        this.database = database;
        this.intentDetector = intentDetector;
        this.config = { ...DEFAULT_CONFIG, ...cfg };
    }
    /**
     * Run a goal-oriented test
     * @param testCase The test case to run
     * @param runId The run ID for this test execution
     * @param testIdOverride Optional override for testId (e.g., "GOAL-HAPPY-001#2" for second run)
     */
    async runTest(testCase, runId, testIdOverride) {
        // Use testIdOverride for storage if provided (supports multiple runs of same test)
        const effectiveTestId = testIdOverride || testCase.id;
        const startTime = Date.now();
        const transcript = [];
        // Resolve dynamic fields if present
        let resolvedPersona;
        let personaToUse;
        if ((0, data_generator_1.personaHasDynamicFields)(testCase.persona)) {
            const dataGenerator = new data_generator_1.DataGeneratorService();
            resolvedPersona = dataGenerator.resolvePersona(testCase.persona);
            personaToUse = resolvedPersona.resolved;
            console.log(`[GoalTestRunner] Resolved ${resolvedPersona.metadata.dynamicFields.length} dynamic fields (seed: ${resolvedPersona.metadata.seed})`);
        }
        else {
            personaToUse = testCase.persona;
        }
        // Initialize services for this test using resolved persona
        const responseGenerator = new response_generator_1.ResponseGenerator(personaToUse, {
            useLlm: testCase.responseConfig.useLlmResponses,
        });
        const progressTracker = new progress_tracker_1.ProgressTracker(testCase.goals);
        const goalEvaluator = new goal_evaluator_1.GoalEvaluator();
        // Start new Flowise session
        this.flowiseClient.newSession();
        let turnNumber = 0;
        let lastError;
        try {
            // Resolve initial message (can be string or function)
            const initialMessage = typeof testCase.initialMessage === 'function'
                ? testCase.initialMessage(testCase.persona)
                : testCase.initialMessage;
            // Send initial message
            const initialResponse = await this.sendMessage(initialMessage, transcript, 'initial', runId, testCase.id);
            if (!initialResponse) {
                throw new Error('Failed to get initial response from agent');
            }
            turnNumber = 1;
            // Main conversation loop
            while (!this.shouldStop(progressTracker, turnNumber, testCase)) {
                // Get the last agent response
                const lastAgentTurn = transcript.filter(t => t.role === 'assistant').pop();
                if (!lastAgentTurn)
                    break;
                // Detect what the agent is asking for
                const intentResult = await this.intentDetector.detectIntent(lastAgentTurn.content, transcript, progressTracker.getPendingFields());
                // Check if conversation should end
                if (this.isTerminalIntent(intentResult)) {
                    console.log(`[GoalTestRunner] Terminal intent detected: ${intentResult.primaryIntent}`);
                    // Update progress one more time for terminal intents
                    progressTracker.updateProgress(intentResult, '', turnNumber);
                    break;
                }
                // Generate user response based on intent
                const userResponse = await responseGenerator.generateResponse(intentResult, transcript);
                // Update progress tracker
                progressTracker.updateProgress(intentResult, userResponse, turnNumber);
                // Check for abort conditions
                if (progressTracker.shouldAbort()) {
                    console.log('[GoalTestRunner] Critical issue detected, aborting');
                    break;
                }
                // Send user response to agent
                turnNumber++;
                const agentResponse = await this.sendMessage(userResponse, transcript, `turn-${turnNumber}`, runId, testCase.id);
                if (!agentResponse && !this.config.continueOnError) {
                    throw new Error(`Failed to get response at turn ${turnNumber}`);
                }
                // Save progress snapshot if enabled
                if (this.config.saveProgressSnapshots) {
                    this.saveProgressSnapshot(runId, testCase.id, turnNumber, progressTracker);
                }
                // Delay between turns
                if (this.config.delayBetweenTurns > 0) {
                    await this.delay(this.config.delayBetweenTurns);
                }
            }
        }
        catch (error) {
            lastError = error.message;
            console.error('[GoalTestRunner] Test execution error:', error);
        }
        // Calculate duration
        const durationMs = Date.now() - startTime;
        // Evaluate final result
        const result = goalEvaluator.evaluateTest(testCase, progressTracker.getState(), transcript, durationMs);
        // Save to database (include resolved persona if dynamic fields were used)
        // Use effectiveTestId to ensure multiple runs of same test are stored separately
        this.saveGoalTestResult(runId, effectiveTestId, testCase, result, transcript, lastError, resolvedPersona);
        return result;
    }
    /**
     * Run multiple goal tests
     */
    async runTests(testCases, runId) {
        const results = new Map();
        for (const testCase of testCases) {
            console.log(`\n[GoalTestRunner] Running: ${testCase.id} - ${testCase.name}`);
            const result = await this.runTest(testCase, runId);
            results.set(testCase.id, result);
            console.log(`[GoalTestRunner] ${testCase.id}: ${result.passed ? 'PASSED' : 'FAILED'}`);
            console.log(`  Summary: ${result.summary}`);
        }
        return results;
    }
    /**
     * Send a message to the agent and record transcript
     */
    async sendMessage(message, transcript, stepId, runId, testId) {
        // Record user turn
        const userTurn = {
            role: 'user',
            content: message,
            timestamp: new Date().toISOString(),
            stepId,
        };
        transcript.push(userTurn);
        try {
            // Send to Flowise
            const response = await this.flowiseClient.sendMessage(message);
            // Record assistant turn
            const assistantTurn = {
                role: 'assistant',
                content: response.text,
                timestamp: new Date().toISOString(),
                responseTimeMs: response.responseTime,
                stepId,
            };
            transcript.push(assistantTurn);
            // Save API calls (tool calls)
            if (response.toolCalls && response.toolCalls.length > 0) {
                for (const toolCall of response.toolCalls) {
                    const apiCall = {
                        runId,
                        testId,
                        stepId,
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
            return response;
        }
        catch (error) {
            // Record error turn
            const errorTurn = {
                role: 'assistant',
                content: `[ERROR: ${error.message}]`,
                timestamp: new Date().toISOString(),
                stepId,
                validationPassed: false,
                validationMessage: error.message,
            };
            transcript.push(errorTurn);
            console.error(`[GoalTestRunner] Message send failed:`, error.message);
            return null;
        }
    }
    /**
     * Determine if the test should stop
     */
    shouldStop(tracker, turnNumber, testCase) {
        // Check if all required goals are complete
        if (tracker.areGoalsComplete()) {
            console.log('[GoalTestRunner] All required goals complete');
            return true;
        }
        // Check if any goals have failed
        if (tracker.hasFailedGoals()) {
            console.log('[GoalTestRunner] Goals failed, stopping');
            return true;
        }
        // Check max turns
        const maxTurns = testCase.responseConfig.maxTurns || this.config.maxTurns;
        if (turnNumber >= maxTurns) {
            console.log(`[GoalTestRunner] Max turns (${maxTurns}) reached`);
            return true;
        }
        return false;
    }
    /**
     * Check if intent indicates conversation should end
     */
    isTerminalIntent(intent) {
        const terminalIntents = [
            'saying_goodbye',
            'confirming_booking',
            'initiating_transfer',
        ];
        return (terminalIntents.includes(intent.primaryIntent) ||
            !intent.requiresUserResponse);
    }
    /**
     * Save a progress snapshot
     */
    saveProgressSnapshot(runId, testId, turnNumber, tracker) {
        try {
            const state = tracker.getState();
            this.database.saveGoalProgressSnapshot({
                runId,
                testId,
                turnNumber,
                collectedFieldsJson: JSON.stringify(Array.from(state.collectedFields.entries())),
                pendingFieldsJson: JSON.stringify(state.pendingFields),
                issuesJson: JSON.stringify(state.issues),
            });
        }
        catch (error) {
            console.warn('[GoalTestRunner] Failed to save progress snapshot:', error);
        }
    }
    /**
     * Save goal test result to database
     * @param runId The run ID
     * @param testId The effective test ID (may include #N suffix for multiple runs)
     * @param testCase The original test case definition
     * @param result The test result
     * @param transcript The conversation transcript
     * @param errorMessage Optional error message
     * @param resolvedPersona Optional resolved persona for dynamic tests
     */
    saveGoalTestResult(runId, testId, testCase, result, transcript, errorMessage, resolvedPersona) {
        try {
            // Convert to TestResult format for compatibility
            const findings = [];
            // Add findings from failed goals
            for (const goalResult of result.goalResults) {
                if (!goalResult.passed) {
                    findings.push({
                        type: 'prompt-issue',
                        severity: 'high',
                        title: `Goal failed: ${goalResult.goalId}`,
                        description: goalResult.message,
                        recommendation: goalResult.details?.missing
                            ? `Missing fields: ${goalResult.details.missing.join(', ')}`
                            : 'Review conversation flow',
                    });
                }
            }
            // Add findings from constraint violations
            for (const violation of result.constraintViolations) {
                findings.push({
                    type: violation.constraint.severity === 'critical' ? 'bug' : 'enhancement',
                    severity: violation.constraint.severity === 'critical' ? 'critical' : 'medium',
                    title: `Constraint violated: ${violation.constraint.description}`,
                    description: violation.message,
                    recommendation: 'Review constraint and fix behavior',
                });
            }
            // Add findings from issues
            for (const issue of result.issues) {
                findings.push({
                    type: issue.type === 'error' ? 'bug' : 'prompt-issue',
                    severity: issue.severity,
                    title: `Issue: ${issue.type}`,
                    description: issue.description,
                    affectedStep: `turn-${issue.turnNumber}`,
                });
            }
            const testResult = {
                runId,
                testId, // Use the effective testId (may include #N suffix for multiple runs)
                testName: testCase.name,
                category: testCase.category,
                status: result.passed ? 'passed' : 'failed',
                startedAt: new Date(Date.now() - result.durationMs).toISOString(),
                completedAt: new Date().toISOString(),
                durationMs: result.durationMs,
                errorMessage,
                transcript,
                findings,
            };
            const resultId = this.database.saveTestResult(testResult);
            // Save transcript
            if (transcript.length > 0) {
                this.database.saveTranscript(resultId, transcript);
            }
            // Save goal-specific results (include resolved persona if dynamic fields were used)
            this.database.saveGoalTestResult({
                runId,
                testId, // Use the effective testId (may include #N suffix for multiple runs)
                passed: result.passed ? 1 : 0,
                turnCount: result.turnCount,
                durationMs: result.durationMs,
                startedAt: new Date(Date.now() - result.durationMs).toISOString(),
                completedAt: new Date().toISOString(),
                goalResultsJson: JSON.stringify(result.goalResults),
                constraintViolationsJson: JSON.stringify(result.constraintViolations),
                summaryText: result.summary,
                // Include resolved persona data for debugging/reproducibility
                resolvedPersonaJson: resolvedPersona ? JSON.stringify(resolvedPersona.resolved) : undefined,
                generationSeed: resolvedPersona?.metadata.seed,
            });
        }
        catch (error) {
            console.error('[GoalTestRunner] Failed to save test result:', error);
        }
    }
    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.GoalTestRunner = GoalTestRunner;
/**
 * Factory function to create a GoalTestRunner with default dependencies
 */
function createGoalTestRunner(flowiseClient, database, cfg) {
    const intentDetector = new intent_detector_1.IntentDetector();
    return new GoalTestRunner(flowiseClient, database, intentDetector, cfg);
}
//# sourceMappingURL=goal-test-runner.js.map