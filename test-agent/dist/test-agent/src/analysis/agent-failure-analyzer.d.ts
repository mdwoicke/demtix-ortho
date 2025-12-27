/**
 * Agent Failure Analyzer
 * Analyzes test failures to determine root cause and generate fixes
 * Uses LLM Analysis Service for deep analysis
 */
import { Database, GeneratedFix, ApiCall } from '../storage/database';
import { ConversationTurn, Finding, ConversationStep } from '../tests/test-case';
export interface FailedTest {
    testId: string;
    testName: string;
    category: string;
    failedStep: ConversationStep;
    errorMessage: string;
    transcript: ConversationTurn[];
    apiCalls: ApiCall[];
    findings: Finding[];
}
export interface AnalyzerOptions {
    useLLM?: boolean;
    maxConcurrent?: number;
    saveToDatabase?: boolean;
}
export interface AnalysisReport {
    runId: string;
    analyzedAt: string;
    totalFailures: number;
    analyzedCount: number;
    generatedFixes: GeneratedFix[];
    summary: {
        promptFixes: number;
        toolFixes: number;
        highConfidenceFixes: number;
        rootCauseBreakdown: Record<string, number>;
    };
}
export declare class AgentFailureAnalyzer {
    private db;
    private llmService;
    constructor(db: Database);
    /**
     * Analyze all failures from a test run
     */
    analyzeRun(runId: string, options?: AnalyzerOptions): Promise<AnalysisReport>;
    /**
     * Analyze a single failed test
     */
    analyzeTest(runId: string, testId: string, options?: AnalyzerOptions): Promise<GeneratedFix[]>;
    private buildFailureContexts;
    private convertToGeneratedFixes;
    private deduplicateFixes;
    /**
     * Merge fixes that semantically overlap (address the same issue)
     * Uses key phrase extraction and similarity scoring
     */
    private mergeOverlappingFixes;
    /**
     * Extract key phrases from a fix description for comparison
     */
    private extractKeyPhrases;
    /**
     * Extract a signature from the code change for comparison
     */
    private extractCodeSignature;
    /**
     * Calculate similarity between two fixes
     * Returns a score from 0 to 1
     */
    private calculateFixSimilarity;
    /**
     * Select the best fix from a group of similar fixes
     * Merges affected tests from all fixes
     */
    private selectBestFix;
    private createEmptyReport;
    /**
     * Get pending fixes for review
     */
    getPendingFixes(runId?: string): GeneratedFix[];
    /**
     * Get all fixes grouped by type
     */
    getFixesByType(runId?: string): {
        prompt: GeneratedFix[];
        tool: GeneratedFix[];
    };
    /**
     * Mark a fix as applied
     */
    markFixApplied(fixId: string): void;
    /**
     * Mark a fix as rejected
     */
    markFixRejected(fixId: string): void;
    /**
     * Record the outcome of an applied fix
     */
    recordFixOutcome(fixId: string, testsBefore: string[], testsAfter: string[], notes?: string): void;
}
//# sourceMappingURL=agent-failure-analyzer.d.ts.map