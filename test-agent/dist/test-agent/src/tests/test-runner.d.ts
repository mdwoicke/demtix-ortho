/**
 * Test Execution Engine
 * Runs test cases and collects results
 *
 * Enhanced with AI-powered semantic evaluation for better accuracy
 */
import { FlowiseClient } from '../core/flowise-client';
import { Cloud9Client } from '../core/cloud9-client';
import { ResponseAnalyzer } from '../analysis/response-analyzer';
import { Database, TestResult } from '../storage/database';
import { TestCase } from './test-case';
export declare class TestRunner {
    private flowiseClient;
    private cloud9Client;
    private analyzer;
    private database;
    constructor(flowiseClient: FlowiseClient, cloud9Client: Cloud9Client, analyzer: ResponseAnalyzer, database: Database);
    runTest(testCase: TestCase, runId: string): Promise<TestResult>;
    private executeStep;
    /**
     * Extract just the conversational text from a response, excluding JSON payload
     */
    private extractAnswerText;
    /**
     * Validate a response using hybrid approach (semantic + regex)
     */
    private validateResponse;
    private validateWithRegex;
    private initializeContext;
    private getExpectedBehaviorDescription;
    private delay;
}
//# sourceMappingURL=test-runner.d.ts.map