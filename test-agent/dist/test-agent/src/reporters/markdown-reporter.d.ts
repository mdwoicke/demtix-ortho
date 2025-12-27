/**
 * Markdown Reporter
 * Generates detailed markdown reports from test results
 */
import { TestRun, TestResult } from '../storage/database';
import { Recommendation } from '../analysis/recommendation-engine';
export declare class MarkdownReporter {
    /**
     * Generate a complete markdown report
     */
    generateReport(run: TestRun, results: TestResult[], recommendations: Recommendation[]): string;
    /**
     * Save report to file
     */
    saveReport(content: string, filename?: string): string;
    /**
     * Generate transcript markdown
     */
    generateTranscriptMarkdown(testId: string, transcript: {
        role: string;
        content: string;
        timestamp: string;
        responseTimeMs?: number;
    }[]): string;
    private formatDuration;
    private formatCategory;
    private getStatusEmoji;
}
//# sourceMappingURL=markdown-reporter.d.ts.map