/**
 * LLM Analysis Service
 * Uses Claude API or CLI to analyze test failures and generate fix recommendations
 */
import { ConversationTurn, Finding } from '../tests/test-case';
import { ApiCall } from '../storage/database';
export interface FailureContext {
    testId: string;
    testName: string;
    stepId: string;
    stepDescription: string;
    expectedPattern: string;
    unexpectedPatterns?: string[];
    transcript: ConversationTurn[];
    apiCalls: ApiCall[];
    errorMessage?: string;
    findings: Finding[];
}
export interface RootCause {
    type: 'prompt-gap' | 'prompt-conflict' | 'tool-bug' | 'tool-missing-default' | 'llm-hallucination' | 'test-issue';
    evidence: string[];
    confidence: number;
    explanation: string;
}
/**
 * Classification of whether the issue is with the bot, test agent, or both
 * Based on the "Golden Rule" from iva-prompt-tuning skill
 */
export interface FixClassification {
    /** Where the issue originates - determines which system to fix */
    issueLocation: 'bot' | 'test-agent' | 'both';
    /** Confidence score from 0-1 */
    confidence: number;
    /** Explanation for the classification */
    reasoning: string;
    /** Would a real user say what the test agent said? */
    userBehaviorRealistic: boolean;
    /** Did the bot respond appropriately to the input? */
    botResponseAppropriate: boolean;
}
export interface PromptFix {
    type: 'prompt';
    fixType: 'add-rule' | 'add-example' | 'clarify-instruction' | 'ban-word' | 'add-phase-step' | 'fix-format-spec';
    targetFile: string;
    location: {
        section: string;
        afterLine?: string;
        replaceLine?: string;
    };
    changeDescription: string;
    changeCode: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    confidence: number;
    reasoning: string;
}
export interface ToolFix {
    type: 'tool';
    fixType: 'add-default' | 'add-validation' | 'fix-parsing' | 'add-error-handling' | 'fix-parameter';
    targetFile: string;
    location: {
        function?: string;
        lineNumber?: number;
        afterLine?: string;
    };
    changeDescription: string;
    changeCode: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    confidence: number;
    reasoning: string;
}
export interface AnalysisResult {
    rootCause: RootCause;
    fixes: (PromptFix | ToolFix)[];
    summary: string;
    /** Classification of bot vs test-agent issue */
    classification?: FixClassification;
}
export declare class LLMAnalysisService {
    private llmProvider;
    private systemPromptContent;
    private schedulingToolContent;
    private patientToolContent;
    constructor();
    private logInitialization;
    private loadSourceFiles;
    /**
     * Check if the service is available (API key or CLI configured)
     */
    isAvailable(): boolean;
    /**
     * Analyze a test failure and generate fix recommendations
     */
    analyzeFailure(context: FailureContext): Promise<AnalysisResult>;
    /**
     * Analyze multiple failures and deduplicate fixes
     */
    analyzeMultipleFailures(contexts: FailureContext[]): Promise<{
        analyses: Map<string, AnalysisResult>;
        deduplicatedFixes: (PromptFix | ToolFix)[];
    }>;
    private buildAnalysisPrompt;
    private parseAnalysisResponse;
    private createFallbackResult;
    private deduplicateFixes;
    /**
     * Generate a quick analysis without full LLM call (for testing/fallback)
     */
    generateRuleBasedAnalysis(context: FailureContext): AnalysisResult;
}
export declare const llmAnalysisService: LLMAnalysisService;
//# sourceMappingURL=llm-analysis-service.d.ts.map