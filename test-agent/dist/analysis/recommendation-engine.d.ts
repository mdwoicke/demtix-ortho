/**
 * Recommendation Engine
 * Generates actionable recommendations from test results
 */
import { TestResult } from '../storage/database';
export interface Recommendation {
    id: string;
    type: 'flowise-prompt' | 'function-tool' | 'node-red' | 'backend';
    priority: number;
    title: string;
    problem: string;
    solution: string;
    affectedTests: string[];
    promptSuggestion?: {
        location: string;
        currentBehavior: string;
        suggestedText: string;
        changeType: 'replace' | 'append' | 'prepend';
    };
    toolSuggestion?: {
        toolName: string;
        issue: string;
        fix: string;
    };
    evidence: {
        testId: string;
        stepId?: string;
        expected: string;
        actual: string;
    }[];
}
export declare class RecommendationEngine {
    private recommendations;
    /**
     * Generate recommendations from test results
     */
    generateFromResults(results: TestResult[]): Recommendation[];
    /**
     * Group similar findings together
     */
    private groupFindings;
    /**
     * Create a grouping key for a finding
     */
    private getFindingGroupKey;
    /**
     * Create a recommendation from a group of findings
     */
    private createRecommendation;
    /**
     * Determine what type of fix is needed
     */
    private determineRecommendationType;
    /**
     * Calculate priority score
     */
    private calculatePriority;
    /**
     * Generate a title for the recommendation
     */
    private generateTitle;
    /**
     * Generate solution text and suggestions
     */
    private generateSolution;
    /**
     * Generate Flowise prompt suggestion
     */
    private generatePromptSuggestion;
    /**
     * Generate function tool suggestion
     */
    private generateToolSuggestion;
    /**
     * Format recommendations for display
     */
    formatForDisplay(recommendations: Recommendation[]): string;
}
//# sourceMappingURL=recommendation-engine.d.ts.map