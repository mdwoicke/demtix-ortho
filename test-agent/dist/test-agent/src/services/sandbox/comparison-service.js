"use strict";
/**
 * Sandbox Comparison Service
 *
 * Runs tests against multiple Flowise endpoints (Production, Sandbox A, Sandbox B)
 * and compares results to evaluate which configuration performs better.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SandboxComparisonService = void 0;
const uuid_1 = require("uuid");
const flowise_client_1 = require("../../core/flowise-client");
const goal_test_runner_1 = require("../../tests/goal-test-runner");
// Import goal test scenarios
const goal_happy_path_1 = require("../../tests/scenarios/goal-happy-path");
class SandboxComparisonService {
    constructor(db, sandboxService) {
        this.db = db;
        this.sandboxService = sandboxService;
        // Build lookup map for goal tests
        this.goalTestsByid = new Map();
        for (const test of goal_happy_path_1.goalHappyPathScenarios) {
            this.goalTestsByid.set(test.id, test);
        }
        // Note: Database-loaded tests would be added here if needed
    }
    /**
     * Get available goal tests
     */
    getAvailableTests() {
        return Array.from(this.goalTestsByid.values()).map(t => ({
            id: t.id,
            name: t.name,
            category: t.category,
        }));
    }
    /**
     * Start a comparison asynchronously (returns immediately, runs in background)
     * This is the preferred method for API calls to avoid timeout issues
     */
    async startComparisonAsync(request) {
        const comparisonId = `CMP-${new Date().toISOString().split('T')[0]}-${(0, uuid_1.v4)().substring(0, 8)}`;
        const now = new Date().toISOString();
        // Validate test IDs first
        const testCases = [];
        for (const testId of request.testIds) {
            const testCase = this.goalTestsByid.get(testId);
            if (!testCase) {
                console.warn(`[ComparisonService] Test not found: ${testId}`);
                continue;
            }
            testCases.push(testCase);
        }
        if (testCases.length === 0) {
            throw new Error('No valid test cases found');
        }
        // Create comparison run record with 'running' status
        this.db.createComparisonRun({
            comparisonId,
            name: request.name || `Comparison ${comparisonId}`,
            status: 'running',
            testIds: request.testIds,
            startedAt: now,
        });
        // Run the comparison in the background (don't await)
        this.runComparisonInBackground(comparisonId, request, testCases).catch(error => {
            console.error(`[ComparisonService] Background comparison ${comparisonId} failed:`, error);
        });
        // Return immediately with the comparison ID
        return { comparisonId };
    }
    /**
     * Internal method to run comparison in background
     */
    async runComparisonInBackground(comparisonId, request, testCases) {
        const productionResults = {};
        const sandboxAResults = {};
        const sandboxBResults = {};
        const testResults = [];
        try {
            // Run production tests
            if (request.runProduction) {
                console.log(`[ComparisonService] ${comparisonId} - Running production tests...`);
                const prodClient = flowise_client_1.FlowiseClient.forProduction();
                const prodRunner = (0, goal_test_runner_1.createGoalTestRunner)(prodClient, this.db);
                for (let i = 0; i < testCases.length; i++) {
                    const testCase = testCases[i];
                    const runId = `${comparisonId}-prod`;
                    const result = await prodRunner.runTest(testCase, runId);
                    productionResults[testCase.id] = result;
                }
            }
            // Run Sandbox A tests
            if (request.runSandboxA) {
                const sandboxA = this.sandboxService.getSandbox('sandbox_a');
                if (sandboxA?.flowiseEndpoint) {
                    console.log(`[ComparisonService] ${comparisonId} - Running Sandbox A tests...`);
                    const sandboxAClient = flowise_client_1.FlowiseClient.forSandbox(sandboxA.flowiseEndpoint);
                    const sandboxARunner = (0, goal_test_runner_1.createGoalTestRunner)(sandboxAClient, this.db);
                    for (let i = 0; i < testCases.length; i++) {
                        const testCase = testCases[i];
                        const runId = `${comparisonId}-sandboxA`;
                        const result = await sandboxARunner.runTest(testCase, runId);
                        sandboxAResults[testCase.id] = result;
                    }
                }
            }
            // Run Sandbox B tests
            if (request.runSandboxB) {
                const sandboxB = this.sandboxService.getSandbox('sandbox_b');
                if (sandboxB?.flowiseEndpoint) {
                    console.log(`[ComparisonService] ${comparisonId} - Running Sandbox B tests...`);
                    const sandboxBClient = flowise_client_1.FlowiseClient.forSandbox(sandboxB.flowiseEndpoint);
                    const sandboxBRunner = (0, goal_test_runner_1.createGoalTestRunner)(sandboxBClient, this.db);
                    for (let i = 0; i < testCases.length; i++) {
                        const testCase = testCases[i];
                        const runId = `${comparisonId}-sandboxB`;
                        const result = await sandboxBRunner.runTest(testCase, runId);
                        sandboxBResults[testCase.id] = result;
                    }
                }
            }
            // Aggregate results
            for (const testCase of testCases) {
                const prodResult = productionResults[testCase.id];
                const sandboxAResult = sandboxAResults[testCase.id];
                const sandboxBResult = sandboxBResults[testCase.id];
                testResults.push({
                    testId: testCase.id,
                    production: prodResult ? {
                        passed: prodResult.passed,
                        turnCount: prodResult.turnCount,
                        durationMs: prodResult.durationMs,
                    } : null,
                    sandboxA: sandboxAResult ? {
                        passed: sandboxAResult.passed,
                        turnCount: sandboxAResult.turnCount,
                        durationMs: sandboxAResult.durationMs,
                    } : null,
                    sandboxB: sandboxBResult ? {
                        passed: sandboxBResult.passed,
                        turnCount: sandboxBResult.turnCount,
                        durationMs: sandboxBResult.durationMs,
                    } : null,
                });
            }
            // Calculate summary
            const summary = this.calculateSummary(testResults);
            // Update comparison run with results
            this.db.updateComparisonRun(comparisonId, {
                status: 'completed',
                productionResults: productionResults,
                sandboxAResults: sandboxAResults,
                sandboxBResults: sandboxBResults,
                summary,
                completedAt: new Date().toISOString(),
            });
            console.log(`[ComparisonService] ${comparisonId} - Completed successfully`);
        }
        catch (error) {
            console.error(`[ComparisonService] ${comparisonId} - Failed:`, error);
            this.db.updateComparisonRun(comparisonId, {
                status: 'failed',
                completedAt: new Date().toISOString(),
            });
        }
    }
    /**
     * Run a comparison across endpoints (synchronous - waits for completion)
     * @deprecated Use startComparisonAsync for API calls to avoid timeout issues
     */
    async runComparison(request, onProgress) {
        const comparisonId = `CMP-${new Date().toISOString().split('T')[0]}-${(0, uuid_1.v4)().substring(0, 8)}`;
        const now = new Date().toISOString();
        // Create comparison run record
        this.db.createComparisonRun({
            comparisonId,
            name: request.name || `Comparison ${comparisonId}`,
            status: 'running',
            testIds: request.testIds,
            startedAt: now,
        });
        // Validate test IDs
        const testCases = [];
        for (const testId of request.testIds) {
            const testCase = this.goalTestsByid.get(testId);
            if (!testCase) {
                console.warn(`[ComparisonService] Test not found: ${testId}`);
                continue;
            }
            testCases.push(testCase);
        }
        if (testCases.length === 0) {
            this.db.updateComparisonRun(comparisonId, {
                status: 'failed',
                completedAt: new Date().toISOString(),
            });
            throw new Error('No valid test cases found');
        }
        const testResults = [];
        const productionResults = {};
        const sandboxAResults = {};
        const sandboxBResults = {};
        try {
            // Run production tests
            if (request.runProduction) {
                console.log('[ComparisonService] Running production tests...');
                const prodClient = flowise_client_1.FlowiseClient.forProduction();
                const prodRunner = (0, goal_test_runner_1.createGoalTestRunner)(prodClient, this.db);
                for (let i = 0; i < testCases.length; i++) {
                    const testCase = testCases[i];
                    onProgress?.({
                        stage: 'production',
                        testId: testCase.id,
                        testIndex: i,
                        totalTests: testCases.length,
                        status: 'running',
                    });
                    const runId = `${comparisonId}-prod`;
                    const result = await prodRunner.runTest(testCase, runId);
                    productionResults[testCase.id] = result;
                    onProgress?.({
                        stage: 'production',
                        testId: testCase.id,
                        testIndex: i,
                        totalTests: testCases.length,
                        status: 'completed',
                    });
                }
            }
            // Run Sandbox A tests
            if (request.runSandboxA) {
                const sandboxA = this.sandboxService.getSandbox('sandbox_a');
                if (sandboxA?.flowiseEndpoint) {
                    console.log('[ComparisonService] Running Sandbox A tests...');
                    const sandboxAClient = flowise_client_1.FlowiseClient.forSandbox(sandboxA.flowiseEndpoint);
                    const sandboxARunner = (0, goal_test_runner_1.createGoalTestRunner)(sandboxAClient, this.db);
                    for (let i = 0; i < testCases.length; i++) {
                        const testCase = testCases[i];
                        onProgress?.({
                            stage: 'sandboxA',
                            testId: testCase.id,
                            testIndex: i,
                            totalTests: testCases.length,
                            status: 'running',
                        });
                        const runId = `${comparisonId}-sandboxA`;
                        const result = await sandboxARunner.runTest(testCase, runId);
                        sandboxAResults[testCase.id] = result;
                        onProgress?.({
                            stage: 'sandboxA',
                            testId: testCase.id,
                            testIndex: i,
                            totalTests: testCases.length,
                            status: 'completed',
                        });
                    }
                }
                else {
                    console.warn('[ComparisonService] Sandbox A has no endpoint configured');
                }
            }
            // Run Sandbox B tests
            if (request.runSandboxB) {
                const sandboxB = this.sandboxService.getSandbox('sandbox_b');
                if (sandboxB?.flowiseEndpoint) {
                    console.log('[ComparisonService] Running Sandbox B tests...');
                    const sandboxBClient = flowise_client_1.FlowiseClient.forSandbox(sandboxB.flowiseEndpoint);
                    const sandboxBRunner = (0, goal_test_runner_1.createGoalTestRunner)(sandboxBClient, this.db);
                    for (let i = 0; i < testCases.length; i++) {
                        const testCase = testCases[i];
                        onProgress?.({
                            stage: 'sandboxB',
                            testId: testCase.id,
                            testIndex: i,
                            totalTests: testCases.length,
                            status: 'running',
                        });
                        const runId = `${comparisonId}-sandboxB`;
                        const result = await sandboxBRunner.runTest(testCase, runId);
                        sandboxBResults[testCase.id] = result;
                        onProgress?.({
                            stage: 'sandboxB',
                            testId: testCase.id,
                            testIndex: i,
                            totalTests: testCases.length,
                            status: 'completed',
                        });
                    }
                }
                else {
                    console.warn('[ComparisonService] Sandbox B has no endpoint configured');
                }
            }
            // Aggregate results
            for (const testCase of testCases) {
                const prodResult = productionResults[testCase.id];
                const sandboxAResult = sandboxAResults[testCase.id];
                const sandboxBResult = sandboxBResults[testCase.id];
                testResults.push({
                    testId: testCase.id,
                    production: prodResult ? {
                        passed: prodResult.passed,
                        turnCount: prodResult.turnCount,
                        durationMs: prodResult.durationMs,
                    } : null,
                    sandboxA: sandboxAResult ? {
                        passed: sandboxAResult.passed,
                        turnCount: sandboxAResult.turnCount,
                        durationMs: sandboxAResult.durationMs,
                    } : null,
                    sandboxB: sandboxBResult ? {
                        passed: sandboxBResult.passed,
                        turnCount: sandboxBResult.turnCount,
                        durationMs: sandboxBResult.durationMs,
                    } : null,
                });
            }
            // Calculate summary
            const summary = this.calculateSummary(testResults);
            // Update comparison run with results
            this.db.updateComparisonRun(comparisonId, {
                status: 'completed',
                productionResults: productionResults,
                sandboxAResults: sandboxAResults,
                sandboxBResults: sandboxBResults,
                summary,
                completedAt: new Date().toISOString(),
            });
            return {
                comparisonId,
                status: 'completed',
                testResults,
                summary,
            };
        }
        catch (error) {
            console.error('[ComparisonService] Comparison failed:', error);
            this.db.updateComparisonRun(comparisonId, {
                status: 'failed',
                completedAt: new Date().toISOString(),
            });
            throw error;
        }
    }
    /**
     * Run a single test against all configured endpoints
     * Useful for quick iteration during development
     */
    async runSingleTestComparison(testId) {
        return this.runComparison({
            testIds: [testId],
            runProduction: true,
            runSandboxA: true,
            runSandboxB: true,
            name: `Quick test: ${testId}`,
        });
    }
    /**
     * Get a comparison run by ID
     */
    getComparisonRun(comparisonId) {
        return this.db.getComparisonRun(comparisonId);
    }
    /**
     * Get comparison history
     */
    getComparisonHistory(limit = 20) {
        return this.db.getComparisonRunHistory(limit);
    }
    /**
     * Calculate summary statistics from test results
     */
    calculateSummary(testResults) {
        let prodPassed = 0, prodTotal = 0;
        let sandboxAPassed = 0, sandboxATotal = 0;
        let sandboxBPassed = 0, sandboxBTotal = 0;
        const improvements = [];
        const regressions = [];
        for (const result of testResults) {
            // Production stats
            if (result.production !== null) {
                prodTotal++;
                if (result.production.passed)
                    prodPassed++;
            }
            // Sandbox A stats
            if (result.sandboxA !== null) {
                sandboxATotal++;
                if (result.sandboxA.passed)
                    sandboxAPassed++;
                // Compare to production
                if (result.production !== null) {
                    if (!result.production.passed && result.sandboxA.passed) {
                        improvements.push({ testId: result.testId, from: 'Production', to: 'Sandbox A' });
                    }
                    else if (result.production.passed && !result.sandboxA.passed) {
                        regressions.push({ testId: result.testId, from: 'Sandbox A', to: 'Production' });
                    }
                }
            }
            // Sandbox B stats
            if (result.sandboxB !== null) {
                sandboxBTotal++;
                if (result.sandboxB.passed)
                    sandboxBPassed++;
                // Compare to production
                if (result.production !== null) {
                    if (!result.production.passed && result.sandboxB.passed) {
                        improvements.push({ testId: result.testId, from: 'Production', to: 'Sandbox B' });
                    }
                    else if (result.production.passed && !result.sandboxB.passed) {
                        regressions.push({ testId: result.testId, from: 'Sandbox B', to: 'Production' });
                    }
                }
            }
        }
        return {
            productionPassRate: prodTotal > 0 ? (prodPassed / prodTotal) * 100 : 0,
            sandboxAPassRate: sandboxATotal > 0 ? (sandboxAPassed / sandboxATotal) * 100 : 0,
            sandboxBPassRate: sandboxBTotal > 0 ? (sandboxBPassed / sandboxBTotal) * 100 : 0,
            totalTests: testResults.length,
            improvements,
            regressions,
        };
    }
}
exports.SandboxComparisonService = SandboxComparisonService;
//# sourceMappingURL=comparison-service.js.map