/**
 * Goal-Oriented Test Runner
 *
 * Executes goal-oriented tests using dynamic conversation flow.
 * Instead of fixed step sequences, it adapts to what the agent asks
 * and generates appropriate responses from persona inventory.
 *
 * Supports A/B experiment context for variant testing.
 */
import { FlowiseClient } from '../core/flowise-client';
import { Database } from '../storage/database';
import { IntentDetector } from '../services/intent-detector';
import { ExperimentService, VariantService } from '../services/ab-testing';
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
 * Options for running a test with A/B experiment context
 */
export interface ExperimentRunOptions {
    /** Experiment ID to run the test under */
    experimentId: string;
    /** Run ID for this test execution */
    runId: string;
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
 *
 * Supports A/B experiment context:
 * - When experimentId is provided, selects a variant
 * - Applies the variant temporarily during test execution
 * - Records experiment run metrics
 * - Rolls back variant after test completion
 */
export declare class GoalTestRunner {
    private flowiseClient;
    private database;
    private intentDetector;
    private config;
    private experimentService;
    private variantService;
    constructor(flowiseClient: FlowiseClient, database: Database, intentDetector: IntentDetector, cfg?: Partial<GoalTestRunnerConfig>);
    /**
     * Set A/B testing services for experiment support
     */
    setABTestingServices(experimentService: ExperimentService, variantService: VariantService): void;
    /**
     * Run a goal-oriented test
     * @param testCase The test case to run
     * @param runId The run ID for this test execution
     * @param testIdOverride Optional override for testId (e.g., "GOAL-HAPPY-001#2" for second run)
     * @param experimentOptions Optional A/B experiment context
     */
    runTest(testCase: GoalOrientedTestCase, runId: string, testIdOverride?: string, experimentOptions?: ExperimentRunOptions): Promise<GoalTestResult>;
    /**
     * Run multiple goal tests
     */
    runTests(testCases: GoalOrientedTestCase[], runId: string): Promise<Map<string, GoalTestResult>>;
    /**
     * Run a test with A/B experiment context
     * This method:
     * 1. Selects a variant from the experiment
     * 2. Applies the variant temporarily
     * 3. Runs the test
     * 4. Records experiment run metrics
     * 5. Rolls back the variant
     */
    private runTestWithExperiment;
    /**
     * Run multiple tests as part of an A/B experiment
     */
    runTestsWithExperiment(testCases: GoalOrientedTestCase[], runId: string, experimentId: string): Promise<Map<string, GoalTestResult>>;
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
     *
     * IMPORTANT: Stop for terminal intents where there's nothing more to do.
     * - saying_goodbye: Conversation ending
     * - confirming_booking: Booking confirmed (success)
     * - initiating_transfer: Bot is transferring to human agent (failure - booking incomplete)
     *
     * Do NOT stop for:
     * - offering_time_slots: User needs to select a time
     * - confirming_information: User needs to confirm
     * - searching_availability: Bot is looking up times
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