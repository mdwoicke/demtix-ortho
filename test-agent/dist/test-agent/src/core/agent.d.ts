/**
 * Main Test Agent Orchestrator
 * Coordinates test execution, analysis, and reporting
 * Supports parallel execution with configurable concurrency
 */
import { EventEmitter } from 'events';
import { Recommendation } from '../analysis/recommendation-engine';
import { TestResult } from '../storage/database';
export interface AgentOptions {
    category?: 'happy-path' | 'edge-case' | 'error-handling';
    scenario?: string;
    scenarioIds?: string[];
    failedOnly?: boolean;
    watch?: boolean;
    concurrency?: number;
}
export interface WorkerStatus {
    workerId: number;
    status: 'idle' | 'running' | 'completed' | 'error';
    currentTestId: string | null;
    currentTestName: string | null;
    startedAt: string | null;
}
export interface ExecutionProgress {
    total: number;
    completed: number;
    passed: number;
    failed: number;
    skipped: number;
}
export interface TestSuiteResult {
    runId: string;
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    results: TestResult[];
}
export declare class TestAgent extends EventEmitter {
    private flowiseClient;
    private cloud9Client;
    private testRunner;
    private analyzer;
    private recommendationEngine;
    private database;
    private consoleReporter;
    private markdownReporter;
    private workerStatuses;
    private progress;
    constructor();
    /**
     * Run the full test suite or filtered tests
     * Supports parallel execution with configurable concurrency
     */
    run(options?: AgentOptions): Promise<TestSuiteResult>;
    /**
     * Run tests sequentially (original behavior)
     */
    private runSequential;
    /**
     * Run tests in parallel using a worker pool
     */
    private runParallel;
    /**
     * Worker function that processes tests from the shared queue
     * Each worker gets its own FlowiseClient and TestRunner to prevent session bleeding
     */
    private runWorker;
    /**
     * Update worker status and emit event
     */
    private updateWorkerStatus;
    /**
     * Emit all worker statuses
     */
    private emitWorkerStatuses;
    /**
     * Update and emit progress
     */
    private updateProgress;
    /**
     * Run only previously failed tests
     */
    runFailed(): Promise<TestSuiteResult>;
    /**
     * Get filtered scenarios based on options
     */
    private getScenarios;
    /**
     * Generate recommendations from test results
     */
    generateRecommendations(results: TestResult[]): Promise<Recommendation[]>;
    /**
     * Get recommendations for display
     */
    getRecommendations(): Recommendation[];
    /**
     * Get results from last run
     */
    getLastResults(): TestResult[];
    /**
     * Get transcript for a specific test
     */
    getTranscript(testId: string, runId?: string): any[];
    /**
     * Generate markdown report
     */
    generateReport(format?: 'markdown' | 'json'): Promise<string>;
    /**
     * Check for regressions compared to previous run
     */
    checkRegressions(): {
        test: string;
        type: string;
        details: string;
    }[];
    /**
     * Initialize database (create tables)
     */
    initialize(): void;
}
//# sourceMappingURL=agent.d.ts.map