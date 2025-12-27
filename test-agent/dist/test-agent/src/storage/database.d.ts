/**
 * SQLite Database for Test Results
 * Stores test runs, results, transcripts, findings, and recommendations
 */
import { ConversationTurn, Finding } from '../tests/test-case';
import { Recommendation } from '../analysis/recommendation-engine';
export interface TestRun {
    runId: string;
    startedAt: string;
    completedAt?: string;
    status: 'running' | 'completed' | 'failed' | 'aborted';
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    summary?: string;
}
export interface TestResult {
    id?: number;
    runId: string;
    testId: string;
    testName: string;
    category: string;
    status: 'passed' | 'failed' | 'error' | 'skipped';
    startedAt: string;
    completedAt: string;
    durationMs: number;
    errorMessage?: string;
    transcript: ConversationTurn[];
    findings: Finding[];
}
export interface ApiCall {
    id?: number;
    runId: string;
    testId: string;
    stepId?: string;
    toolName: string;
    requestPayload?: string;
    responsePayload?: string;
    status?: string;
    durationMs?: number;
    timestamp: string;
}
export interface FixClassification {
    issueLocation: 'bot' | 'test-agent' | 'both';
    confidence: number;
    reasoning: string;
    userBehaviorRealistic: boolean;
    botResponseAppropriate: boolean;
}
export interface GeneratedFix {
    fixId: string;
    runId: string;
    type: 'prompt' | 'tool';
    targetFile: string;
    changeDescription: string;
    changeCode: string;
    location?: {
        section?: string;
        function?: string;
        lineNumber?: number;
        afterLine?: string;
    };
    priority: 'critical' | 'high' | 'medium' | 'low';
    confidence: number;
    affectedTests: string[];
    rootCause?: {
        type: string;
        evidence: string[];
    };
    classification?: FixClassification;
    status: 'pending' | 'applied' | 'rejected' | 'verified';
    createdAt: string;
}
export interface FixOutcome {
    id?: number;
    fixId: string;
    appliedAt: string;
    testsBefore: string[];
    testsAfter: string[];
    effective: boolean;
    notes?: string;
}
export interface PromptVersion {
    id?: number;
    version: string;
    contentHash: string;
    changesFromPrevious?: string;
    testPassRate?: number;
    capturedAt: string;
}
export interface GoalTestResultRecord {
    id?: number;
    runId: string;
    testId: string;
    passed: number;
    turnCount: number;
    durationMs: number;
    startedAt: string;
    completedAt: string;
    goalResultsJson?: string;
    constraintViolationsJson?: string;
    summaryText?: string;
    resolvedPersonaJson?: string;
    generationSeed?: number;
}
export interface GoalProgressSnapshot {
    id?: number;
    runId: string;
    testId: string;
    turnNumber: number;
    collectedFieldsJson: string;
    pendingFieldsJson: string;
    issuesJson: string;
}
export interface TestCaseStepDTO {
    id: string;
    description?: string;
    userMessage: string;
    expectedPatterns: string[];
    unexpectedPatterns: string[];
    semanticExpectations: SemanticExpectationDTO[];
    negativeExpectations: NegativeExpectationDTO[];
    timeout?: number;
    delay?: number;
    optional?: boolean;
}
export interface SemanticExpectationDTO {
    type: string;
    description: string;
    customCriteria?: string;
    required: boolean;
}
export interface NegativeExpectationDTO {
    type: string;
    description: string;
    customCriteria?: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
}
export interface ExpectationDTO {
    type: 'conversation-complete' | 'final-state' | 'no-errors' | 'custom';
    description: string;
}
export interface TestCaseRecord {
    id?: number;
    caseId: string;
    name: string;
    description: string;
    category: 'happy-path' | 'edge-case' | 'error-handling';
    tags: string[];
    steps: TestCaseStepDTO[];
    expectations: ExpectationDTO[];
    isArchived: boolean;
    version: number;
    createdAt: string;
    updatedAt: string;
}
export declare class Database {
    private db;
    private dbPath;
    constructor();
    /**
     * Initialize database and create tables
     */
    initialize(): void;
    /**
     * Get database connection (initialize if needed)
     */
    private getDb;
    /**
     * Create database tables
     */
    private createTables;
    /**
     * Add a column to a table if it doesn't exist (migration helper)
     */
    private addColumnIfNotExists;
    /**
     * Create a new test run
     */
    createTestRun(): string;
    /**
     * Complete a test run
     */
    completeTestRun(runId: string, summary: {
        totalTests: number;
        passed: number;
        failed: number;
        skipped: number;
    }): void;
    /**
     * Save a test result
     */
    saveTestResult(result: TestResult): number;
    /**
     * Save transcript for a test
     */
    saveTranscript(resultId: number, transcript: ConversationTurn[]): void;
    /**
     * Save a finding
     */
    saveFinding(runId: string, testId: string, finding: Finding): void;
    /**
     * Save recommendations
     */
    saveRecommendations(runId: string, recommendations: Recommendation[]): void;
    /**
     * Get the last test run
     */
    getLastTestRun(): TestRun | null;
    /**
     * Get recent runs
     */
    getRecentRuns(limit?: number): TestRun[];
    /**
     * Get test results for a run
     */
    getTestResults(runId: string): TestResult[];
    /**
     * Get failed test IDs from a run
     */
    getFailedTestIds(runId: string): string[];
    /**
     * Get transcript for a test
     */
    getTranscript(testId: string, runId?: string): ConversationTurn[];
    /**
     * Get recommendations
     */
    getRecommendations(runId?: string): Recommendation[];
    /**
     * Save an API call
     */
    saveApiCall(apiCall: ApiCall): void;
    /**
     * Save multiple API calls
     */
    saveApiCalls(apiCalls: ApiCall[]): void;
    /**
     * Get API calls for a test
     */
    getApiCalls(testId: string, runId?: string): ApiCall[];
    /**
     * Get all API calls for a run
     */
    getApiCallsByRun(runId: string): ApiCall[];
    /**
     * Get all test runs with pagination
     */
    getAllTestRuns(limit?: number, offset?: number): TestRun[];
    /**
     * Get a single test run by ID
     */
    getTestRun(runId: string): TestRun | null;
    /**
     * Get findings for a run or all findings
     */
    getFindings(runId?: string): (Finding & {
        id?: number;
    })[];
    /**
     * Save a generated fix
     */
    saveGeneratedFix(fix: GeneratedFix): void;
    /**
     * Save multiple generated fixes
     */
    saveGeneratedFixes(fixes: GeneratedFix[]): void;
    /**
     * Get generated fixes for a run
     */
    getGeneratedFixes(runId?: string, status?: string): GeneratedFix[];
    /**
     * Get a single fix by ID
     */
    getGeneratedFix(fixId: string): GeneratedFix | null;
    /**
     * Update fix status
     */
    updateFixStatus(fixId: string, status: GeneratedFix['status']): void;
    /**
     * Save a fix outcome
     */
    saveFixOutcome(outcome: FixOutcome): void;
    /**
     * Get fix outcomes for a fix
     */
    getFixOutcomes(fixId: string): FixOutcome[];
    /**
     * Save a prompt version
     */
    savePromptVersion(version: PromptVersion): void;
    /**
     * Get latest prompt version
     */
    getLatestPromptVersion(): PromptVersion | null;
    /**
     * Get prompt version history
     */
    getPromptVersionHistory(limit?: number): PromptVersion[];
    /**
     * Get pending fixes count
     */
    getPendingFixesCount(): number;
    /**
     * Get fix statistics
     */
    getFixStatistics(): {
        total: number;
        pending: number;
        applied: number;
        verified: number;
        rejected: number;
    };
    /**
     * Clear all data
     */
    clear(): void;
    /**
     * Get all test cases (optionally filtered)
     */
    getTestCases(options?: {
        category?: string;
        includeArchived?: boolean;
    }): TestCaseRecord[];
    /**
     * Get a single test case by ID
     */
    getTestCase(caseId: string): TestCaseRecord | null;
    /**
     * Create a new test case
     */
    createTestCase(testCase: Omit<TestCaseRecord, 'id' | 'version' | 'createdAt' | 'updatedAt'>): TestCaseRecord;
    /**
     * Update an existing test case
     */
    updateTestCase(caseId: string, updates: Partial<Omit<TestCaseRecord, 'id' | 'caseId' | 'createdAt'>>): TestCaseRecord | null;
    /**
     * Archive a test case (soft delete)
     */
    archiveTestCase(caseId: string): boolean;
    /**
     * Permanently delete a test case
     */
    deleteTestCase(caseId: string): boolean;
    /**
     * Clone a test case with a new ID
     */
    cloneTestCase(caseId: string, newCaseId: string): TestCaseRecord | null;
    /**
     * Get test case statistics
     */
    getTestCaseStats(): {
        total: number;
        byCategory: Record<string, number>;
        archived: number;
    };
    /**
     * Get all unique tags from test cases
     */
    getAllTags(): string[];
    /**
     * Check if a test case ID exists
     */
    testCaseExists(caseId: string): boolean;
    /**
     * Generate the next available case ID for a category
     */
    generateNextCaseId(category: 'happy-path' | 'edge-case' | 'error-handling'): string;
    /**
     * Save a goal test result
     */
    saveGoalTestResult(result: GoalTestResultRecord): number;
    /**
     * Get goal test results for a run
     */
    getGoalTestResults(runId: string): GoalTestResultRecord[];
    /**
     * Get a single goal test result
     */
    getGoalTestResult(runId: string, testId: string): GoalTestResultRecord | null;
    /**
     * Save a goal progress snapshot
     */
    saveGoalProgressSnapshot(snapshot: GoalProgressSnapshot): void;
    /**
     * Get progress snapshots for a test
     */
    getGoalProgressSnapshots(runId: string, testId: string): GoalProgressSnapshot[];
    /**
     * Get goal test statistics
     */
    getGoalTestStats(runId?: string): {
        total: number;
        passed: number;
        failed: number;
        avgTurns: number;
    };
    /**
     * Delete goal test data for a run
     */
    deleteGoalTestData(runId: string): void;
    /**
     * Close database connection
     */
    close(): void;
}
//# sourceMappingURL=database.d.ts.map