/**
 * Console Reporter
 * Displays test results in the terminal with colors
 */
import { TestCase } from '../tests/test-case';
import { TestResult } from '../storage/database';
import { Recommendation } from '../analysis/recommendation-engine';
export declare class ConsoleReporter {
    /**
     * Print test start
     */
    printTestStart(testCase: TestCase): void;
    /**
     * Print test result
     */
    printTestResult(result: TestResult): void;
    /**
     * Print test suite summary
     */
    printSummary(summary: {
        runId: string;
        totalTests: number;
        passed: number;
        failed: number;
        skipped: number;
        duration: number;
    }): void;
    /**
     * Print recommendations
     */
    printRecommendations(recommendations: Recommendation[]): void;
    /**
     * Print transcript
     */
    printTranscript(testId: string, transcript: {
        role: string;
        content: string;
        timestamp: string;
        responseTimeMs?: number;
    }[]): void;
    /**
     * Print progress during test run
     */
    printProgress(current: number, total: number, testId: string): void;
    /**
     * Print error
     */
    printError(message: string): void;
    /**
     * Print info
     */
    printInfo(message: string): void;
    /**
     * Print success
     */
    printSuccess(message: string): void;
    private getStatusIcon;
    private getStatusColor;
}
//# sourceMappingURL=console-reporter.d.ts.map