/**
 * Goal-Oriented Test Runner
 *
 * Executes goal-oriented tests using dynamic conversation flow.
 * Instead of fixed step sequences, it adapts to what the agent asks
 * and generates appropriate responses from persona inventory.
 */
import { FlowiseClient } from '../core/flowise-client';
import { Database } from '../storage/database';
import { IntentDetector } from '../services/intent-detector';
import type { GoalOrientedTestCase, GoalTestResult } from './types/goal-test';
/**
 * Configuration for the goal test runner
 */
export interface GoalTestRunnerConfig {
    /** Max turns before aborting (safety limit) */
    maxTurns: number;
    /** Delay between turns in ms */
    delayBetweenTurns: number;
    /** Timeout for a single turn in ms */
    turnTimeout: number;
    /** Whether to save progress snapshots */
    saveProgressSnapshots: boolean;
    /** Whether to continue on non-critical errors */
    continueOnError: boolean;
}
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
export declare class GoalTestRunner {
    private flowiseClient;
    private database;
    private intentDetector;
    private config;
    constructor(flowiseClient: FlowiseClient, database: Database, intentDetector: IntentDetector, cfg?: Partial<GoalTestRunnerConfig>);
    /**
     * Run a goal-oriented test
     * @param testCase The test case to run
     * @param runId The run ID for this test execution
     * @param testIdOverride Optional override for testId (e.g., "GOAL-HAPPY-001#2" for second run)
     */
    runTest(testCase: GoalOrientedTestCase, runId: string, testIdOverride?: string): Promise<GoalTestResult>;
    /**
     * Run multiple goal tests
     */
    runTests(testCases: GoalOrientedTestCase[], runId: string): Promise<Map<string, GoalTestResult>>;
    /**
     * Send a message to the agent and record transcript
     */
    private sendMessage;
    /**
     * Determine if the test should stop
     */
    private shouldStop;
    /**
     * Check if intent indicates conversation should end
     */
    private isTerminalIntent;
    /**
     * Save a progress snapshot
     */
    private saveProgressSnapshot;
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
    private saveGoalTestResult;
    /**
     * Delay helper
     */
    private delay;
}
/**
 * Factory function to create a GoalTestRunner with default dependencies
 */
export declare function createGoalTestRunner(flowiseClient: FlowiseClient, database: Database, cfg?: Partial<GoalTestRunnerConfig>): GoalTestRunner;
//# sourceMappingURL=goal-test-runner.d.ts.map