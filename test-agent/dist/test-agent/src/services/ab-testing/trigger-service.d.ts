/**
 * Trigger Service for A/B Testing
 *
 * Implements selective triggering logic to determine when fixes should be A/B tested.
 * Not every change warrants testing - this service assesses impact and recommends
 * which fixes should go through the A/B testing process.
 */
import { Database, GeneratedFix } from '../../storage/database';
import type { FixImpactAssessment, ABRecommendation } from './types';
export declare class TriggerService {
    private db;
    constructor(db: Database);
    /**
     * Assess whether a fix warrants A/B testing
     * This is the main selective triggering logic
     */
    assessFixImpact(fix: GeneratedFix): FixImpactAssessment;
    /**
     * Generate A/B test recommendation for a fix
     */
    generateABRecommendation(fix: GeneratedFix): ABRecommendation | null;
    /**
     * Generate A/B recommendations for multiple fixes
     */
    generateABRecommendations(fixes: GeneratedFix[]): ABRecommendation[];
    /**
     * Check if pass rate has dropped significantly
     */
    checkPassRateDrop(threshold?: number): PassRateAlert[];
    private isPromptFile;
    private isCorePromptSection;
    private isCriticalToolFunction;
    private isConfigChange;
    private isCosmeticChange;
    private getAffectedFlows;
    private getAffectedFlowsFromFunction;
    private getDefaultTestIds;
    private generateExperimentName;
    private generateHypothesis;
}
export interface PassRateAlert {
    runId: string;
    previousRate: number;
    currentRate: number;
    dropPercentage: number;
    severity: 'high' | 'medium' | 'low';
}
//# sourceMappingURL=trigger-service.d.ts.map