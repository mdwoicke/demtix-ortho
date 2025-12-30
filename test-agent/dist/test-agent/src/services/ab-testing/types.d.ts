/**
 * A/B Testing Framework Types
 *
 * Defines interfaces for variants, experiments, metrics, and statistical analysis
 */
import { GeneratedFix } from '../../storage/database';
export type VariantType = 'prompt' | 'tool' | 'config';
export type VariantCreator = 'manual' | 'llm-analysis' | 'auto-generated';
/**
 * A variant represents a versioned copy of a prompt, tool, or config
 * that can be tested against other variants
 */
export interface Variant {
    variantId: string;
    variantType: VariantType;
    targetFile: string;
    name: string;
    description: string;
    content: string;
    contentHash: string;
    baselineVariantId?: string;
    sourceFixId?: string;
    isBaseline: boolean;
    createdAt: string;
    createdBy: VariantCreator;
    metadata?: VariantMetadata;
}
export interface VariantMetadata {
    section?: string;
    changeType?: string;
    function?: string;
    parameters?: Record<string, any>;
    rootCause?: string;
    confidence?: number;
}
export interface CreateVariantInput {
    variantType: VariantType;
    targetFile: string;
    name: string;
    description: string;
    content: string;
    baselineVariantId?: string;
    sourceFixId?: string;
    createdBy?: VariantCreator;
    metadata?: VariantMetadata;
}
export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'aborted';
export type ExperimentType = 'prompt' | 'tool' | 'config' | 'multi';
export type VariantRole = 'control' | 'treatment';
/**
 * An experiment defines which variants to test and how
 */
export interface Experiment {
    experimentId: string;
    name: string;
    description?: string;
    hypothesis: string;
    status: ExperimentStatus;
    experimentType: ExperimentType;
    variants: ExperimentVariant[];
    testIds: string[];
    trafficSplit: Record<string, number>;
    minSampleSize: number;
    maxSampleSize: number;
    significanceThreshold: number;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    winningVariantId?: string;
    conclusion?: string;
}
export interface ExperimentVariant {
    variantId: string;
    role: VariantRole;
    weight: number;
}
export interface CreateExperimentInput {
    name: string;
    description?: string;
    hypothesis: string;
    experimentType: ExperimentType;
    controlVariantId: string;
    treatmentVariantIds: string[];
    testIds: string[];
    trafficSplit?: Record<string, number>;
    minSampleSize?: number;
    maxSampleSize?: number;
    significanceThreshold?: number;
}
/**
 * Tracks which variant was used in each test execution
 */
export interface ExperimentRun {
    id?: number;
    experimentId: string;
    runId: string;
    testId: string;
    variantId: string;
    variantRole: VariantRole;
    startedAt: string;
    completedAt: string;
    passed: boolean;
    turnCount: number;
    durationMs: number;
    goalCompletionRate: number;
    constraintViolations: number;
    errorOccurred: boolean;
    metrics: ExperimentMetrics;
}
export interface ExperimentMetrics {
    testPassed: boolean;
    goalsCompleted: number;
    goalsTotal: number;
    goalCompletionRate: number;
    turnCount: number;
    durationMs: number;
    avgTurnDurationMs: number;
    constraintViolations: number;
    issuesDetected: number;
    errorCount: number;
    inputTokens?: number;
    outputTokens?: number;
    llmCost?: number;
}
/**
 * Result of selecting a variant for a test run
 */
export interface VariantSelection {
    variantId: string;
    role: VariantRole;
    content: string;
    targetFile: string;
}
/**
 * Aggregated statistics for a variant in an experiment
 */
export interface VariantStats {
    experimentId: string;
    variantId: string;
    role: VariantRole;
    sampleSize: number;
    passRate: number;
    passCount: number;
    failCount: number;
    avgGoalCompletionRate: number;
    avgTurnCount: number;
    avgDurationMs: number;
    medianTurnCount: number;
    medianDurationMs: number;
    avgConstraintViolations: number;
    errorRate: number;
    passRateStdDev: number;
    turnCountStdDev: number;
    durationStdDev: number;
    passRateCI: {
        lower: number;
        upper: number;
    };
    turnCountCI: {
        lower: number;
        upper: number;
    };
}
/**
 * Result of a chi-square test for comparing pass rates
 */
export interface ChiSquareResult {
    chiSquare: number;
    pValue: number;
    degreesOfFreedom: number;
    significant: boolean;
}
/**
 * Result of a two-sample t-test for comparing means
 */
export interface TTestResult {
    tStatistic: number;
    pValue: number;
    degreesOfFreedom: number;
    significant: boolean;
    effectSize: number;
    effectMagnitude: 'negligible' | 'small' | 'medium' | 'large';
}
/**
 * Comprehensive experiment analysis
 */
export interface ExperimentAnalysis {
    experimentId: string;
    status: ExperimentStatus;
    controlSampleSize: number;
    treatmentSampleSize: number;
    totalSampleSize: number;
    controlPassRate: number;
    treatmentPassRate: number;
    passRateDifference: number;
    passRateLift: number;
    controlAvgTurns: number;
    treatmentAvgTurns: number;
    turnsDifference: number;
    passRatePValue: number;
    passRateSignificant: boolean;
    turnsCountPValue: number;
    turnsCountSignificant: boolean;
    passRateEffectSize?: number;
    turnsEffectSize?: number;
    isSignificant: boolean;
    recommendedWinner: string | null;
    confidenceLevel: number;
    recommendation: 'continue' | 'adopt-treatment' | 'keep-control' | 'no-difference';
    recommendationReason: string;
    controlStats: VariantStats;
    treatmentStats: VariantStats;
}
/**
 * Recommendation on whether to conclude an experiment
 */
export interface ConclusionRecommendation {
    shouldConclude: boolean;
    reason: 'min-sample-reached' | 'max-sample-reached' | 'significance-achieved' | 'no-difference' | 'continue';
    winningVariantId?: string;
    winningRole?: VariantRole;
    confidence?: number;
    message: string;
}
export type TriggerType = 'fix-applied' | 'scheduled' | 'pass-rate-drop' | 'manual';
/**
 * Triggers define when to suggest/run A/B tests
 */
export interface ExperimentTrigger {
    triggerId: string;
    experimentId: string;
    triggerType: TriggerType;
    condition?: TriggerCondition;
    enabled: boolean;
    lastTriggered?: string;
}
export interface TriggerCondition {
    fixId?: string;
    passRateThreshold?: number;
    schedule?: string;
}
export interface CreateTriggerInput {
    experimentId: string;
    triggerType: TriggerType;
    condition?: TriggerCondition;
}
export type ImpactLevel = 'high' | 'medium' | 'low' | 'minimal';
/**
 * Assessment of whether a fix warrants A/B testing
 */
export interface FixImpactAssessment {
    shouldTest: boolean;
    impactLevel: ImpactLevel;
    reason: string;
    affectedTests: string[];
    affectedFlows: string[];
    suggestedMinSampleSize: number;
}
/**
 * Recommendation to create an A/B test for a fix
 */
export interface ABRecommendation {
    fix: GeneratedFix;
    impactLevel: ImpactLevel;
    reason: string;
    suggestedExperiment: {
        name: string;
        hypothesis: string;
        testIds: string[];
        minSampleSize: number;
    };
}
/**
 * Extended analysis result with A/B recommendations
 */
export interface AnalysisResultWithAB {
    abRecommendations: ABRecommendation[];
}
/**
 * Configuration parameters that can be varied in A/B tests
 */
export interface ConfigVariant {
    llm?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
    };
    intentDetection?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
        cacheEnabled?: boolean;
        cacheTtlMs?: number;
    };
    responseGeneration?: {
        useLlm?: boolean;
        model?: string;
        temperature?: number;
        maxTokens?: number;
    };
    test?: {
        maxTurns?: number;
        responseDelayMs?: number;
        handleUnknownIntents?: 'fail' | 'clarify' | 'generic';
    };
}
//# sourceMappingURL=types.d.ts.map