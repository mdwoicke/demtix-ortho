/**
 * Experiment Service for A/B Testing
 *
 * Orchestrates A/B test experiments including lifecycle management,
 * variant selection, and result collection.
 */
import { Database, ABExperimentRun } from '../../storage/database';
import { VariantService } from './variant-service';
import type { CreateExperimentInput, Experiment, VariantSelection, ExperimentAnalysis, ConclusionRecommendation } from './types';
export declare class ExperimentService {
    private db;
    private variantService;
    private statisticsService;
    constructor(db: Database, variantService: VariantService);
    /**
     * Create a new experiment
     */
    createExperiment(input: CreateExperimentInput): Experiment;
    /**
     * Start an experiment
     */
    startExperiment(experimentId: string): void;
    /**
     * Pause an experiment
     */
    pauseExperiment(experimentId: string): void;
    /**
     * Complete an experiment
     */
    completeExperiment(experimentId: string, conclusion?: string): void;
    /**
     * Abort an experiment
     */
    abortExperiment(experimentId: string, reason: string): void;
    /**
     * Select a variant for a test run
     * Uses weighted random selection based on traffic split
     */
    selectVariant(experimentId: string, testId: string): VariantSelection;
    /**
     * Record an experiment run
     */
    recordExperimentRun(run: Omit<ABExperimentRun, 'id'>): number;
    /**
     * Record a test result as an experiment run
     */
    recordTestResult(experimentId: string, runId: string, testId: string, variantSelection: VariantSelection, result: {
        passed: boolean;
        turnCount: number;
        durationMs: number;
        goalCompletionRate: number;
        constraintViolations: number;
        errorOccurred: boolean;
        goalsCompleted?: number;
        goalsTotal?: number;
        issuesDetected?: number;
    }): number;
    /**
     * Get an experiment by ID
     */
    getExperiment(experimentId: string): Experiment | null;
    /**
     * Get active (running) experiments
     */
    getActiveExperiments(): Experiment[];
    /**
     * Get all experiments with optional filters
     */
    getAllExperiments(options?: {
        status?: string;
        limit?: number;
    }): Experiment[];
    /**
     * Get experiments that include a specific test
     */
    getExperimentsForTest(testId: string): Experiment[];
    /**
     * Get experiment statistics and analysis
     */
    getExperimentStats(experimentId: string): ExperimentAnalysis;
    /**
     * Check if an experiment should be concluded
     */
    shouldConcludeExperiment(experimentId: string): ConclusionRecommendation;
    /**
     * Get experiment run counts per variant
     */
    getRunCounts(experimentId: string): {
        variantId: string;
        count: number;
        passCount: number;
    }[];
    /**
     * Adopt the winning variant as the new baseline
     */
    adoptWinner(experimentId: string): Promise<boolean>;
    /**
     * Get summary for display
     */
    getExperimentSummary(experimentId: string): ExperimentSummary;
    private generateExperimentId;
    private mapToExperiment;
}
export interface ExperimentSummary {
    experimentId: string;
    name: string;
    status: string;
    hypothesis: string;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    controlSamples: number;
    treatmentSamples: number;
    minSampleSize: number;
    controlPassRate?: number;
    treatmentPassRate?: number;
    passRateLift?: number;
    pValue?: number;
    isSignificant?: boolean;
    recommendation?: string;
    winningVariantId?: string;
    conclusion?: string;
}
//# sourceMappingURL=experiment-service.d.ts.map