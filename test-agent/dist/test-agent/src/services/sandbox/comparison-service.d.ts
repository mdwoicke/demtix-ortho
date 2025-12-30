/**
 * Sandbox Comparison Service
 *
 * Runs tests against multiple Flowise endpoints (Production, Sandbox A, Sandbox B)
 * and compares results to evaluate which configuration performs better.
 */
import { Database, ABSandboxComparisonRun } from '../../storage/database';
import { SandboxService } from './sandbox-service';
export interface ComparisonRequest {
    /** Test IDs to run (e.g., ['GOAL-HAPPY-001', 'GOAL-EDGE-001']) */
    testIds: string[];
    /** Whether to run against production endpoint */
    runProduction: boolean;
    /** Whether to run against Sandbox A */
    runSandboxA: boolean;
    /** Whether to run against Sandbox B */
    runSandboxB: boolean;
    /** Optional name for the comparison run */
    name?: string;
}
export interface TestComparisonResult {
    testId: string;
    production: {
        passed: boolean;
        turnCount: number;
        durationMs: number;
    } | null;
    sandboxA: {
        passed: boolean;
        turnCount: number;
        durationMs: number;
    } | null;
    sandboxB: {
        passed: boolean;
        turnCount: number;
        durationMs: number;
    } | null;
}
export interface ComparisonResult {
    comparisonId: string;
    status: 'completed' | 'failed';
    testResults: TestComparisonResult[];
    summary: {
        productionPassRate: number;
        sandboxAPassRate: number;
        sandboxBPassRate: number;
        totalTests: number;
        improvements: {
            testId: string;
            from: string;
            to: string;
        }[];
        regressions: {
            testId: string;
            from: string;
            to: string;
        }[];
    };
}
export interface ProgressCallback {
    (progress: {
        stage: 'production' | 'sandboxA' | 'sandboxB';
        testId: string;
        testIndex: number;
        totalTests: number;
        status: 'running' | 'completed' | 'failed';
    }): void;
}
export declare class SandboxComparisonService {
    private db;
    private sandboxService;
    private goalTestsByid;
    constructor(db: Database, sandboxService: SandboxService);
    /**
     * Get available goal tests
     */
    getAvailableTests(): {
        id: string;
        name: string;
        category: string;
    }[];
    /**
     * Start a comparison asynchronously (returns immediately, runs in background)
     * This is the preferred method for API calls to avoid timeout issues
     */
    startComparisonAsync(request: ComparisonRequest): Promise<{
        comparisonId: string;
    }>;
    /**
     * Internal method to run comparison in background
     */
    private runComparisonInBackground;
    /**
     * Run a comparison across endpoints (synchronous - waits for completion)
     * @deprecated Use startComparisonAsync for API calls to avoid timeout issues
     */
    runComparison(request: ComparisonRequest, onProgress?: ProgressCallback): Promise<ComparisonResult>;
    /**
     * Run a single test against all configured endpoints
     * Useful for quick iteration during development
     */
    runSingleTestComparison(testId: string): Promise<ComparisonResult>;
    /**
     * Get a comparison run by ID
     */
    getComparisonRun(comparisonId: string): ABSandboxComparisonRun | null;
    /**
     * Get comparison history
     */
    getComparisonHistory(limit?: number): ABSandboxComparisonRun[];
    /**
     * Calculate summary statistics from test results
     */
    private calculateSummary;
}
//# sourceMappingURL=comparison-service.d.ts.map