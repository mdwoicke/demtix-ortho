"use strict";
/**
 * Main Test Agent Orchestrator
 * Coordinates test execution, analysis, and reporting
 * Supports parallel execution with configurable concurrency
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestAgent = void 0;
const events_1 = require("events");
const flowise_client_1 = require("./flowise-client");
const cloud9_client_1 = require("./cloud9-client");
const test_runner_1 = require("../tests/test-runner");
const response_analyzer_1 = require("../analysis/response-analyzer");
const recommendation_engine_1 = require("../analysis/recommendation-engine");
const database_1 = require("../storage/database");
const console_reporter_1 = require("../reporters/console-reporter");
const markdown_reporter_1 = require("../reporters/markdown-reporter");
const scenarios_1 = require("../tests/scenarios");
class TestAgent extends events_1.EventEmitter {
    constructor() {
        super();
        // Worker status tracking
        this.workerStatuses = new Map();
        this.progress = {
            total: 0,
            completed: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
        };
        this.flowiseClient = new flowise_client_1.FlowiseClient();
        this.cloud9Client = new cloud9_client_1.Cloud9Client();
        this.analyzer = new response_analyzer_1.ResponseAnalyzer();
        this.recommendationEngine = new recommendation_engine_1.RecommendationEngine();
        this.database = new database_1.Database();
        this.consoleReporter = new console_reporter_1.ConsoleReporter();
        this.markdownReporter = new markdown_reporter_1.MarkdownReporter();
        this.testRunner = new test_runner_1.TestRunner(this.flowiseClient, this.cloud9Client, this.analyzer, this.database);
    }
    /**
     * Run the full test suite or filtered tests
     * Supports parallel execution with configurable concurrency
     */
    async run(options = {}) {
        const concurrency = Math.min(Math.max(options.concurrency || 1, 1), 10);
        console.log('\n=== E2E Test Agent Starting ===\n');
        // Warn about rate limits for high concurrency
        if (concurrency > 3) {
            console.log(`⚠️  WARNING: Running with ${concurrency} workers may trigger API rate limits.`);
            console.log('   Consider using concurrency <= 3 for stable execution.\n');
        }
        if (concurrency > 1) {
            console.log(`🔄 Parallel execution enabled with ${concurrency} workers\n`);
        }
        // Fetch sandbox data
        console.log('Fetching sandbox data...');
        await this.cloud9Client.refreshAllData();
        // Get test scenarios
        let scenarios = this.getScenarios(options);
        console.log(`Found ${scenarios.length} test scenarios to run\n`);
        // Create test run record
        const runId = this.database.createTestRun();
        // Initialize progress tracking
        this.progress = {
            total: scenarios.length,
            completed: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
        };
        // Emit execution started event
        this.emit('execution-started', { runId, config: { concurrency } });
        // Run tests
        const startTime = Date.now();
        let results;
        if (concurrency === 1) {
            // Sequential execution (original behavior)
            results = await this.runSequential(scenarios, runId);
        }
        else {
            // Parallel execution with worker pool
            results = await this.runParallel(scenarios, runId, concurrency);
        }
        const duration = Date.now() - startTime;
        // Calculate summary
        const summary = {
            runId,
            totalTests: results.length,
            passed: results.filter(r => r.status === 'passed').length,
            failed: results.filter(r => r.status === 'failed').length,
            skipped: results.filter(r => r.status === 'skipped').length,
            duration,
            results,
        };
        // Update run record
        this.database.completeTestRun(runId, summary);
        // Emit execution completed event
        this.emit('execution-completed', { runId, summary });
        // Print summary
        this.consoleReporter.printSummary(summary);
        // Analyze and generate recommendations
        const recommendations = await this.generateRecommendations(results);
        if (recommendations.length > 0) {
            this.consoleReporter.printRecommendations(recommendations);
        }
        return summary;
    }
    /**
     * Run tests sequentially (original behavior)
     */
    async runSequential(scenarios, runId) {
        const results = [];
        for (const scenario of scenarios) {
            this.consoleReporter.printTestStart(scenario);
            try {
                const result = await this.testRunner.runTest(scenario, runId);
                results.push(result);
                this.consoleReporter.printTestResult(result);
                // Update progress
                this.updateProgress(result.status);
                // Save transcript
                this.database.saveTranscript(result.id, result.transcript);
            }
            catch (error) {
                const errorResult = {
                    runId,
                    testId: scenario.id,
                    testName: scenario.name,
                    category: scenario.category,
                    status: 'error',
                    startedAt: new Date().toISOString(),
                    completedAt: new Date().toISOString(),
                    durationMs: 0,
                    errorMessage: error.message,
                    transcript: [],
                    findings: [],
                };
                results.push(errorResult);
                this.database.saveTestResult(errorResult);
                this.consoleReporter.printTestResult(errorResult);
                this.updateProgress('failed');
            }
        }
        return results;
    }
    /**
     * Run tests in parallel using a worker pool
     */
    async runParallel(scenarios, runId, concurrency) {
        const results = [];
        const queue = [...scenarios];
        // Initialize workers
        for (let i = 0; i < concurrency; i++) {
            this.workerStatuses.set(i, {
                workerId: i,
                status: 'idle',
                currentTestId: null,
                currentTestName: null,
                startedAt: null,
            });
        }
        // Emit initial worker statuses
        this.emitWorkerStatuses();
        // Create worker promises
        const workerPromises = [];
        for (let workerId = 0; workerId < concurrency; workerId++) {
            workerPromises.push(this.runWorker(workerId, queue, runId));
        }
        // Wait for all workers to complete
        const workerResults = await Promise.all(workerPromises);
        // Flatten results
        for (const workerResult of workerResults) {
            results.push(...workerResult);
        }
        return results;
    }
    /**
     * Worker function that processes tests from the shared queue
     * Each worker gets its own FlowiseClient and TestRunner to prevent session bleeding
     */
    async runWorker(workerId, queue, runId) {
        const results = [];
        // Create per-worker FlowiseClient and TestRunner to ensure session isolation
        const workerFlowiseClient = new flowise_client_1.FlowiseClient();
        const workerTestRunner = new test_runner_1.TestRunner(workerFlowiseClient, this.cloud9Client, // Cloud9Client can be shared (stateless HTTP client)
        this.analyzer, this.database);
        console.log(`[Worker ${workerId}] Initialized with session: ${workerFlowiseClient.getSessionId()}`);
        while (queue.length > 0) {
            // Get next scenario from queue (thread-safe pop)
            const scenario = queue.shift();
            if (!scenario)
                break;
            // Update worker status
            this.updateWorkerStatus(workerId, 'running', scenario.id, scenario.name);
            console.log(`[Worker ${workerId}] Starting: ${scenario.id} - ${scenario.name}`);
            try {
                const result = await workerTestRunner.runTest(scenario, runId);
                results.push(result);
                // Update progress
                this.updateProgress(result.status);
                // Save transcript
                this.database.saveTranscript(result.id, result.transcript);
                const statusIcon = result.status === 'passed' ? '✓' : '✗';
                console.log(`[Worker ${workerId}] ${statusIcon} Completed: ${scenario.id} (${result.durationMs}ms)`);
            }
            catch (error) {
                const errorResult = {
                    runId,
                    testId: scenario.id,
                    testName: scenario.name,
                    category: scenario.category,
                    status: 'error',
                    startedAt: new Date().toISOString(),
                    completedAt: new Date().toISOString(),
                    durationMs: 0,
                    errorMessage: error.message,
                    transcript: [],
                    findings: [],
                };
                results.push(errorResult);
                this.database.saveTestResult(errorResult);
                this.updateProgress('failed');
                console.log(`[Worker ${workerId}] ✗ Error: ${scenario.id} - ${error.message}`);
            }
            // Mark worker as idle
            this.updateWorkerStatus(workerId, 'idle', null, null);
        }
        // Mark worker as completed
        this.updateWorkerStatus(workerId, 'completed', null, null);
        console.log(`[Worker ${workerId}] Finished - no more tests in queue`);
        return results;
    }
    /**
     * Update worker status and emit event
     */
    updateWorkerStatus(workerId, status, testId, testName) {
        const workerStatus = {
            workerId,
            status,
            currentTestId: testId,
            currentTestName: testName,
            startedAt: status === 'running' ? new Date().toISOString() : null,
        };
        this.workerStatuses.set(workerId, workerStatus);
        this.emit('worker-status', workerStatus);
        this.emitWorkerStatuses();
    }
    /**
     * Emit all worker statuses
     */
    emitWorkerStatuses() {
        const statuses = Array.from(this.workerStatuses.values());
        this.emit('workers-update', statuses);
    }
    /**
     * Update and emit progress
     */
    updateProgress(status) {
        this.progress.completed++;
        if (status === 'passed') {
            this.progress.passed++;
        }
        else if (status === 'failed' || status === 'error') {
            this.progress.failed++;
        }
        else if (status === 'skipped') {
            this.progress.skipped++;
        }
        this.emit('progress-update', { ...this.progress });
    }
    /**
     * Run only previously failed tests
     */
    async runFailed() {
        const lastRun = this.database.getLastTestRun();
        if (!lastRun) {
            console.log('No previous test run found.');
            return this.run();
        }
        const failedTests = this.database.getFailedTestIds(lastRun.runId);
        if (failedTests.length === 0) {
            console.log('No failed tests from last run.');
            return {
                runId: '',
                totalTests: 0,
                passed: 0,
                failed: 0,
                skipped: 0,
                duration: 0,
                results: [],
            };
        }
        return this.run({ failedOnly: true });
    }
    /**
     * Get filtered scenarios based on options
     */
    getScenarios(options) {
        let scenarios = [...scenarios_1.allScenarios];
        // Filter by multiple scenario IDs (takes priority)
        if (options.scenarioIds && options.scenarioIds.length > 0) {
            scenarios = scenarios.filter(s => options.scenarioIds.includes(s.id));
            console.log(`Filtered to ${scenarios.length} scenarios by IDs: ${options.scenarioIds.join(', ')}`);
        }
        else if (options.scenario) {
            // Filter by single scenario ID
            scenarios = scenarios.filter(s => s.id === options.scenario);
        }
        if (options.category) {
            scenarios = scenarios.filter(s => s.category === options.category);
        }
        if (options.failedOnly) {
            const lastRun = this.database.getLastTestRun();
            if (lastRun) {
                const failedIds = this.database.getFailedTestIds(lastRun.runId);
                scenarios = scenarios.filter(s => failedIds.includes(s.id));
            }
        }
        return scenarios;
    }
    /**
     * Generate recommendations from test results
     */
    async generateRecommendations(results) {
        const failedResults = results.filter(r => r.status === 'failed' || r.status === 'error');
        if (failedResults.length === 0) {
            return [];
        }
        return this.recommendationEngine.generateFromResults(failedResults);
    }
    /**
     * Get recommendations for display
     */
    getRecommendations() {
        return this.database.getRecommendations();
    }
    /**
     * Get results from last run
     */
    getLastResults() {
        const lastRun = this.database.getLastTestRun();
        if (!lastRun) {
            return [];
        }
        return this.database.getTestResults(lastRun.runId);
    }
    /**
     * Get transcript for a specific test
     */
    getTranscript(testId, runId) {
        return this.database.getTranscript(testId, runId);
    }
    /**
     * Generate markdown report
     */
    async generateReport(format = 'markdown') {
        const lastRun = this.database.getLastTestRun();
        if (!lastRun) {
            return 'No test runs found.';
        }
        const results = this.database.getTestResults(lastRun.runId);
        const recommendations = await this.generateRecommendations(results);
        if (format === 'markdown') {
            return this.markdownReporter.generateReport(lastRun, results, recommendations);
        }
        return JSON.stringify({ run: lastRun, results, recommendations }, null, 2);
    }
    /**
     * Check for regressions compared to previous run
     */
    checkRegressions() {
        const runs = this.database.getRecentRuns(2);
        if (runs.length < 2) {
            return [];
        }
        const [currentRun, previousRun] = runs;
        const currentResults = this.database.getTestResults(currentRun.runId);
        const previousResults = this.database.getTestResults(previousRun.runId);
        const regressions = [];
        for (const current of currentResults) {
            const previous = previousResults.find(p => p.testId === current.testId);
            if (previous && previous.status === 'passed' && current.status === 'failed') {
                regressions.push({
                    test: current.testId,
                    type: 'new-failure',
                    details: `Test "${current.testName}" was passing but now fails: ${current.errorMessage || 'Unknown error'}`,
                });
            }
        }
        return regressions;
    }
    /**
     * Initialize database (create tables)
     */
    initialize() {
        this.database.initialize();
    }
}
exports.TestAgent = TestAgent;
//# sourceMappingURL=agent.js.map