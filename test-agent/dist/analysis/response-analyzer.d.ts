/**
 * Response Analyzer
 * Analyzes chatbot responses for issues and quality
 */
import { ConversationTurn, Finding } from '../tests/test-case';
export interface AnalysisResult {
    score: number;
    issues: Issue[];
    suggestions: string[];
}
export interface Issue {
    type: 'missing-context' | 'wrong-step' | 'hallucination' | 'tool-error' | 'timeout' | 'unclear' | 'unhelpful';
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    location?: string;
    suggestion?: string;
}
export declare class ResponseAnalyzer {
    private knownIssuePatterns;
    /**
     * Analyze a single response
     */
    analyzeResponse(response: string, context?: any): AnalysisResult;
    /**
     * Analyze a full conversation transcript
     */
    analyzeConversation(transcript: ConversationTurn[]): AnalysisResult;
    /**
     * Analyze conversation flow for issues
     */
    private analyzeConversationFlow;
    /**
     * Check if two responses are similar (potential repetition)
     */
    private areSimilar;
    /**
     * Check if response has proper greeting
     */
    private hasProperGreeting;
    /**
     * Get score penalty for severity level
     */
    private getSeverityPenalty;
    /**
     * Detect specific issues from failed tests
     */
    detectIssuesFromFailures(findings: Finding[]): Issue[];
    private mapFindingTypeToIssueType;
}
//# sourceMappingURL=response-analyzer.d.ts.map